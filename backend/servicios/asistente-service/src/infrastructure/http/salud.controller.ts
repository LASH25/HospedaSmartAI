import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('salud')
export class SaludController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async consultar() {
    const filas = await this.dataSource.query<
      { base_datos: string; version: string }[]
    >(
      'SELECT DATABASE() AS base_datos, VERSION() AS version',
    );

    return {
      servicio: 'asistente',
      estado: 'ok',
      motor: 'mysql',
      base_datos: filas[0]?.base_datos,
      version: filas[0]?.version,
    };
  }
}