import type { PeticionAutorizada } from '../security/permisos.guard';
import {
  BadRequestException,
  Body,
  Req,
  ForbiddenException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ServicioHabitaciones } from '../../application/servicio-habitaciones';
import {
  HabitacionInvalida,
  HabitacionOcupada,
  EstadoHabitacionNoPermitido,
  HabitacionNoEncontrada,
  NumeroHabitacionDuplicado,
} from '../../domain/habitacion';
import { CrearHabitacionDto } from './crear-habitacion.dto';
import { CambiarEstadoDto } from './cambiar-estado.dto';

@Controller('habitaciones')
export class HabitacionesController {
  constructor(
    private readonly servicio: ServicioHabitaciones,
  ) {}

  @Get()
  listar() {
    return this.servicio.listar();
  }

  @Post()
  async crear(@Body() datos: CrearHabitacionDto, @Req() req: PeticionAutorizada) {
    try {
      if (req.perfilAutorizado?.rol !== 'administrador') throw new ForbiddenException('Solo administración puede crear habitaciones.');
      return await this.servicio.crear(datos);
    } catch (error: unknown) {
      this.manejarError(error);
    }
  }

  @Patch(':id/estado')
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() datos: CambiarEstadoDto,
    @Req() req: PeticionAutorizada,
  ) {
    try {
      if (req.perfilAutorizado?.rol === 'limpieza') {
        const actual = await this.servicio.buscarPorId(id);
        if (actual.estado_operativo === 'mantenimiento') throw new ForbiddenException('Solo recepción o administración puede retirar mantenimiento.');
      }
      return await this.servicio.cambiarEstado(
        id,
        datos.estado_operativo,
        req.perfilAutorizado?.rol !== 'limpieza',
      );
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
    if (error instanceof HabitacionOcupada) throw new ConflictException(error.message);
    if (error instanceof EstadoHabitacionNoPermitido) throw new ForbiddenException(error.message);
    if (error instanceof HabitacionInvalida) {
      throw new BadRequestException(error.message);
    }

    if (error instanceof NumeroHabitacionDuplicado) {
      throw new ConflictException(error.message);
    }

    if (error instanceof HabitacionNoEncontrada) {
      throw new NotFoundException(error.message);
    }

    throw error;
  }
}