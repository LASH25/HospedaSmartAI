import { Body, Controller, Post } from '@nestjs/common';
import { ServicioAsistente } from '../../application/servicio-asistente';
import { BuscarConocimientosDto } from './buscar-conocimientos.dto';

@Controller('asistente')
export class AsistenteController {
  constructor(
    private readonly servicio: ServicioAsistente,
  ) {}

  @Post('preguntar')
  preguntar(@Body() datos: BuscarConocimientosDto) {
    return this.servicio.preguntar(datos.pregunta);
  }
}