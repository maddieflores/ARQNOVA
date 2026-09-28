import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PasswordService } from '../common/security/password.service';
import { PrismaService } from './prisma.service';
import { seedDevelopment } from './development-seed';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const config = app.get(ConfigService);
    if (config.get<string>('NODE_ENV') !== 'production') {
      throw new Error('El bootstrap administrativo requiere NODE_ENV=production');
    }
    if (config.get<string>('ADMIN_BOOTSTRAP_ENABLED') !== 'true') {
      throw new Error('El bootstrap administrativo no está habilitado');
    }

    const name = config.get<string>('ADMIN_NAME');
    const email = config.get<string>('ADMIN_EMAIL');
    const password = config.get<string>('ADMIN_PASSWORD');
    if (!name || !email || !password) {
      throw new Error('Configure ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD');
    }

    const result = await seedDevelopment(app.get(PrismaService), app.get(PasswordService), { name, email, password });
    console.log(`Bootstrap administrativo correcto: ${result.roleCount} roles y administrador ${result.adminId} verificados.`);
  } finally {
    await app.close();
  }
}

main().catch(() => {
  new Logger('ProductionBootstrap').error(
    'Bootstrap no ejecutado: revise las guardias, la conexión, las variables ADMIN_* y el estado del administrador.',
  );
  process.exitCode = 1;
});
