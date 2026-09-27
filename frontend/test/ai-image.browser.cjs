const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

process.loadEnvFile(path.resolve('../backend/.env'));
process.loadEnvFile(path.resolve('.env'));
const tempDir = path.resolve('../.verification/browser-temp');
fs.mkdirSync(tempDir, { recursive: true });
process.env.TEMP = tempDir;
process.env.TMP = tempDir;

const { chromium } = require('playwright');
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const { PasswordService } = require('../../backend/dist/common/security/password.service');
const WEB = process.env.CORS_ORIGIN || 'http://127.0.0.1:5173';
const privateValues = [process.env.ADMIN_PASSWORD, process.env.JWT_SECRET];

(async () => {
  const prisma = new PrismaClient();
  let browser;
  let project;
  const userIds = [];
  const fixtureImagePath = path.join(tempDir, `uml-sample-${randomUUID().slice(0, 8)}.png`);

  try {
    // 1x1 dummy PNG buffer for testing
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    fs.writeFileSync(fixtureImagePath, Buffer.from(samplePngBase64, 'base64'));

    const roles = Object.fromEntries((await prisma.role.findMany()).map(role => [role.name, role.id]));
    const createUser = async (role, name) => {
      const password = randomBytes(24).toString('hex');
      privateValues.push(password);
      const user = await prisma.user.create({
        data: {
          name,
          email: `${randomUUID()}@example.test`,
          passwordHash: await new PasswordService().hash(password),
          roleId: roles[role],
        },
      });
      userIds.push(user.id);
      return { ...user, password };
    };

    const host = await createUser('ANFITRION', 'Anfitrión Imagen');
    project = await prisma.project.create({
      data: {
        name: `IMAGE-${randomUUID().slice(0, 8)}`,
        ownerId: host.id,
      },
    });

    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        errors.push(message.text());
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/ai/')) {
        const text = await response.text().catch(() => '');
        console.log(`[HTTP ${response.status()}] ${response.url()} -> ${text}`);
      }
    });


    // 1. Iniciar sesión
    await page.goto(`${WEB}/login`);
    await page.getByLabel('Email', { exact: true }).fill(host.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(host.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(`${WEB}/dashboard`);

    // 2. Generar imagen PNG de diagrama UML nítida con Canvas en el navegador
    const diagramPngBase64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 380;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Fondo blanco
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1E293B';
      ctx.fillStyle = '#0F172A';
      ctx.lineWidth = 2.5;

      // Caja Cliente
      ctx.strokeRect(50, 70, 220, 160);
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText('Cliente', 120, 105);

      ctx.beginPath();
      ctx.moveTo(50, 120);
      ctx.lineTo(270, 120);
      ctx.stroke();

      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('- id: Long', 65, 155);
      ctx.fillText('- nombre: String', 65, 190);

      // Caja Pedido
      ctx.strokeRect(430, 70, 220, 160);
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText('Pedido', 505, 105);

      ctx.beginPath();
      ctx.moveTo(430, 120);
      ctx.lineTo(650, 120);
      ctx.stroke();

      ctx.font = '16px Arial, sans-serif';
      ctx.fillText('- id: Long', 445, 155);
      ctx.fillText('- total: Decimal', 445, 190);

      // Relación Cliente --- Pedido
      ctx.beginPath();
      ctx.moveTo(270, 150);
      ctx.lineTo(430, 150);
      ctx.stroke();

      // Multiplicidades
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillText('1', 285, 140);
      ctx.fillText('0..*', 385, 140);

      return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    });

    fs.writeFileSync(fixtureImagePath, Buffer.from(diagramPngBase64, 'base64'));

    // 3. Navegar a la pantalla de IA
    await page.goto(`${WEB}/projects/${project.id}/ai-proposal`);
    await page.getByRole('heading', { name: 'Propuesta UML mediante IA' }).waitFor();

    // 4. Verificar botón de analizar imagen visible
    const imgButton = page.getByRole('button', { name: 'Analizar imagen UML' });
    await imgButton.waitFor();
    console.log('✓ Botón de analizar imagen visible en estado inicial.');

    // 5. Seleccionar archivo de imagen UML generado
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(fixtureImagePath);


    // 5. Verificar estado de imagen seleccionada (vista previa y nombre de archivo)
    await page.getByText('Imagen UML seleccionada').waitFor();
    await page.getByRole('button', { name: 'Eliminar imagen seleccionada' }).waitFor();
    console.log('✓ Vista previa de imagen y metadatos mostrados correctamente.');

    // 6. Enviar a analizar con IA
    await page.getByRole('button', { name: 'Generar propuesta' }).click();

    // 7. Verificar propuesta estructurada generada y validada
    await page.getByText('Propuesta validada').waitFor();
    await page.getByText('Cliente').first().waitFor();
    await page.getByText('Pedido').first().waitFor();
    console.log('✓ Propuesta estructurada generada por Gemini / IA a partir de la imagen recibida con éxito.');

    // 8. Aplicar cambios
    await page.getByRole('button', { name: 'Aplicar al diagrama' }).click();
    await page.getByText('Cambios aplicados y persistidos correctamente en PostgreSQL.').waitFor();
    console.log('✓ Cambios aplicados correctamente.');

    // 9. Verificar en el editor UML y en base de datos
    await page.getByRole('link', { name: 'Ver en editor UML' }).click();
    await page.waitForURL(`${WEB}/projects/${project.id}/editor`);
    await page.getByText('Realtime: conectado').waitFor();

    await page.locator('.react-flow__node').filter({ hasText: 'Cliente' }).waitFor();
    await page.locator('.react-flow__node').filter({ hasText: 'Pedido' }).waitFor();
    console.log('✓ Clases Cliente y Pedido renderizadas en el editor UML.');

    // 10. Verificar persistencia en PostgreSQL
    const dbDiagram = await prisma.diagram.findFirst({
      where: { projectId: project.id },
      include: { classes: { include: { attributes: true } }, relations: true },
    });
    assert.ok(dbDiagram, 'El diagrama debe existir');
    assert.equal(dbDiagram.classes.length, 2, 'Deben existir 2 clases persistidas');
    assert.equal(dbDiagram.relations.length, 1, 'Debe existir 1 relación persistida');

    assert.deepEqual(errors, [], 'No deben existir errores de consola ni JavaScript');
    console.log('✓ Prueba funcional obligatoria de edición/generación UML mediante imagen completada con éxito.');
  } finally {
    if (fs.existsSync(fixtureImagePath)) {
      try { fs.unlinkSync(fixtureImagePath); } catch {}
    }
    if (project) {
      await prisma.umlRelation.deleteMany({ where: { diagram: { projectId: project.id } } });
      await prisma.umlAttribute.deleteMany({ where: { umlClass: { diagram: { projectId: project.id } } } });
      await prisma.umlClass.deleteMany({ where: { diagram: { projectId: project.id } } });
      await prisma.diagram.deleteMany({ where: { projectId: project.id } });
      await prisma.project.deleteMany({ where: { id: project.id } });
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    if (browser) await browser.close();
  }
})().catch(error => {
  let message = error.message;
  for (const value of privateValues.filter(Boolean)) {
    message = message.split(value).join('[REDACTADO]');
  }
  console.error('Prueba de imagen UML falló:', message);
  process.exitCode = 1;
});
