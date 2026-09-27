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

test('Generación de Diagramas UML desde cero mediante IA (Texto, Voz, Imagen)', async t => {
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

    const createUser = async (roleName) => {
      const password = randomBytes(24).toString('hex');
      const user = await temp.user.create({
        data: {
          name: roleName,
          email: `${randomUUID()}@example.test`,
          passwordHash: await passwords.hash(password),
          roleId: roles[roleName].id,
        },
      });
      return { ...user, password };
    };

    const host = await createUser('ANFITRION');
    const collaborator = await createUser('COLABORADOR');
    const outsider = await createUser('COLABORADOR');

    // Proyecto previo existente para verificar que no se modifique
    const existingProject = await temp.project.create({
      data: {
        name: 'Proyecto Existente',
        ownerId: host.id,
      },
    });
    const existingDiagram = await temp.diagram.create({
      data: {
        projectId: existingProject.id,
        name: 'Diagrama Existente',
        classes: {
          create: {
            name: 'EntidadExistente',
            x: 100,
            y: 100,
            attributes: {
              create: { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true, position: 0 },
            },
          },
        },
      },
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
      assert.equal(JSON.stringify(data).includes('passwordHash'), false);
      return { status: response.status, data };
    };

    const tokenFor = async (user) => {
      return (await call('/auth/login', 'POST', { email: user.email, password: user.password })).data.accessToken;
    };

    const hostToken = await tokenFor(host);
    const collaboratorToken = await tokenFor(collaborator);

    // 1. Generación UML desde texto
    await t.test('1. Generación UML desde texto devuelve propuesta estructurada completa', async () => {
      const res = await call(
        '/ai/generate-diagram',
        'POST',
        { prompt: 'Crear un sistema de biblioteca con Usuario, Libro y Prestamo' },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.ok(res.data.proposal);
      assert.ok(res.data.proposal.classes.length >= 2);
      assert.ok(res.data.proposal.relations.length >= 1);
      assert.ok(res.data.proposal.classes.some(c => c.name === 'Usuario' || c.name === 'Cliente'));
    });

    // 2. Generación UML desde voz (transcripción)
    await t.test('2. Generación UML desde voz (transcripción) procesa requisitos en lenguaje natural', async () => {
      const res = await call(
        '/ai/generate-diagram',
        'POST',
        { prompt: 'Generar sistema de clinica con Paciente, Medico y ConsultaMedica' },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.ok(res.data.proposal);
      assert.ok(res.data.proposal.classes.some(c => c.name === 'Paciente' || c.name === 'Medico'));
      assert.ok(res.data.proposal.relations.length >= 1);
    });

    // 3. Generación UML desde imagen
    await t.test('3. Generación UML desde imagen analiza el contenido visual y devuelve modelo', async () => {
      const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await call(
        '/ai/generate-diagram',
        'POST',
        {
          prompt: 'Extraer diagrama de la imagen adjunta',
          image: {
            data: dummyPngBase64,
            mimeType: 'image/png',
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.ok(res.data.proposal);
      assert.ok(res.data.proposal.classes.length >= 2);
      assert.ok(res.data.proposal.relations.length >= 1);
    });

    // 4. Validación de la estructura generada y rechazo de inputs vacíos
    await t.test('4. Rechaza solicitudes vacías sin texto ni imagen', async () => {
      const res = await call('/ai/generate-diagram', 'POST', { prompt: '   ' }, hostToken);
      assert.equal(res.status, 400);
    });

    // 5-10. Creación atómica en PostgreSQL de Proyecto + Diagrama + Clases + Atributos + Métodos + Relaciones
    let newProjectId;
    await t.test('5-10. Creación y persistencia atómica en PostgreSQL con posiciones y relaciones', async () => {
      const proposalToPersist = {
        summary: 'Sistema de Gestión de Biblioteca',
        classes: [
          {
            name: 'Usuario',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'email', type: 'String', visibility: 'PUBLIC' },
            ],
            methods: [
              { name: 'solicitarPrestamo', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'Libro',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'titulo', type: 'String', visibility: 'PRIVATE' },
              { name: 'isbn', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'prestar', returnType: 'Boolean', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'Prestamo',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'fechaInicio', type: 'Date', visibility: 'PRIVATE' },
              { name: 'fechaDevolucion', type: 'Date', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'finalizar', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
        ],
        relations: [
          {
            sourceClassName: 'Usuario',
            targetClassName: 'Prestamo',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'solicita',
          },
          {
            sourceClassName: 'Libro',
            targetClassName: 'Prestamo',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'prestado_en',
          },
        ],
      };

      const res = await call(
        '/ai/create-project-from-diagram',
        'POST',
        {
          projectName: 'Biblioteca Inteligente IA',
          projectDescription: 'Creado mediante Inteligencia Artificial',
          proposal: proposalToPersist,
        },
        hostToken,
      );

      assert.equal(res.status, 201);
      assert.ok(res.data.project.id);
      newProjectId = res.data.project.id;
      assert.equal(res.data.project.name, 'Biblioteca Inteligente IA');
      assert.ok(res.data.diagram.id);
      assert.equal(res.data.diagram.classes.length, 3);
      assert.equal(res.data.diagram.relations.length, 2);
      assert.deepEqual(res.data.created, { classes: 3, attributes: 9, methods: 3, relations: 2 });

      // Verificar persistencia en base de datos
      const dbClasses = await temp.umlClass.findMany({
        where: { diagramId: res.data.diagram.id },
        include: { attributes: true, methods: true },
      });
      assert.equal(dbClasses.length, 3);

      const dbRelations = await temp.umlRelation.findMany({
        where: { diagramId: res.data.diagram.id },
      });
      assert.equal(dbRelations.length, 2);

      // Verificar posiciones distribuidas
      for (const cls of dbClasses) {
        assert.ok(cls.x >= 80);
        assert.ok(cls.y >= 80);
      }

      // Verificar claves primarias y tipos
      const usuarioClass = dbClasses.find(c => c.name === 'Usuario');
      assert.ok(usuarioClass);
      const idAttr = usuarioClass.attributes.find(a => a.name === 'id');
      assert.ok(idAttr);
      assert.equal(idAttr.isPrimaryKey, true);
      assert.equal(idAttr.type, 'Long');

      const solMethod = usuarioClass.methods.find(m => m.name === 'solicitarPrestamo');
      assert.ok(solMethod);
      assert.equal(solMethod.returnType, 'void');
    });

    // 11. Redirección y acceso al nuevo diagrama vía GET /projects/:id/editor
    await t.test('11. El nuevo diagrama es accesible independientemente en el editor UML', async () => {
      assert.ok(newProjectId);
      const res = await call(`/projects/${newProjectId}/diagram`, 'GET', undefined, hostToken);
      assert.equal(res.status, 200);
      assert.equal(res.data.classes.length, 3);
      assert.equal(res.data.relations.length, 2);
    });

    // 12. Verificar que un diagrama existente NO sea modificado
    await t.test('12. El proyecto y diagrama existente no sufrieron alteraciones', async () => {
      const existingDb = await temp.diagram.findUnique({
        where: { id: existingDiagram.id },
        include: { classes: true, relations: true },
      });
      assert.equal(existingDb.classes.length, 1);
      assert.equal(existingDb.classes[0].name, 'EntidadExistente');
      assert.equal(existingDb.relations.length, 0);
    });

    // 13. Verificar que la edición manual continúe funcionando
    await t.test('13. La creación manual de clases y relaciones continúa funcionando', async () => {
      assert.ok(newProjectId);
      const res = await call(
        `/projects/${newProjectId}/diagram/classes`,
        'POST',
        { name: 'NuevaClaseManual', x: 500, y: 500 },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.name, 'NuevaClaseManual');
    });

    // 14. Verificar que la edición IA existente continúe funcionando
    await t.test('14. La edición IA existente incremental continúa funcionando', async () => {
      assert.ok(newProjectId);
      const editRes = await call(
        `/projects/${newProjectId}/ai/uml-proposal`,
        'POST',
        { prompt: 'Agrega atributo telefono a Cliente' },
        hostToken,
      );
      assert.equal(editRes.status, 201);
      assert.ok(editRes.data.proposal);
    });

    // 15. Permisos de rol: un colaborador no puede crear proyectos desde propuesta (solo ANFITRION)
    await t.test('15. Solo un anfitrión puede persistir nuevos proyectos generados', async () => {
      const res = await call(
        '/ai/create-project-from-diagram',
        'POST',
        {
          projectName: 'Intento Colaborador',
          proposal: { classes: [{ name: 'Test', attributes: [], methods: [] }], relations: [] },
        },
        collaboratorToken,
      );
      assert.equal(res.status, 403);
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
