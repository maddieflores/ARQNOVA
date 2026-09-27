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

test('Dashboard multiusuario dinámico con datos reales de PostgreSQL', async t => {
  const schema = `arqnova_test_${randomUUID().replaceAll('-', '')}`;
  const root = new PrismaClient();
  let temp;
  let app;
  const originalUrl = process.env.DATABASE_URL;

  try {
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const url = new URL(originalUrl);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    temp = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    for (const directory of fs.readdirSync('prisma/migrations').sort()) {
      const path = `prisma/migrations/${directory}/migration.sql`;
      if (!fs.existsSync(path)) continue;
      for (const statement of fs.readFileSync(path, 'utf8').split(';').map(v => v.trim()).filter(Boolean)) {
        await temp.$executeRawUnsafe(statement);
      }
    }

    const roles = {};
    for (const name of ['ADMINISTRADOR', 'ANFITRION', 'COLABORADOR']) {
      roles[name] = await temp.role.create({ data: { name } });
    }

    const passwords = new PasswordService();
    const createUser = async (role, name = `Usuario ${role}`) => {
      const password = randomBytes(24).toString('hex');
      const user = await temp.user.create({
        data: {
          name,
          email: `${randomUUID()}@example.test`,
          passwordHash: await passwords.hash(password),
          roleId: roles[role].id,
        },
      });
      return { ...user, password };
    };

    const hostA = await createUser('ANFITRION', 'Cristina Flores');
    const hostB = await createUser('ANFITRION', 'Carlos Mendoza');
    const colabC = await createUser('COLABORADOR', 'María Torres');

    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');

    const base = `${await app.getUrl()}/api`;
    const call = async (path, method = 'GET', body, token) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (data) {
        assert.equal(JSON.stringify(data).includes('passwordHash'), false);
      }
      return { status: response.status, data };
    };

    const tokenFor = async user =>
      (await call('/auth/login', 'POST', { email: user.email, password: user.password })).data.accessToken;

    const tokenA = await tokenFor(hostA);
    const tokenB = await tokenFor(hostB);
    const tokenC = await tokenFor(colabC);

    await t.test('1. Usuario nuevo sin proyectos obtiene métricas en 0 y listas vacías', async () => {
      const res = await call('/dashboard', 'GET', undefined, tokenA);
      assert.equal(res.status, 200);
      assert.equal(res.data.user.name, 'Cristina Flores');
      assert.equal(res.data.user.email, hostA.email);
      assert.equal(res.data.user.role, 'ANFITRION');
      assert.equal(res.data.stats.projects, 0);
      assert.equal(res.data.stats.classes, 0);
      assert.equal(res.data.stats.users, 0);
      assert.equal(res.data.stats.pendingInvitations, 0);
      assert.deepEqual(res.data.recentProjects, []);
      assert.deepEqual(res.data.recentActivity, []);
      assert.equal(res.data.systemStatus.backend, 'Operativo');
      assert.equal(res.data.systemStatus.database, 'Operativo');
    });

    await t.test('2. Seguridad: acceso sin token es rechazado y spoofing en query es ignorado', async () => {
      const noAuth = await call('/dashboard', 'GET');
      assert.equal(noAuth.status, 401);

      // Intentar spoofing de userId por query param
      const spoofed = await call(`/dashboard?userId=${hostB.id}`, 'GET', undefined, tokenA);
      assert.equal(spoofed.status, 200);
      assert.equal(spoofed.data.user.id, hostA.id);
      assert.equal(spoofed.data.user.name, 'Cristina Flores');
    });

    let projectA;
    await t.test('3. Host A crea proyecto y agrega clases UML, reflejándose en su Dashboard', async () => {
      const createdProj = await call('/projects', 'POST', { name: 'Sistema Bancario' }, tokenA);
      assert.equal(createdProj.status, 201);
      projectA = createdProj.data;

      // Crear diagrama y 2 clases UML para Host A
      const createdClass1 = await call(
        `/projects/${projectA.id}/diagram/classes`,
        'POST',
        { name: 'CuentaBancaria', x: 100, y: 100 },
        tokenA
      );
      assert.equal(createdClass1.status, 201);

      const createdClass2 = await call(
        `/projects/${projectA.id}/diagram/classes`,
        'POST',
        { name: 'Transaccion', x: 300, y: 100 },
        tokenA
      );
      assert.equal(createdClass2.status, 201);

      const dashA = await call('/dashboard', 'GET', undefined, tokenA);
      assert.equal(dashA.status, 200);
      assert.equal(dashA.data.stats.projects, 1);
      assert.equal(dashA.data.stats.classes, 2);
      assert.equal(dashA.data.stats.users, 1); // solo Host A
      assert.equal(dashA.data.recentProjects.length, 1);
      assert.equal(dashA.data.recentProjects[0].name, 'Sistema Bancario');
      assert.equal(dashA.data.recentProjects[0].classesCount, 2);
      assert.equal(dashA.data.recentProjects[0].membersCount, 1);
      assert.equal(dashA.data.recentProjects[0].isOwner, true);
      assert.ok(dashA.data.recentActivity.length >= 1);
    });

    await t.test('4. Aislamiento: Host B y Colaborador C NO ven el proyecto privado de Host A', async () => {
      const dashB = await call('/dashboard', 'GET', undefined, tokenB);
      assert.equal(dashB.status, 200);
      assert.equal(dashB.data.stats.projects, 0);
      assert.equal(dashB.data.stats.classes, 0);
      assert.deepEqual(dashB.data.recentProjects, []);
      assert.deepEqual(dashB.data.recentActivity, []);

      const dashC = await call('/dashboard', 'GET', undefined, tokenC);
      assert.equal(dashC.status, 200);
      assert.equal(dashC.data.stats.projects, 0);
      assert.equal(dashC.data.stats.classes, 0);
      assert.deepEqual(dashC.data.recentProjects, []);
      assert.deepEqual(dashC.data.recentActivity, []);
    });

    let inviteToken;
    await t.test('5. Host A invita a Colaborador C: se incrementa invitaciones pendientes', async () => {
      const inviteRes = await call(
        `/projects/${projectA.id}/invitations`,
        'POST',
        { email: colabC.email },
        tokenA
      );
      assert.equal(inviteRes.status, 201);
      inviteToken = inviteRes.data.token;

      // Host A ve 1 invitación pendiente en su proyecto
      const dashA = await call('/dashboard', 'GET', undefined, tokenA);
      assert.equal(dashA.data.stats.pendingInvitations, 1);

      // Colaborador C ve 1 invitación pendiente para él
      const dashC = await call('/dashboard', 'GET', undefined, tokenC);
      assert.equal(dashC.data.stats.pendingInvitations, 1);
    });

    await t.test('6. Colaborador C acepta invitación: el proyecto compartido aparece en su Dashboard', async () => {
      const acceptRes = await call(`/invitations/${inviteToken}/accept`, 'POST', undefined, tokenC);
      assert.equal(acceptRes.status, 201);

      // Colaborador C ahora tiene 1 proyecto accesible, 2 clases UML
      const dashC = await call('/dashboard', 'GET', undefined, tokenC);
      assert.equal(dashC.status, 200);
      assert.equal(dashC.data.stats.projects, 1);
      assert.equal(dashC.data.stats.classes, 2);
      assert.equal(dashC.data.stats.pendingInvitations, 0);
      assert.equal(dashC.data.recentProjects.length, 1);
      assert.equal(dashC.data.recentProjects[0].name, 'Sistema Bancario');
      assert.equal(dashC.data.recentProjects[0].classesCount, 2);
      assert.equal(dashC.data.recentProjects[0].isOwner, false);
      assert.equal(dashC.data.recentProjects[0].ownerName, 'Cristina Flores');

      // Actividad reciente de C incluye el ingreso al proyecto
      const memberActivity = dashC.data.recentActivity.find(a => a.type === 'MEMBER_JOINED');
      assert.ok(memberActivity, 'Debe registrar la actividad MEMBER_JOINED');
      assert.equal(memberActivity.userName, 'María Torres');

      // Host A ahora tiene 2 usuarios involucrados en sus proyectos (Host A + Colaborador C)
      const dashA = await call('/dashboard', 'GET', undefined, tokenA);
      assert.equal(dashA.data.stats.users, 2);
      assert.equal(dashA.data.stats.pendingInvitations, 0);
    });
  } finally {
    if (app) await app.close();
    if (temp) await temp.$disconnect();
    await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await root.$disconnect();
    process.env.DATABASE_URL = originalUrl;
  }
});
