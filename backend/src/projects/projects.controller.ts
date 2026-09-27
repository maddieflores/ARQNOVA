import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { SystemRole } from '../roles/system-role';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ANFITRION)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListProjectsDto) {
    return this.projects.listByOwner(request.user!.id, query);
  }

  @Get('stats')
  stats(@Req() request: AuthenticatedRequest) {
    return this.projects.getStats(request.user!.id);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.verifyOwner(id, request.user!.id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return this.projects.create(request.user!.id, dto);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, request.user!.id, dto);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projects.remove(id, request.user!.id);
  }
}
