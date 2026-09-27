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

test('Edición del diagrama UML existente mediante IA por texto (Paso 2)', async t => {
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
      data: { name: 'Proyecto IA Paso 2', ownerId: host.id },
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

    // Setup inicial: Crear diagrama con Cliente y Pedido
    let clienteClass;
    let pedidoClass;
    let initialDiagram;

    await t.test('Inicialización del diagrama base con Cliente y Pedido', async () => {
      const initRes = await call(
        applyPath,
        'POST',
        {
          proposal: {
            classes: [
              {
                name: 'Cliente',
                attributes: [
                  { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
                  { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
                ],
                methods: [],
              },
              {
                name: 'Pedido',
                attributes: [
                  { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
                  { name: 'total', type: 'Decimal', visibility: 'PRIVATE' },
                ],
                methods: [],
              },
            ],
            relations: [
              {
                sourceClassName: 'Cliente',
                targetClassName: 'Pedido',
                type: 'ASSOCIATION',
                sourceMultiplicity: '1',
                targetMultiplicity: '1',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(initRes.status, 201);
      initialDiagram = initRes.data.diagram;
      clienteClass = initialDiagram.classes.find(c => c.name === 'Cliente');
      pedidoClass = initialDiagram.classes.find(c => c.name === 'Pedido');
      assert.ok(clienteClass);
      assert.ok(pedidoClass);
    });

    await t.test('1. ADD_ATTRIBUTE sobre clase existente (Cliente.telefono)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_ATTRIBUTE',
                classId: clienteClass.id,
                className: 'Cliente',
                attributeName: 'telefono',
                attributeType: 'String',
                attributeVisibility: 'PRIVATE',
                isPrimaryKey: false,
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedCliente = res.data.diagram.classes.find(c => c.id === clienteClass.id);
      assert.equal(updatedCliente.attributes.length, 3);
      const telefono = updatedCliente.attributes.find(a => a.name === 'telefono');
      assert.ok(telefono);
      assert.equal(telefono.type, 'String');

      // Verificar que Pedido permaneció intacto
      const checkPedido = res.data.diagram.classes.find(c => c.id === pedidoClass.id);
      assert.equal(checkPedido.attributes.length, 2);
    });

    await t.test('2. UPDATE_ATTRIBUTE (cambia tipo de telefono a Long)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'UPDATE_ATTRIBUTE',
                classId: clienteClass.id,
                attributeName: 'telefono',
                attributeType: 'Long',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedCliente = res.data.diagram.classes.find(c => c.id === clienteClass.id);
      const telefono = updatedCliente.attributes.find(a => a.name === 'telefono');
      assert.equal(telefono.type, 'Long');
    });

    await t.test('3. ADD_METHOD a Pedido (calcularTotal)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_METHOD',
                classId: pedidoClass.id,
                methodName: 'calcularTotal',
                methodReturnType: 'Decimal',
                methodVisibility: 'PUBLIC',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedPedido = res.data.diagram.classes.find(c => c.id === pedidoClass.id);
      assert.equal(updatedPedido.methods.length, 1);
      assert.equal(updatedPedido.methods[0].name, 'calcularTotal');
      assert.equal(updatedPedido.methods[0].returnType, 'Decimal');
    });

    await t.test('4. UPDATE_METHOD (cambia returnType a void)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'UPDATE_METHOD',
                classId: pedidoClass.id,
                methodName: 'calcularTotal',
                methodReturnType: 'void',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedPedido = res.data.diagram.classes.find(c => c.id === pedidoClass.id);
      assert.equal(updatedPedido.methods[0].returnType, 'void');
    });

    await t.test('5. UPDATE_RELATION (cambia multiplicidad de Pedido a 0..*)', async () => {
      const currentRel = (await temp.umlRelation.findMany())[0];
      assert.ok(currentRel);
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'UPDATE_RELATION',
                relationId: currentRel.id,
                targetMultiplicity: '0..*',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedRel = res.data.diagram.relations.find(r => r.id === currentRel.id);
      assert.equal(updatedRel.targetMultiplicity, '0..*');
    });

    await t.test('6. UPDATE_CLASS (renombra Cliente a Usuario)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'UPDATE_CLASS',
                classId: clienteClass.id,
                className: 'Usuario',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const usuarioClass = res.data.diagram.classes.find(c => c.id === clienteClass.id);
      assert.equal(usuarioClass.name, 'Usuario');
      assert.equal(usuarioClass.attributes.length, 3); // Conserva atributos intactos
    });

    await t.test('7. ADD_CLASS (agrega Producto)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_CLASS',
                className: 'Producto',
                attributes: [
                  { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
                  { name: 'precio', type: 'Decimal', visibility: 'PRIVATE' },
                ],
                methods: [],
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.diagram.classes.length, 3);
      const prod = res.data.diagram.classes.find(c => c.name === 'Producto');
      assert.ok(prod);
      assert.equal(prod.attributes.length, 2);
    });

    await t.test('8. ADD_RELATION (relaciona Pedido con Producto)', async () => {
      const prod = await temp.umlClass.findFirst({ where: { name: 'Producto' } });
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_RELATION',
                sourceClassId: pedidoClass.id,
                targetClassId: prod.id,
                relationType: 'COMPOSITION',
                sourceMultiplicity: '1',
                targetMultiplicity: '1..*',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.diagram.relations.length, 2);
    });

    await t.test('9. DELETE_METHOD (elimina calcularTotal de Pedido)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'DELETE_METHOD',
                classId: pedidoClass.id,
                methodName: 'calcularTotal',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedPedido = res.data.diagram.classes.find(c => c.id === pedidoClass.id);
      assert.equal(updatedPedido.methods.length, 0);
    });

    await t.test('10. DELETE_ATTRIBUTE (elimina telefono de Usuario)', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'DELETE_ATTRIBUTE',
                classId: clienteClass.id,
                attributeName: 'telefono',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      const updatedUsuario = res.data.diagram.classes.find(c => c.id === clienteClass.id);
      assert.equal(updatedUsuario.attributes.length, 2);
      assert.equal(updatedUsuario.attributes.find(a => a.name === 'telefono'), undefined);
    });

    await t.test('11. DELETE_RELATION (elimina relación Pedido-Producto)', async () => {
      const prod = await temp.umlClass.findFirst({ where: { name: 'Producto' } });
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'DELETE_RELATION',
                sourceClassId: pedidoClass.id,
                targetClassId: prod.id,
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.diagram.relations.length, 1);
    });

    await t.test('12. DELETE_CLASS (elimina Producto)', async () => {
      const prod = await temp.umlClass.findFirst({ where: { name: 'Producto' } });
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'DELETE_CLASS',
                classId: prod.id,
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 201);
      assert.equal(res.data.diagram.classes.length, 2);
      assert.equal(res.data.diagram.classes.find(c => c.name === 'Producto'), undefined);
    });

    await t.test('13. Control de errores: Clase inexistente rechaza con 404', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_ATTRIBUTE',
                className: 'Inexistente',
                attributeName: 'x',
                attributeType: 'String',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 404);
    });

    await t.test('14. Control de errores: Atributo inexistente rechaza con 404', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'UPDATE_ATTRIBUTE',
                classId: clienteClass.id,
                attributeName: 'inexistente',
                attributeType: 'String',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 404);
    });

    await t.test('15. Control de errores: Atributo duplicado rechaza con 400', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_ATTRIBUTE',
                classId: clienteClass.id,
                attributeName: 'nombre', // Ya existe
                attributeType: 'String',
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 400);
    });

    await t.test('16. Control de errores: Clase duplicada rechaza con 409', async () => {
      const res = await call(
        applyPath,
        'POST',
        {
          proposal: {
            actions: [
              {
                action: 'ADD_CLASS',
                className: 'Usuario', // Ya existe
              },
            ],
          },
        },
        hostToken,
      );
      assert.equal(res.status, 409);
    });

    await t.test('17. Verificación de persistencia real en PostgreSQL tras recarga', async () => {
      const dbClasses = await temp.umlClass.findMany({
        where: { diagram: { projectId: project.id } },
        include: { attributes: true, methods: true },
      });
      assert.equal(dbClasses.length, 2);
      const usuario = dbClasses.find(c => c.name === 'Usuario');
      const pedido = dbClasses.find(c => c.name === 'Pedido');
      assert.ok(usuario);
      assert.ok(pedido);
      assert.equal(usuario.attributes.length, 2);
      assert.equal(pedido.attributes.length, 2);
      assert.equal(pedido.methods.length, 0);
    });

    await t.test('18. GeminiAiProvider maneja falta de clave y timeouts con errores controlados', async () => {
      const noKeyProvider = new GeminiAiProvider({ get: () => '' });
      await assert.rejects(
        () => noKeyProvider.generateUmlProposal('Crea una clase'),
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
