const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module');
const { configureApplication } = require('../dist/config/configure-app');
const { PrismaService } = require('../dist/prisma/prisma.service');

test('CU-REG: Registro de nuevos usuarios y seguridad', async t => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApplication(app);
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api`;
  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService);
  const ids = [];

  const request = async (path, { body, token, method } = {}) => {
    const headers = { 'Content-Type': 'application/json', Origin: config.get('CORS_ORIGIN') };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  };

  try {
    let createdUser;
    const testEmail = `reg-${randomUUID()}@example.test`;
    const testPassword = `PasswordSegura123#${randomBytes(4).toString('hex')}`;

    await t.test('1. Registro exitoso asigna rol ANFITRION, responde 201 y no expone passwordHash', async () => {
      const result = await request('/auth/register', {
        body: {
          name: '  Usuario Registrado  ',
          email: `  ${testEmail.toUpperCase()}  `,
          password: testPassword,
          passwordConfirmation: testPassword,
        },
      });

      assert.equal(result.status, 201);
      assert.equal(typeof result.data.message, 'string');
      assert.equal(result.data.user.name, 'Usuario Registrado');
      assert.equal(result.data.user.email, testEmail);
      assert.equal(result.data.user.role.name, 'ANFITRION');
      assert.equal(Object.hasOwn(result.data, 'passwordHash'), false);
      assert.equal(Object.hasOwn(result.data.user, 'passwordHash'), false);
      assert.equal(result.headers.get('cache-control'), 'no-store');

      createdUser = result.data.user;
      ids.push(createdUser.id);

      // Verificar que en base de datos la contraseña esté hasheada con bcrypt
      const dbUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
      assert.ok(dbUser);
      assert.ok(dbUser.passwordHash.startsWith('$2'));
      assert.notEqual(dbUser.passwordHash, testPassword);
    });

    await t.test('2. Inicio de sesión exitoso con el usuario registrado', async () => {
      const loginResult = await request('/auth/login', {
        body: { email: testEmail, password: testPassword },
      });
      assert.equal(loginResult.status, 200);
      assert.equal(typeof loginResult.data.accessToken, 'string');
      assert.equal(loginResult.data.user.id, createdUser.id);
      assert.equal(loginResult.data.user.role.name, 'ANFITRION');
    });

    await t.test('3. Rechazo de email duplicado con código 409', async () => {
      const duplicateResult = await request('/auth/register', {
        body: {
          name: 'Otro Usuario',
          email: testEmail,
          password: testPassword,
          passwordConfirmation: testPassword,
        },
      });
      assert.equal(duplicateResult.status, 409);
      assert.equal(duplicateResult.data.message, 'El email ya está registrado');
    });

    await t.test('4. Rechazo cuando las contraseñas no coinciden con 400', async () => {
      const mismatch = await request('/auth/register', {
        body: {
          name: 'Mismatch',
          email: `mismatch-${randomUUID()}@example.test`,
          password: testPassword,
          passwordConfirmation: 'OtraPasswordDistinta123#',
        },
      });
      assert.equal(mismatch.status, 400);
      assert.equal(mismatch.data.message, 'Las contraseñas no coinciden');
    });

    await t.test('5. Rechazo de contraseñas que no cumplen la política de seguridad con 400', async () => {
      const short = await request('/auth/register', {
        body: {
          name: 'Corta',
          email: `short-${randomUUID()}@example.test`,
          password: 'abc',
          passwordConfirmation: 'abc',
        },
      });
      assert.equal(short.status, 400);
    });

    await t.test('6. Rechazo de inyección de rol (ADMINISTRADOR) o propiedades no permitidas con 400', async () => {
      const injection = await request('/auth/register', {
        body: {
          name: 'Hacker',
          email: `hacker-${randomUUID()}@example.test`,
          password: testPassword,
          passwordConfirmation: testPassword,
          role: 'ADMINISTRADOR',
          roleId: randomUUID(),
          isActive: false,
        },
      });
      assert.equal(injection.status, 400);
    });
  } finally {
    if (ids.length) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  }
});
