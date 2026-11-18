import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ServicioAuth } from '../../application/servicio-auth';
import { CredencialesInvalidas } from '../../domain/usuario';
import { JwtGuard } from '../security/jwt.guard';
import type { RequestAutenticada } from '../security/jwt.guard';
import { LoginDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly servicio: ServicioAuth,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(@Body() datos: LoginDto) {
    try {
      const usuario = await this.servicio.iniciarSesion(
        datos.email,
        datos.password,
      );

      const token = await this.jwt.signAsync({
        sub: usuario.id,
        rol: usuario.rol,
      });

      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        usuario,
      };
    } catch (error: unknown) {
      if (error instanceof CredencialesInvalidas) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async perfil(@Req() request: RequestAutenticada) {
    if (!request.usuarioId) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    try {
      return await this.servicio.consultarPerfil(
        request.usuarioId,
      );
    } catch (error: unknown) {
      if (error instanceof CredencialesInvalidas) {
        throw new UnauthorizedException(error.message);
      }

      throw error;
    }
  }
}