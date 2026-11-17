import { ConflictException, Controller, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MysqlEstanciasRepository } from '../database/mysql-estancias.repository';
import { internalHeaders } from '../security/internal-headers';
@Injectable()
export class CoordinadorEstancias {
  private readonly headers: Record<string,string>;
  private readonly habitaciones: URL;
  private readonly cobros: URL;
  constructor(private readonly procesos: MysqlEstanciasRepository,config: ConfigService) {
    this.headers=internalHeaders(config);
    this.habitaciones=new URL(config.getOrThrow<string>('HABITACIONES_SERVICE_URL'));
    this.cobros=new URL(config.getOrThrow<string>('COBROS_SERVICE_URL'));
  }
  private async comando(root: URL,path: string,body: Record<string,string>) {
    try {
      const r=await fetch(new URL(path,root),{method:'POST',headers:{...this.headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      if(r.status===409){const value=await r.json() as {message?: unknown};throw new ConflictException(typeof value.message==='string'?value.message:'La operación no cumple las condiciones de estancia.');}
      if(!r.ok)throw new Error('Servicio remoto rechazó la operación');
    } catch(e) {
      if(e instanceof ConflictException)throw e;
      throw new ServiceUnavailableException('No se completó la estancia. Corrige el servicio no disponible y reintenta la misma operación; no se duplicarán los pasos confirmados.');
    }
  }
  async ejecutar(id: string,accion: 'entrada'|'salida') {
    const p=await this.procesos.preparar(id,accion);
    if(p.terminado)return this.procesos.consultar(id);
    if(accion==='entrada') {
      await this.comando(this.cobros,`/interno/cuentas/${id}/preparar-entrada`,{});
      await this.comando(this.habitaciones,`/interno/habitaciones/${p.reserva.habitacion_id}/entrada`,{reserva_id:id});
    } else {
      await this.comando(this.cobros,`/interno/cuentas/${id}/cerrar-salida`,{});
      await this.comando(this.habitaciones,`/interno/habitaciones/${p.reserva.habitacion_id}/salida`,{reserva_id:id});
    }
    return this.procesos.finalizar(id,accion);
  }
}
@Controller('reservas')
export class EstanciasController {
  constructor(private readonly coordinador: CoordinadorEstancias,private readonly procesos: MysqlEstanciasRepository) {}
  @Post(':id/check-in') @HttpCode(200)
  entrada(@Param('id',ParseUUIDPipe) id: string){return this.coordinador.ejecutar(id,'entrada');}
  @Post(':id/check-out') @HttpCode(200)
  salida(@Param('id',ParseUUIDPipe) id: string){return this.coordinador.ejecutar(id,'salida');}
  @Get(':id/estancia')
  consultar(@Param('id',ParseUUIDPipe) id: string){return this.procesos.consultar(id);}
}
