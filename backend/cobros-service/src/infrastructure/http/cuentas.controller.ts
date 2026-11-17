import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ServicioCuentas } from '../../application/servicio-cuentas';
import {
  CuentaNoEncontrada,
  ReservaCuentaNoEncontrada,
  ReservaNoFacturable,
  HuespedCuentaNoEncontrado,
  ServicioReservasNoDisponible,
  ServicioHuespedesNoDisponible,
} from '../../domain/cuenta';
import { AbrirCuentaDto } from './abrir-cuenta.dto';

@Controller('cuentas')
export class CuentasController {
  constructor(private readonly servicio: ServicioCuentas) {}

  @Post('abrir')
  @HttpCode(200)
  async abrir(@Body() datos: AbrirCuentaDto) {
    try {
      return await this.servicio.abrir(datos.reserva_id);
    } catch (error: unknown) {
      this.manejarError(error);
    }
  }

  @Get(':id')
  async buscarPorId(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.servicio.buscarPorId(id);
    } catch (error: unknown) {
      this.manejarError(error);
    }
  }

  private manejarError(error: unknown): never {
    if (
      error instanceof CuentaNoEncontrada ||
      error instanceof ReservaCuentaNoEncontrada ||
      error instanceof HuespedCuentaNoEncontrado
    ) {
      throw new NotFoundException(error.message);
    }

    if (error instanceof ReservaNoFacturable) {
      throw new ConflictException(error.message);
    }

    if (error instanceof ServicioReservasNoDisponible || error instanceof ServicioHuespedesNoDisponible) {
      throw new ServiceUnavailableException(error.message);
    }

    throw error;
  }
}