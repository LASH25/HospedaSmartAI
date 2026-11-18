import { Controller, Get, Query } from '@nestjs/common';
import { ServicioConocimientos } from '../../application/servicio-conocimientos';
import { BuscarConocimientosDto } from './buscar-conocimientos.dto';

@Controller('conocimientos')
export class ConocimientosController {
  constructor(
    private readonly servicio: ServicioConocimientos,
  ) {}

  @Get('buscar')
  async buscar(@Query() datos: BuscarConocimientosDto) {
    const fuentes = await this.servicio.buscar(datos.pregunta);

    return {
      pregunta: datos.pregunta,
      encontrados: fuentes.length,
      fuentes,
    };
  }
}