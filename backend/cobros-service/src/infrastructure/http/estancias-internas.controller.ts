import { Controller, Inject, HttpCode, Param, ParseUUIDPipe, Post, ConflictException } from '@nestjs/common';
import { ServicioCuentas } from '../../application/servicio-cuentas';
import { CUENTAS_REPOSITORY } from '../../application/ports/cuentas.repository';
import type { CuentasRepository } from '../../application/ports/cuentas.repository';
import { MysqlMovimientosRepository } from '../database/mysql-movimientos.repository';
@Controller('interno/cuentas')
export class EstanciasCobrosController {
  constructor(private readonly cuentas:ServicioCuentas,@Inject(CUENTAS_REPOSITORY) private readonly repository:CuentasRepository,private readonly movimientos:MysqlMovimientosRepository){}
  @Post(':id/preparar-entrada') @HttpCode(200)
  entrada(@Param('id',ParseUUIDPipe) id:string){return this.cuentas.abrir(id);}
  @Post(':id/cerrar-salida') @HttpCode(200)
  async salida(@Param('id',ParseUUIDPipe) id:string){
    const cuenta=await this.repository.buscarPorReserva(id);
    if(!cuenta)throw new ConflictException('La reserva no tiene cuenta.');
    return this.movimientos.cerrar(cuenta.id);
  }
}
