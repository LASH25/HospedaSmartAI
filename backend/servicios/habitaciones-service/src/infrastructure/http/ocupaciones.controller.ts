import { Body, ConflictException, Controller, Get, HttpCode, Injectable, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
export class OperacionHabitacionDto { @IsUUID() reserva_id!: string; }
export interface EstanciaHabitacion { reserva_id:string; habitacion_id:string; estado:string; }
@Injectable()
export class OcupacionesRepository {
  constructor(private readonly db:DataSource){}
  private async habitacion(m:EntityManager,id:string){
    const [h]=await m.query<{id:string;estado_operativo:string}[]>('SELECT id,estado_operativo FROM habitaciones WHERE id=? FOR UPDATE',[id]);
    if(!h)throw new NotFoundException('La habitación no existe.');return h;
  }
  ejecutar(id:string,reserva_id:string,accion:'entrada'|'salida'){
    return this.db.transaction('READ COMMITTED',async m=>{
      const h=await this.habitacion(m,id);
      const [previo]=await m.query<EstanciaHabitacion[]>('SELECT reserva_id,habitacion_id,estado FROM estancias_habitacion WHERE reserva_id=?',[reserva_id]);
      if(previo && previo.habitacion_id!==id)throw new ConflictException('La estancia corresponde a otra habitación.');
      if(accion==='entrada'){
        if(previo?.estado==='en_estancia')return previo;
        if(previo)throw new ConflictException('La estancia ya finalizó.');
        const ocupadas=await m.query<EstanciaHabitacion[]>("SELECT reserva_id FROM estancias_habitacion WHERE habitacion_id=? AND estado='en_estancia'",[id]);
        if(ocupadas.length || h.estado_operativo!=='disponible')throw new ConflictException('La habitación no está lista o está ocupada.');
        await m.query("INSERT INTO estancias_habitacion(reserva_id,habitacion_id,estado) VALUES (?,?,'en_estancia')",[reserva_id,id]);
      }else{
        if(previo?.estado==='finalizada')return previo;
        if(!previo)throw new ConflictException('No se ha registrado la entrada de esta estancia.');
        await m.query("UPDATE estancias_habitacion SET estado='finalizada',salida_en=CURRENT_TIMESTAMP WHERE reserva_id=?",[reserva_id]);
        await m.query("UPDATE habitaciones SET estado_operativo='limpieza' WHERE id=?",[id]);
      }
      return (await m.query<EstanciaHabitacion[]>('SELECT reserva_id,habitacion_id,estado FROM estancias_habitacion WHERE reserva_id=?',[reserva_id]))[0];
    });
  }
  async consultar(id:string){
    const [h]=await this.db.query<{id:string}[]>('SELECT id FROM habitaciones WHERE id=?',[id]);
    if(!h)throw new NotFoundException('La habitación no existe.');
    const rows=await this.db.query<{reserva_id:string}[]>("SELECT reserva_id FROM estancias_habitacion WHERE habitacion_id=? AND estado='en_estancia'",[id]);
    return {habitacion_id:id,ocupada:rows.length>0};
  }
}
@Controller('interno/habitaciones')
export class OcupacionesInternasController {
  constructor(private readonly ocupaciones:OcupacionesRepository){}
  @Post(':id/entrada') @HttpCode(200)
  entrada(@Param('id',ParseUUIDPipe) id:string,@Body() dto:OperacionHabitacionDto){return this.ocupaciones.ejecutar(id,dto.reserva_id,'entrada');}
  @Post(':id/salida') @HttpCode(200)
  salida(@Param('id',ParseUUIDPipe) id:string,@Body() dto:OperacionHabitacionDto){return this.ocupaciones.ejecutar(id,dto.reserva_id,'salida');}
}
@Controller('habitaciones')
export class OcupacionesController {
  constructor(private readonly ocupaciones:OcupacionesRepository){}
  @Get(':id/ocupacion')
  consultar(@Param('id',ParseUUIDPipe) id:string){return this.ocupaciones.consultar(id);}
}
