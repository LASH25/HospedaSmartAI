import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Controller('salud')
export class SaludController {
  constructor(private readonly db: DataSource) {}
  @Get()
  async consultar() {
    const filas = await this.db.query<{ base_datos: string }[]>('SELECT DATABASE() AS base_datos');
    return { servicio: 'cobros', estado: 'ok', base_datos: filas[0]?.base_datos, motor: 'mysql' };
  }
}
