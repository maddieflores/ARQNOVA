import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { PasswordService } from '../common/security/password.service';
import { validateDto } from '../common/validate-dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SystemRole } from '../roles/system-role';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from './auth-user';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash = '';

  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Evita que el tiempo de bcrypt revele si el email existe o si la cuenta está inactiva.
    this.dummyPasswordHash = await this.passwords.hash(randomBytes(32).toString('hex'));
  }

  async register(input: RegisterDto) {
    const dto = validateDto(RegisterDto, input);
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('El email ya está registrado');
    }
    const role = await this.roles.findByName(SystemRole.ANFITRION);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      roleId: role.id,
      isActive: true,
    });
    return {
      message: 'Cuenta creada correctamente. Ahora puedes iniciar sesión.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: { id: user.role.id, name: user.role.name },
      },
    };
  }

  async login(input: LoginDto) {
    const dto = validateDto(LoginDto, input);
    const credentials = await this.users.findCredentialsByEmail(dto.email);
    const passwordHash = credentials?.passwordHash ?? this.dummyPasswordHash;
    const passwordMatches = await this.passwords.compare(dto.password, passwordHash);
    if (!credentials || !credentials.isActive || !passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const user = await this.currentUser(credentials.id);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role.name });
    return { accessToken, user };
  }

  async authenticate(token: string): Promise<AuthUser> {
    let payload: { sub?: unknown };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      if (!payload || typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')) throw new Error('Invalid subject');
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    return this.currentUser(payload.sub as string);
  }

  private async currentUser(id: string): Promise<AuthUser> {
    let user;
    try { user = await this.users.findById(id); }
    catch (error) {
      if (error instanceof NotFoundException) throw new UnauthorizedException('Sesión inválida o expirada');
      throw error;
    }
    if (!user.isActive) throw new UnauthorizedException('Sesión inválida o expirada');
    return { id: user.id, name: user.name, email: user.email, isActive: user.isActive, role: { id: user.role.id, name: user.role.name } };
  }
}
