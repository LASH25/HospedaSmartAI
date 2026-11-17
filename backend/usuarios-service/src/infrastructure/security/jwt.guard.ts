import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface RequestAutenticada extends Request {
  usuarioId?: string;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestAutenticada>();

    const authorization = request.headers.authorization;
    const coincidencia = authorization?.match(/^Bearer (\S+)$/i);

    if (!coincidencia) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(coincidencia[1], {
        algorithms: ['HS256'],
        issuer: 'hospedasmart-usuarios',
        audience: 'hospedasmart',
      });

      if (
        typeof payload.exp !== 'number' ||
        typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.sub,
        )
      ) {
        throw new Error('Identificador inválido.');
      }

      request.usuarioId = payload.sub;

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o vencido.');
    }
  }
}