const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs'); const path = require('node:path');
process.loadEnvFile(path.resolve('../backend/.env')); process.loadEnvFile(path.resolve('.env'));
const tempDir = path.resolve('../.verification/browser-temp'); fs.mkdirSync(tempDir, { recursive: true }); process.env.TEMP = tempDir; process.env.TMP = tempDir;
const { chromium } = require('playwright'); const { PrismaClient } = require('../../backend/node_modules/@prisma/client'); const { PasswordService } = require('../../backend/dist/common/security/password.service');
const API = process.env.VITE_API_URL; const WEB = process.env.CORS_ORIGIN; const privateValues = [process.env.ADMIN_PASSWORD, process.env.JWT_SECRET];

(async () => {
 const prisma = new PrismaClient(); let browser; const userIds = []; let project;
 try {
  const roles = Object.fromEntries((await prisma.role.findMany()).map(role => [role.name, role.id]));
  const createUser = async role => { const password = randomBytes(24).toString('hex'); privateValues.push(password); const user = await prisma.user.create({ data: { name: `CU04 ${role}`, email: `${randomUUID()}@example.test`, passwordHash: await new PasswordService().hash(password), roleId: roles[role] } }); userIds.push(user.id); return { ...user, password }; };
  const host = await createUser('ANFITRION'); const collaborator = await createUser('COLABORADOR'); project = await prisma.project.create({ data: { name: `Proyecto CU04 ${randomUUID().slice(0, 8)}`, description: 'Participación de prueba', ownerId: host.id } });
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', item => { if (item.type() === 'error' && !item.text().includes('Failed to load resource')) errors.push(item.text()); }); page.on('dialog', dialog => dialog.accept());
  const login = async account => { await page.goto(`${WEB}/login`); await page.getByLabel('Email', { exact: true }).fill(account.email); await page.getByLabel('Contraseña', { exact: true }).fill(account.password); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); await page.waitForURL(`${WEB}/dashboard`); };
  const logout = async () => { await page.goto(`${WEB}/dashboard`); await page.getByRole('button', { name: 'Cerrar sesión' }).click(); await page.waitForURL(`${WEB}/login`); };
  await login(host); await page.goto(`${WEB}/projects/${project.id}`); await page.getByRole('link', { name: 'Gestionar participantes', exact: true }).click(); await page.waitForURL(`${WEB}/projects/${project.id}/participants`);
  await page.getByRole('heading', { name: `Participantes de ${project.name}`, exact: true }).waitFor(); await page.getByText('Aún no hay participantes.', { exact: true }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill(collaborator.email.toUpperCase());
  const creation = page.waitForResponse(response => response.url() === `${API}/projects/${project.id}/invitations` && response.request().method() === 'POST'); await page.getByRole('button', { name: 'Crear invitación', exact: true }).click(); const createdResponse = await creation; assert.equal(createdResponse.status(), 201);
  const invitationUrl = await page.getByLabel('Enlace de invitación').inputValue(); privateValues.push(invitationUrl.split('/').at(-1)); assert.match(invitationUrl, /\/invitations\/[A-Za-z0-9_-]{43}$/);
  await page.getByText(collaborator.email, { exact: true }).waitFor(); await page.getByText(/PENDING/).waitFor(); console.log('ANFITRION crea invitación y visualiza estado pendiente sin token persistido en la lista.');
  await page.getByLabel('Email', { exact: true }).fill(collaborator.email); await page.getByRole('button', { name: 'Crear invitación', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Ya existe una invitación vigente' }).waitFor(); console.log('Invitación duplicada muestra error controlado.');
  await logout(); await login(collaborator); await page.goto(invitationUrl); await page.getByRole('heading', { name: 'Invitación a proyecto', exact: true }).waitFor(); await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aceptar invitación', exact: true }).click(); await page.getByRole('heading', { name: 'Invitación aceptada', exact: true }).waitFor(); assert.equal(await prisma.projectMember.count({ where: { projectId: project.id, userId: collaborator.id } }), 1);
  await page.getByRole('link', { name: 'Ver proyectos compartidos', exact: true }).click(); await page.waitForURL(`${WEB}/shared-projects`); await page.getByRole('heading', { name: project.name, exact: true }).waitFor(); console.log('COLABORADOR acepta y ve el proyecto compartido sin controles administrativos.');
  await logout(); await login(host); await page.goto(`${WEB}/projects/${project.id}/participants`); const member = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Retirar', exact: true }) }).filter({ hasText: collaborator.email }); await member.waitFor(); await member.getByRole('button', { name: 'Retirar', exact: true }).click(); await page.getByText('Aún no hay participantes.', { exact: true }).waitFor(); assert.equal(await prisma.projectMember.count({ where: { projectId: project.id, userId: collaborator.id } }), 0); console.log('ANFITRION ve y retira al participante con confirmación.');
  assert.deepEqual(errors, []); console.log('Flujo CU04 completo y consola JavaScript sin errores.');
 } finally {
  if (project) { await prisma.diagram.deleteMany({ where: { projectId: project.id } }); await prisma.project.deleteMany({ where: { id: project.id } }); } if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }); await prisma.$disconnect(); if (browser) await browser.close();
 }
})().catch(error => { let message = error.message; for (const value of privateValues.filter(Boolean)) message = message.split(value).join('[REDACTADO]'); console.error('Prueba CU04 frontend falló:', message); process.exitCode = 1; });
