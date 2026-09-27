import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    if (!isUUID(id, '4')) throw new BadRequestException('ID de rol inválido');
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol inexistente');
    return role;
  }

  async findByName(name: string) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new NotFoundException(`Rol '${name}' inexistente`);
    return role;
  }
}
