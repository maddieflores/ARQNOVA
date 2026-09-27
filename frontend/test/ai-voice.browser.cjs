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

  try {
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

    const host = await createUser('ANFITRION', 'Anfitrión Voz');
    project = await prisma.project.create({
      data: {
        name: `VOICE-${randomUUID().slice(0, 8)}`,
        ownerId: host.id,
      },
    });

    // Crear diagrama base: Cliente y Pedido con relación Cliente -> Pedido
    const diagram = await prisma.diagram.create({
      data: {
        projectId: project.id,
        name: 'Diagrama Principal',
      },
    });

    const clienteClass = await prisma.umlClass.create({
      data: {
        diagramId: diagram.id,
        name: 'Cliente',
        x: 100,
        y: 100,
        attributes: {
          create: [
            { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true, position: 0 },
            { name: 'nombre', type: 'String', visibility: 'PRIVATE', isPrimaryKey: false, position: 1 },
          ],
        },
      },
      include: { attributes: true },
    });

    const pedidoClass = await prisma.umlClass.create({
      data: {
        diagramId: diagram.id,
        name: 'Pedido',
        x: 400,
        y: 100,
        attributes: {
          create: [
            { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true, position: 0 },
            { name: 'total', type: 'Decimal', visibility: 'PRIVATE', isPrimaryKey: false, position: 1 },
          ],
        },
      },
      include: { attributes: true },
    });

    await prisma.umlRelation.create({
      data: {
        diagramId: diagram.id,
        sourceClassId: clienteClass.id,
        targetClassId: pedidoClass.id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
        label: 'realiza',
      },
    });

    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ['microphone'],
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        errors.push(message.text());
      }
    });

    // Iniciar sesión
    await page.goto(`${WEB}/login`);
    await page.getByLabel('Email', { exact: true }).fill(host.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(host.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(`${WEB}/dashboard`);

    // Inyectar Mock de Web Speech API SpeechRecognition en el contexto del navegador
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = 'es-ES';
          this.continuous = false;
          this.interimResults = true;
          this.maxAlternatives = 1;
          this.onstart = null;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__mockSpeechInstance = this;
        }

        start() {
          if (this.onstart) this.onstart(new Event('start'));
        }

        stop() {
          if (this.onend) this.onend(new Event('end'));
        }

        abort() {
          if (this.onend) this.onend(new Event('end'));
        }

        simulateVoiceInput(transcript, isFinal = true) {
          if (this.onresult) {
            const event = {
              resultIndex: 0,
              results: [
                Object.assign(
                  [
                    {
                      transcript: transcript,
                      confidence: 0.98,
                    },
                  ],
                  { isFinal }
                ),
              ],
            };
            this.onresult(event);
          }
          if (isFinal && this.onend) {
            this.onend(new Event('end'));
          }
        }
      }

      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    // Navegar a la pantalla de IA
    await page.goto(`${WEB}/projects/${project.id}/ai-proposal`);
    await page.getByRole('heading', { name: 'Propuesta UML mediante IA' }).waitFor();

    // 1. Verificar botón de micrófono visible e inactivo
    const micButton = page.getByRole('button', { name: 'Hablar instrucción' });
    await micButton.waitFor();
    console.log('✓ Botón de micrófono visible e inactivo en estado inicial.');

    // 2. Pulsar botón de micrófono para iniciar escucha
    await micButton.click();
    await page.getByText('Micrófono activo').waitFor();
    console.log('✓ Estado visual "Escuchando" activado correctamente.');

    // 3. Simular entrada de voz: "Agrega un atributo teléfono de tipo String a la clase Cliente"
    const spokenText = 'Agrega un atributo teléfono de tipo String a la clase Cliente';
    await page.evaluate((text) => {
      if (window.__mockSpeechInstance) {
        window.__mockSpeechInstance.simulateVoiceInput(text, true);
      }
    }, spokenText);

    // 4. Verificar que el texto reconocido aparece en el textarea existente
    const textarea = page.getByLabel('Describir modelo UML');
    await page.waitForFunction(
      (expected) => {
        const el = document.getElementById('ai-prompt');
        return el && el.value.includes(expected);
      },
      'Agrega un atributo teléfono de tipo String a la clase Cliente'
    );
    const textareaValue = await textarea.inputValue();
    assert.ok(
      textareaValue.includes('Agrega un atributo teléfono de tipo String a la clase Cliente'),
      'El texto reconocido debe poblar el textarea de edición con IA'
    );
    console.log('✓ Voz convertida a texto e insertada en el textarea existente:', textareaValue);

    // 5. El usuario puede editar el texto si lo desea
    await textarea.fill('Agrega un atributo telefono de tipo String a la clase Cliente');

    // 6. Generar propuesta con IA reutilizando el flujo existente
    await page.getByRole('button', { name: 'Generar propuesta' }).click();

    // 7. Verificar "Propuesta validada" y la acción ADD_ATTRIBUTE
    await page.getByText('Propuesta validada').waitFor();
    await page.getByText('+ Atributo').waitFor();
    await page.getByText('Cliente').first().waitFor();
    await page.getByText('telefono: String').waitFor();
    console.log('✓ Propuesta validada recibida con acción ADD_ATTRIBUTE (Cliente -> telefono: String).');

    // 8. Aplicar cambios
    await page.getByRole('button', { name: 'Aplicar al diagrama' }).click();
    await page.getByText('Cambios aplicados y persistidos correctamente en PostgreSQL.').waitFor();
    console.log('✓ Propuesta aplicada exitosamente.');

    // 9. Verificar en el editor UML y en la base de datos
    await page.getByRole('link', { name: 'Ver en editor UML' }).click();
    await page.waitForURL(`${WEB}/projects/${project.id}/editor`);
    await page.getByText('Realtime: conectado').waitFor();

    // Comprobar nodo Cliente con nuevo atributo telefono
    await page.locator('.react-flow__node').filter({ hasText: 'Cliente' }).filter({ hasText: 'telefono: String' }).waitFor();
    // Comprobar que Pedido sigue intacto con total: Decimal
    await page.locator('.react-flow__node').filter({ hasText: 'Pedido' }).filter({ hasText: 'total: Decimal' }).waitFor();

    // Verificar en base de datos PostgreSQL
    const clienteDb = await prisma.umlClass.findFirst({
      where: { diagramId: diagram.id, name: 'Cliente' },
      include: { attributes: true },
    });
    const pedidoDb = await prisma.umlClass.findFirst({
      where: { diagramId: diagram.id, name: 'Pedido' },
      include: { attributes: true },
    });

    const hasTelefono = clienteDb.attributes.some(a => a.name.toLowerCase() === 'telefono' && a.type === 'String');
    assert.ok(hasTelefono, 'La clase Cliente debe tener el atributo telefono: String persistido en PostgreSQL');
    assert.equal(pedidoDb.attributes.length, 2, 'La clase Pedido debe permanecer intacta');

    assert.deepEqual(errors, [], 'No deben existir errores de consola ni JavaScript');
    console.log('✓ Prueba funcional obligatoria de edición UML mediante voz completada exitosamente.');
  } finally {
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
  console.error('Prueba de edición UML mediante voz falló:', message);
  process.exitCode = 1;
});
