import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/validate-env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './common/health.controller';
import { CollaborationGateway } from './collaboration/collaboration.gateway';
import { AuthModule } from './auth/auth.module';
import { AdministrationModule } from './administration/administration.module';
import { ProjectsModule } from './projects/projects.module';
import { UmlModule } from './uml/uml.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { AiModule } from './ai/ai.module';
import { XmiModule } from './xmi/xmi.module';
import { CodeGeneratorModule } from './code-generator/code-generator.module';
import { FrontendGeneratorModule } from './frontend-generator/frontend-generator.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, AuthModule, AdministrationModule, ProjectsModule, UmlModule, CollaborationModule, AiModule, XmiModule, CodeGeneratorModule, FrontendGeneratorModule, DashboardModule],
  controllers: [HealthController],
  providers: [CollaborationGateway],
})
export class AppModule {}
