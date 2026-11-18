import { UsuariosController } from './http/usuarios.controller';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import { ServicioAuth } from '../application/servicio-auth';
import { USUARIOS_REPOSITORY } from '../application/ports/usuarios.repository';
import type { UsuariosRepository } from '../application/ports/usuarios.repository';
import { CLAVES_SERVICE } from '../application/ports/claves.service';
import type { ClavesService } from '../application/ports/claves.service';
import { MysqlUsuariosRepository } from './database/mysql-usuarios.repository';
import { ScryptClavesService } from './security/scrypt-claves.service';
import { AuthController } from './http/auth.controller';
import { JwtGuard } from './security/jwt.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');

        if (secret.length < 32) {
          throw new Error(
            'JWT_SECRET debe tener al menos 32 caracteres.',
          );
        }

        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: 3600,
            issuer: 'hospedasmart-usuarios',
            audience: 'hospedasmart',
          },
        };
      },
    }),
  ],
  controllers: [AuthController, UsuariosController],
    providers: [
    ThrottlerGuard,
    JwtGuard,
    MysqlUsuariosRepository,
    ScryptClavesService,
    {
      provide: USUARIOS_REPOSITORY,
      useExisting: MysqlUsuariosRepository,
    },
    {
      provide: CLAVES_SERVICE,
      useExisting: ScryptClavesService,
    },
    {
      provide: ServicioAuth,
      inject: [USUARIOS_REPOSITORY, CLAVES_SERVICE],
      useFactory: (
        usuarios: UsuariosRepository,
        claves: ClavesService,
      ) => new ServicioAuth(usuarios, claves),
    },
  ],
})
export class UsuariosModule {}