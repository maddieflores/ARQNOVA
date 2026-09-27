const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
require('reflect-metadata');
process.loadEnvFile('.env');

const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { PasswordService } = require('../dist/common/security/password.service');
const { configureApplication } = require('../dist/config/configure-app');

test('Flujo completo de captura móvil UML -> IA -> Propuesta -> Aplicación a PostgreSQL', async t => {
  const schema = `arqnova_test_${randomUUID().replaceAll('-', '')}`;
  const root = new PrismaClient();
  let temp;
  let app;
  const originalUrl = process.env.DATABASE_URL;
  const originalProvider = process.env.AI_PROVIDER;

  try {
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(originalUrl);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    process.env.AI_PROVIDER = 'mock';
    temp = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    for (const directory of fs.readdirSync('prisma/migrations').sort()) {
      const migration = `prisma/migrations/${directory}/migration.sql`;
      if (fs.existsSync(migration)) {
        for (const sql of fs.readFileSync(migration, 'utf8').split(';').map(v => v.trim()).filter(Boolean)) {
          await temp.$executeRawUnsafe(sql);
        }
      }
    }

    const roles = {};
    for (const name of ['ADMINISTRADOR', 'ANFITRION', 'COLABORADOR']) {
      roles[name] = await temp.role.create({ data: { name } });
    }
    const passwords = new PasswordService();
    const createUser = async (role, name) => {
      const password = randomBytes(24).toString('hex');
      const user = await temp.user.create({
        data: {
          name: name || role,
          email: `${randomUUID()}@example.test`,
          passwordHash: await passwords.hash(password),
          roleId: roles[role].id,
        },
      });
      return { ...user, password };
    };

    const host = await createUser('ANFITRION', 'Host User');
    const intruder = await createUser('COLABORADOR', 'Intruder User');
    const project = await temp.project.create({
      data: { name: 'Sistema Biblioteca', ownerId: host.id },
    });

    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const base = `${origin}/api`;

    const call = async (path, method = 'GET', body, token) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      return { status: response.status, data };
    };

    const tokenFor = async user =>
      (await call('/auth/login', 'POST', { email: user.email, password: user.password })).data.accessToken;
    const hostToken = await tokenFor(host);
    const intruderToken = await tokenFor(intruder);

    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await t.test('1. Validación: Requiere autenticación JWT', async () => {
      const res = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: samplePngBase64, mimeType: 'image/png' },
      });
      assert.equal(res.status, 401);
    });

    await t.test('2. Validación: Rechaza acceso si el usuario no tiene permisos sobre el proyecto', async () => {
      const res = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: samplePngBase64, mimeType: 'image/png' },
      }, intruderToken);
      assert.equal(res.status, 403);
    });

    await t.test('3. Validación: Rechaza solicitud sin imagen o con formato no soportado', async () => {
      const resNoImage = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {}, hostToken);
      assert.equal(resNoImage.status, 400);

      const resBadFormat = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: samplePngBase64, mimeType: 'application/pdf' },
      }, hostToken);
      assert.equal(resBadFormat.status, 400);
    });

    let createdProposalId;

    await t.test('4. Envío de captura móvil: Genera propuesta PENDING y estadísticas estructuradas', async () => {
      const res = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: samplePngBase64, mimeType: 'image/png' },
        prompt: 'Analizar diagrama UML de biblioteca',
      }, hostToken);

      assert.equal(res.status, 201);
      assert.ok(res.data.id);
      assert.equal(res.data.projectId, project.id);
      assert.equal(res.data.status, 'PENDING');
      assert.equal(res.data.origin, 'MOBILE_IMAGE');
      assert.ok(res.data.counts);
      assert.equal(res.data.counts.classes, 2);
      assert.equal(res.data.counts.attributes, 4);
      assert.equal(res.data.counts.relations, 1);
      assert.ok(res.data.message.includes('Continúa en ARQNOVA Web'));

      createdProposalId = res.data.id;

      // Verificar que NO se modificó aún el diagrama en PostgreSQL (no persistencia automática silenciosa)
      const dbClassesBefore = await temp.umlClass.findMany({
        where: { diagram: { projectId: project.id } },
      });
      assert.equal(dbClassesBefore.length, 0);

      // Verificar persistencia de la propuesta en la tabla UmlProposal
      const proposalDb = await temp.umlProposal.findUnique({
        where: { id: createdProposalId },
      });
      assert.ok(proposalDb);
      assert.equal(proposalDb.status, 'PENDING');
      assert.equal(proposalDb.origin, 'MOBILE_IMAGE');
      assert.equal(proposalDb.classesCount, 2);
    });

    await t.test('5. Consultar propuestas del proyecto y mis capturas', async () => {
      const listRes = await call(`/projects/${project.id}/ai/proposals`, 'GET', undefined, hostToken);
      assert.equal(listRes.status, 200);
      assert.equal(listRes.data.length, 1);
      assert.equal(listRes.data[0].id, createdProposalId);
      assert.equal(listRes.data[0].status, 'PENDING');

      const myCapturesRes = await call('/ai/my-captures', 'GET', undefined, hostToken);
      assert.equal(myCapturesRes.status, 200);
      assert.equal(myCapturesRes.data.length, 1);
      assert.equal(myCapturesRes.data[0].id, createdProposalId);
      assert.equal(myCapturesRes.data[0].project.name, 'Sistema Biblioteca');
    });

    await t.test('6. Aplicar propuesta desde Web: Persiste entidades UML en PostgreSQL y marca estado APPLIED', async () => {
      const applyRes = await call(`/projects/${project.id}/ai/proposals/${createdProposalId}/apply`, 'POST', undefined, hostToken);
      assert.equal(applyRes.status, 201);
      assert.equal(applyRes.data.proposal.status, 'APPLIED');
      assert.deepEqual(applyRes.data.created, { classes: 2, attributes: 4, methods: 0, relations: 1 });

      // Verificar que ahora SI existen las clases y relaciones en PostgreSQL
      const dbClasses = await temp.umlClass.findMany({
        where: { diagram: { projectId: project.id } },
        include: { attributes: true },
      });
      assert.equal(dbClasses.length, 2);
      assert.ok(dbClasses.find(c => c.name === 'Cliente'));
      assert.ok(dbClasses.find(c => c.name === 'Pedido'));

      const dbRelations = await temp.umlRelation.findMany({
        where: { diagram: { projectId: project.id } },
      });
      assert.equal(dbRelations.length, 1);

      // Verificar que no se puede volver a aplicar una propuesta ya aplicada
      const reapplyRes = await call(`/projects/${project.id}/ai/proposals/${createdProposalId}/apply`, 'POST', undefined, hostToken);
      assert.equal(reapplyRes.status, 400);
    });

    await t.test('7. Rechazar propuesta: Marca estado REJECTED sin tocar el diagrama', async () => {
      // Crear una segunda propuesta
      const res2 = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: samplePngBase64, mimeType: 'image/png' },
      }, hostToken);
      assert.equal(res2.status, 201);
      const proposal2Id = res2.data.id;

      const rejectRes = await call(`/projects/${project.id}/ai/proposals/${proposal2Id}/reject`, 'POST', undefined, hostToken);
      assert.equal(rejectRes.status, 201);
      assert.equal(rejectRes.data.status, 'REJECTED');

      const proposal2Db = await temp.umlProposal.findUnique({ where: { id: proposal2Id } });
      assert.equal(proposal2Db.status, 'REJECTED');
    });

    await t.test('8. Límite de body parser: Permite enviar imagen de ~1.8 MB (1,807,098 bytes) sin PayloadTooLargeError', async () => {
      // Crear un Base64 válido de ~1.8 MB (1,807,098 bytes)
      const chunk = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const repeatCount = Math.floor(1_807_098 / chunk.length);
      const largeBase64 = chunk.repeat(repeatCount);

      const res = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: largeBase64, mimeType: 'image/png' },
        prompt: 'Analizar imagen grande de 1.8MB',
      }, hostToken);

      assert.equal(res.status, 201);
      assert.ok(res.data.id);
      assert.equal(res.data.status, 'PENDING');

      // Comprobar también que el endpoint web /ai/uml-proposal acepta la imagen de 1.8MB
      const webRes = await call(`/projects/${project.id}/ai/uml-proposal`, 'POST', {
        image: { data: largeBase64, mimeType: 'image/png' },
        prompt: 'Analizar imagen grande web',
      }, hostToken);

      assert.equal(webRes.status, 201);
      assert.ok(webRes.data.proposal);
    });

    await t.test('9. Validación específica de 5 MB / 10,000,000 chars: Rechaza imágenes que exceden el límite funcional', async () => {
      // Cadena de más de 10,000,000 caracteres (excede el límite del DTO)
      const oversizedBase64 = 'A'.repeat(10_000_001);

      const res = await call(`/projects/${project.id}/ai/mobile-capture`, 'POST', {
        image: { data: oversizedBase64, mimeType: 'image/png' },
      }, hostToken);

      assert.equal(res.status, 400);
      assert.ok(JSON.stringify(res.data).includes('tamaño máximo permitido'));
    });


  } finally {
    if (app) await app.close();
    if (temp) await temp.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalProvider;
    await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await root.$disconnect();
  }
});
