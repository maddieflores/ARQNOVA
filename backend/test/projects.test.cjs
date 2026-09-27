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

test('CU03 gestiona proyectos del anfitrión por HTTP en un esquema aislado', async t => {
  const schema = `arqnova_test_${randomUUID().replaceAll('-', '')}`;
  const root = new PrismaClient(); let temp; let app;
  const originalUrl = process.env.DATABASE_URL;
  try {
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(originalUrl); url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    temp = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    for (const directory of fs.readdirSync('prisma/migrations').sort()) {
      const path = `prisma/migrations/${directory}/migration.sql`;
      if (!fs.existsSync(path)) continue;
      for (const statement of fs.readFileSync(path, 'utf8').split(';').map(value => value.trim()).filter(Boolean)) await temp.$executeRawUnsafe(statement);
    }
    const roles = {};
    for (const name of ['ADMINISTRADOR', 'ANFITRION', 'COLABORADOR']) roles[name] = await temp.role.create({ data: { name } });
    const passwords = new PasswordService();
    const createUser = async role => {
      const password = randomBytes(24).toString('hex');
      const user = await temp.user.create({ data: { name: `Usuario ${role}`, email: `${randomUUID()}@example.test`, passwordHash: await passwords.hash(password), roleId: roles[role].id } });
      return { ...user, password };
    };
    const owner = await createUser('ANFITRION'); const otherHost = await createUser('ANFITRION');
    const collaborator = await createUser('COLABORADOR'); const administrator = await createUser('ADMINISTRADOR');
    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false }); configureApplication(app); await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`;
    const call = async (path, method = 'GET', body, token) => {
      const headers = { 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json(); assert.equal(JSON.stringify(data).includes('passwordHash'), false);
      return { status: response.status, data };
    };
    const tokenFor = async user => (await call('/auth/login', 'POST', { email: user.email, password: user.password })).data.accessToken;
    const ownerToken = await tokenFor(owner); const otherToken = await tokenFor(otherHost);
    const collaboratorToken = await tokenFor(collaborator); const adminToken = await tokenFor(administrator);
    let project;
    await t.test('ANFITRION lista vacío y crea proyecto con ownerId del JWT', async () => {
      const empty = await call('/projects', 'GET', undefined, ownerToken); assert.equal(empty.status, 200); assert.deepEqual(empty.data, []);
      const emptyStats = await call('/projects/stats', 'GET', undefined, ownerToken);
      assert.equal(emptyStats.status, 200);
      assert.deepEqual(emptyStats.data, { totalProjects: 0, collaborators: 0, generatedBackends: 0, umlDiagrams: 0 });
      const spoofed = await call('/projects', 'POST', { name: 'No permitido', ownerId: otherHost.id }, ownerToken); assert.equal(spoofed.status, 400);
      const result = await call('/projects', 'POST', { name: '  Proyecto CU03  ', description: 'Descripción inicial' }, ownerToken);
      assert.equal(result.status, 201); project = result.data; assert.equal(project.name, 'Proyecto CU03'); assert.equal(project.ownerId, owner.id);
      assert.equal(project.owner.id, owner.id); assert.equal(await temp.project.count({ where: { ownerId: otherHost.id } }), 0);
    });
    await t.test('propietario lista, busca y consulta su proyecto con estadísticas reales', async () => {
      const list = await call('/projects', 'GET', undefined, ownerToken); assert.equal(list.status, 200); assert.equal(list.data.length, 1);
      assert.equal((await call('/projects?search=cu03', 'GET', undefined, ownerToken)).data.length, 1);
      assert.equal((await call('/projects?search=ausente', 'GET', undefined, ownerToken)).data.length, 0);
      const result = await call(`/projects/${project.id}`, 'GET', undefined, ownerToken); assert.equal(result.status, 200); assert.equal(result.data.id, project.id);
      const statsRes = await call('/projects/stats', 'GET', undefined, ownerToken);
      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.data.totalProjects, 1);
      assert.equal(statsRes.data.collaborators, 0);
      assert.equal(statsRes.data.generatedBackends, 0);
    });
    await t.test('propietario modifica nombre y descripción sin cambiar propietario', async () => {
      const result = await call(`/projects/${project.id}`, 'PATCH', { name: 'Proyecto actualizado', description: 'Nueva descripción' }, ownerToken);
      assert.equal(result.status, 200); assert.equal(result.data.name, 'Proyecto actualizado'); assert.equal(result.data.ownerId, owner.id);
      assert.equal((await temp.project.findUniqueOrThrow({ where: { id: project.id } })).ownerId, owner.id);
    });
    await t.test('otro ANFITRION no consulta, modifica ni elimina proyecto ajeno', async () => {
      assert.deepEqual((await call('/projects', 'GET', undefined, otherToken)).data, []);
      for (const [method, body] of [['GET', undefined], ['PATCH', { name: 'Intrusión' }], ['DELETE', undefined]]) {
        assert.equal((await call(`/projects/${project.id}`, method, body, otherToken)).status, 403);
      }
    });
    await t.test('COLABORADOR y ADMINISTRADOR reciben 403', async () => {
      for (const token of [collaboratorToken, adminToken]) {
        assert.equal((await call('/projects', 'GET', undefined, token)).status, 403);
        assert.equal((await call('/projects', 'POST', { name: 'Prohibido' }, token)).status, 403);
      }
    });
    await t.test('sin token, proyecto inexistente y datos inválidos se controlan', async () => {
      assert.equal((await call('/projects')).status, 401);
      assert.equal((await call(`/projects/${randomUUID()}`, 'GET', undefined, ownerToken)).status, 404);
      assert.equal((await call('/projects/invalid', 'GET', undefined, ownerToken)).status, 400);
      for (const body of [{}, { name: '   ' }, { name: 'x'.repeat(121) }, { name: 'Válido', extra: true }]) assert.equal((await call('/projects', 'POST', body, ownerToken)).status, 400);
      assert.equal((await call(`/projects/${project.id}`, 'PATCH', {}, ownerToken)).status, 400);
      assert.equal((await call(`/projects/${project.id}`, 'PATCH', { ownerId: otherHost.id }, ownerToken)).status, 400);
    });
    await t.test('DELETE aplica borrado lógico y excluye el proyecto', async () => {
      const result = await call(`/projects/${project.id}`, 'DELETE', undefined, ownerToken); assert.equal(result.status, 200); assert.ok(result.data.deletedAt);
      assert.deepEqual((await call('/projects', 'GET', undefined, ownerToken)).data, []);
      assert.equal((await call(`/projects/${project.id}`, 'GET', undefined, ownerToken)).status, 404);
      assert.ok((await temp.project.findUniqueOrThrow({ where: { id: project.id } })).deletedAt);
    });
  } finally {
    if (app) await app.close(); if (temp) await temp.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect();
  }
});
