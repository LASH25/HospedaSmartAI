import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('salud')
export class SaludController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async comprobarConexion() {
    const resultado = await this.dataSource.query<
      { base_datos: string }[]
    >('SELECT current_database() AS base_datos');

    return {
      servicio: 'reservas-service',
      estado: 'ok',
      base_datos: resultado[0].base_datos,
    };
  }
}