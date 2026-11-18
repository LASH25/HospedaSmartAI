import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ServicioReservas } from '../../application/servicio-reservas';
import {
  HabitacionNoDisponible,
  HabitacionNoEncontrada,
  ServicioHabitacionesNoDisponible,
  HuespedNoEncontrado,
  ServicioHuespedesNoDisponible,
  ReservaInvalida,
  ReservaNoEncontrada,
  ReservaNoCancelable,
} from '../../domain/reserva';
import { CrearReservaDto } from './crear-reserva.dto';

@Controller('reservas')
export class ReservasController {
  constructor(private readonly servicio: ServicioReservas) {}

  @Post()
  async crear(@Body() datos: CrearReservaDto) {
    try {
      return await this.servicio.crear(datos);
    } catch (error: unknown) {
      this.manejarError(error);
    }
  }

  @Get()
  listar() {
    return this.servicio.listar();
  }

  @Patch(':id/cancelar')
  async cancelar(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.servicio.cancelar(id);
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
      error instanceof HabitacionNoEncontrada ||
      error instanceof HuespedNoEncontrado ||
      error instanceof ReservaNoEncontrada
    ) {
      throw new NotFoundException(error.message);
    }

    if (
      error instanceof HabitacionNoDisponible ||
      error instanceof ReservaNoCancelable
    ) {
      throw new ConflictException(error.message);
    }

    if (error instanceof ReservaInvalida) {
      throw new BadRequestException(error.message);
    }

    if (
      error instanceof ServicioHabitacionesNoDisponible ||
      error instanceof ServicioHuespedesNoDisponible
    ) {
      throw new ServiceUnavailableException(error.message);
    }

    throw error;
  }
}