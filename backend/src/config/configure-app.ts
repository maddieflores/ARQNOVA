import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { SocketAdapter } from './socket.adapter';

// La aplicación y las pruebas HTTP comparten la misma configuración.
export function configureApplication(app: INestApplication): void {
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  const origin = app.get(ConfigService).getOrThrow<string>('CORS_ORIGIN');
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new SocketAdapter(app, origin));
}
