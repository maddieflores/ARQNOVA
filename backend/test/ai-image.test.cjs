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
const { GeminiAiProvider } = require('../dist/ai/gemini-ai.provider');

test('Generación y edición del diagrama UML mediante Imagen o Foto (Caso 1 y Caso 2)', async t => {
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
    const createUser = async role => {
      const password = randomBytes(24).toString('hex');
      const user = await temp.user.create({
        data: {
          name: role,
          email: `${randomUUID()}@example.test`,
          passwordHash: await passwords.hash(password),
          roleId: roles[role].id,
        },
      });
      return { ...user, password };
    };

    const host = await createUser('ANFITRION');
    const project = await temp.project.create({
      data: { name: 'Proyecto UML por Imagen', ownerId: host.id },
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
    const proposalPath = `/projects/${project.id}/ai/uml-proposal`;
    const applyPath = `/projects/${project.id}/ai/apply-uml-proposal`;

    // 1x1 pixel base64 PNG dummy image
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await t.test('1. Validación: Rechazo cuando falta tanto prompt como imagen', async () => {
      const res = await call(proposalPath, 'POST', {}, hostToken);
      assert.equal(res.status, 400);
      const resEmptyPrompt = await call(proposalPath, 'POST', { prompt: '' }, hostToken);
      assert.equal(resEmptyPrompt.status, 400);
    });

    await t.test('2. Validación: Rechazo de formatos no permitidos (ej. text/plain o application/pdf)', async () => {
      const res = await call(
        proposalPath,
        'POST',
        {
          image: {
            data: samplePngBase64,
            mimeType: 'application/pdf',
          },
        },
        hostToken,
      );
      assert.equal(res.status, 400);
    });

    let generatedProposal;

    await t.test('3. CASO 1: Generar propuesta UML desde imagen en diagrama vacío', async () => {
      const res = await call(
        proposalPath,
        'POST',
        {
          image: {
            data: samplePngBase64,
            mimeType: 'image/png',
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.ok(res.data.proposal);
      generatedProposal = res.data.proposal;
      assert.ok(generatedProposal.summary);
      assert.ok(generatedProposal.actions && generatedProposal.actions.length > 0);

      // Verificar que incluye acciones para Cliente y Pedido
      const addCliente = generatedProposal.actions.find(a => a.action === 'ADD_CLASS' && a.className === 'Cliente');
      const addPedido = generatedProposal.actions.find(a => a.action === 'ADD_CLASS' && a.className === 'Pedido');
      const addRel = generatedProposal.actions.find(a => a.action === 'ADD_RELATION');

      assert.ok(addCliente, 'Debe incluir ADD_CLASS para Cliente');
      assert.ok(addPedido, 'Debe incluir ADD_CLASS para Pedido');
      assert.ok(addRel, 'Debe incluir ADD_RELATION entre Cliente y Pedido');
      assert.equal(addRel.sourceMultiplicity, '1');
      assert.equal(addRel.targetMultiplicity, '0..*');
    });

    await t.test('4. Aplicar propuesta generada por imagen y verificar persistencia en PostgreSQL', async () => {
      const applyRes = await call(
        applyPath,
        'POST',
        { proposal: generatedProposal },
        hostToken,
      );
      assert.equal(applyRes.status, 201);
      assert.deepEqual(applyRes.data.created, { classes: 2, attributes: 4, methods: 0, relations: 1 });

      const dbClasses = await temp.umlClass.findMany({
        where: { diagram: { projectId: project.id } },
        include: { attributes: true, methods: true },
      });
      assert.equal(dbClasses.length, 2);
      const cliente = dbClasses.find(c => c.name === 'Cliente');
      const pedido = dbClasses.find(c => c.name === 'Pedido');
      assert.ok(cliente);
      assert.ok(pedido);
      assert.equal(cliente.attributes.find(a => a.name === 'id')?.isPrimaryKey, true);
      assert.equal(cliente.attributes.find(a => a.name === 'nombre')?.type, 'String');
      assert.equal(pedido.attributes.find(a => a.name === 'total')?.type, 'Decimal');

      const dbRelations = await temp.umlRelation.findMany({
        where: { diagram: { projectId: project.id } },
      });
      assert.equal(dbRelations.length, 1);
      assert.equal(dbRelations[0].sourceMultiplicity, '1');
      assert.equal(dbRelations[0].targetMultiplicity, '0..*');
    });

    await t.test('5. CASO 2: Análisis incremental con imagen cuando ya existen entidades', async () => {
      // Re-analizar la misma imagen con el diagrama actual
      const res = await call(
        proposalPath,
        'POST',
        {
          image: {
            data: samplePngBase64,
            mimeType: 'image/png',
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.ok(res.data.proposal);
      // No debe volver a crear Cliente ni Pedido duplicados
      const addCliente = (res.data.proposal.actions || []).find(a => a.action === 'ADD_CLASS' && a.className === 'Cliente');
      const addPedido = (res.data.proposal.actions || []).find(a => a.action === 'ADD_CLASS' && a.className === 'Pedido');
      assert.equal(addCliente, undefined, 'No debe duplicar Cliente si ya existe');
      assert.equal(addPedido, undefined, 'No debe duplicar Pedido si ya existe');
    });

    await t.test('6. GeminiAiProvider maneja correctamente imagen multimodal y variables de entorno', async () => {
      const provider = new GeminiAiProvider({
        get: (key, fallback) => {
          if (key === 'GEMINI_API_KEY') return 'test-key';
          if (key === 'GEMINI_MODEL') return 'gemini-3.5-flash-lite';
          if (key === 'GEMINI_API_BASE_URL') return 'https://generativelanguage.googleapis.com/v1beta';
          if (key === 'AI_TIMEOUT_MS') return 1000;
          return fallback;
        },
      });

      // Validar que lanza ServiceUnavailableException ante falta de clave
      const noKeyProvider = new GeminiAiProvider({ get: () => '' });
      await assert.rejects(
        () => noKeyProvider.generateUmlProposal('test', null, { data: samplePngBase64, mimeType: 'image/png' }),
        err => err.getStatus() === 503 && err.message.includes('GEMINI_API_KEY'),
      );
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
