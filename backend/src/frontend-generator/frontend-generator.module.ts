import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { FrontendGeneratorController } from './frontend-generator.controller';
import { FrontendGeneratorService } from './frontend-generator.service';

@Module({
  imports: [AuthModule, PrismaModule, ProjectsModule],
  controllers: [FrontendGeneratorController],
  providers: [FrontendGeneratorService],
  exports: [FrontendGeneratorService],
})
export class FrontendGeneratorModule {}
