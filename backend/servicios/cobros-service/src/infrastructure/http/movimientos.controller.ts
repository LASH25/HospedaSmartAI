import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { MysqlMovimientosRepository } from '../database/mysql-movimientos.repository';
import { ConsumoDto, PagoDto } from './movimientos.dto';
@Controller('cuentas')
export class MovimientosController {
  constructor(private readonly movimientos: MysqlMovimientosRepository) {}
  @Get(':id/resumen')
  resumen(@Param('id', ParseUUIDPipe) id: string) { return this.movimientos.resumen(id); }
  @Post(':id/consumos')
  consumo(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ConsumoDto) {
    return this.movimientos.agregarConsumo(id, datos);
  }
  @Post(':id/pagos') @HttpCode(200)
  pago(@Param('id', ParseUUIDPipe) id: string, @Body() datos: PagoDto) {
    return this.movimientos.registrarPago(id, datos);
  }
  @Post(':id/cerrar') @HttpCode(200)
  cerrar(@Param('id', ParseUUIDPipe) id: string) { return this.movimientos.cerrar(id); }
}
