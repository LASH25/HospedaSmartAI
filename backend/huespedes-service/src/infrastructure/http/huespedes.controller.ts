import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
} from '@nestjs/common';
import { ServicioHuespedes } from '../../application/servicio-huespedes';
import {
  EmailHuespedDuplicado,
  HuespedInvalido,
  HuespedNoEncontrado,
} from '../../domain/huesped';
import { ActualizarContactoDto } from './actualizar-contacto.dto';
import { CrearHuespedDto } from './crear-huesped.dto';

@Controller('huespedes')
export class HuespedesController {
  constructor(private readonly servicio: ServicioHuespedes) {}

  @Post()
  async crear(@Body() datos: CrearHuespedDto) {
    try {
      return await this.servicio.crear(datos);
    } catch (error: unknown) {
      this.manejarError(error);
    }
  }

  @Patch(':id/contacto')
  async actualizarContacto(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ActualizarContactoDto) {
    try { return await this.servicio.actualizarContacto(id, datos); }
    catch (error: unknown) { this.manejarError(error); }
  }

  @Get()
  listar() {
    return this.servicio.listar();
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
    if (error instanceof HuespedInvalido) {
      throw new BadRequestException(error.message);
    }

    if (error instanceof EmailHuespedDuplicado) {
      throw new ConflictException(error.message);
    }

    if (error instanceof HuespedNoEncontrado) {
      throw new NotFoundException(error.message);
    }

    throw error;
  }
}