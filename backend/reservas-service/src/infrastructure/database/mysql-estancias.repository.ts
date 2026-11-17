import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type { Reserva } from '../../domain/reserva';
export interface ProcesoEstancia { reserva_id: string; fase: 'entrada_pendiente' | 'en_estancia' | 'salida_pendiente' | 'finalizada'; entrada_en: string | null; salida_en: string | null; }
@Injectable()
export class MysqlEstanciasRepository {
  private readonly timezone: string;
  constructor(private readonly db: DataSource, config: ConfigService) {
    this.timezone = config.get<string>('HOTEL_TIMEZONE') ?? 'America/Mexico_City';
    new Intl.DateTimeFormat('en', { timeZone: this.timezone });
  }
  private hoy() {
    const partes = new Intl.DateTimeFormat('en', { timeZone: this.timezone,year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
    const p = Object.fromEntries(partes.map(x => [x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  private async reserva(m: EntityManager, id: string) {
    const filas = await m.query<Reserva[]>(`SELECT id, habitacion_id, huesped_id,
      DATE_FORMAT(fecha_entrada,'%Y-%m-%d') AS fecha_entrada, DATE_FORMAT(fecha_salida,'%Y-%m-%d') AS fecha_salida,
      CAST(total AS CHAR) AS total, estado FROM reservas WHERE id=?`, [id]);
    if (!filas[0]) throw new NotFoundException('La reserva no existe.');
    return filas[0];
  }
  private bloqueo<T>(id: string, fn: (m: EntityManager,r: Reserva) => Promise<T>) {
    return this.db.transaction('READ COMMITTED',async m => {
      const inicial = await this.reserva(m,id);
      await m.query(`INSERT INTO bloqueos_habitaciones(habitacion_id) VALUES (?) ON DUPLICATE KEY UPDATE habitacion_id=habitacion_id`,[inicial.habitacion_id]);
      await m.query('SELECT habitacion_id FROM bloqueos_habitaciones WHERE habitacion_id=? FOR UPDATE',[inicial.habitacion_id]);
      return fn(m,await this.reserva(m,id));
    });
  }
  async preparar(id: string, accion: 'entrada' | 'salida') {
    return this.bloqueo(id,async(m,r) => {
      const procesos = await m.query<ProcesoEstancia[]>('SELECT * FROM procesos_estancia WHERE reserva_id=?',[id]);
      const p=procesos[0];
      if (accion==='entrada') {
        if (p?.fase==='en_estancia' && r.estado==='en_estancia') return { reserva:r, terminado:true };
        if (p?.fase==='entrada_pendiente' && r.estado==='confirmada') return { reserva:r, terminado:false };
        if (p || r.estado!=='confirmada') throw new ConflictException('La reserva no admite check-in.');
        const hoy=this.hoy();
        if(hoy<r.fecha_entrada || hoy>=r.fecha_salida) throw new ConflictException('El check-in requiere estar dentro de las fechas de la reserva según la hora del hotel.');
        const otras=await m.query<{id:string}[]>(`SELECT r.id FROM reservas r LEFT JOIN procesos_estancia p ON p.reserva_id=r.id
          WHERE r.habitacion_id=? AND r.id<>? AND (r.estado='en_estancia' OR p.fase IN ('entrada_pendiente','salida_pendiente')) LIMIT 1`,[r.habitacion_id,id]);
        if(otras.length) throw new ConflictException('La habitación tiene otra estancia activa o una operación pendiente.');
        await m.query("INSERT INTO procesos_estancia(reserva_id,fase) VALUES (?,'entrada_pendiente')",[id]);
      } else {
        if (p?.fase==='finalizada' && r.estado==='finalizada') return { reserva:r, terminado:true };
        if (p?.fase==='salida_pendiente' && r.estado==='en_estancia') return { reserva:r, terminado:false };
        if (p?.fase!=='en_estancia' || r.estado!=='en_estancia') throw new ConflictException('Solo una estancia con check-in completo admite check-out.');
        await m.query("UPDATE procesos_estancia SET fase='salida_pendiente' WHERE reserva_id=?",[id]);
      }
      return { reserva:r, terminado:false };
    });
  }
  finalizar(id: string,accion: 'entrada'|'salida') {
    return this.bloqueo(id,async(m,r)=>{
      const [p]=await m.query<ProcesoEstancia[]>('SELECT * FROM procesos_estancia WHERE reserva_id=?',[id]);
      const destino=accion==='entrada'?'en_estancia':'finalizada';
      if(p?.fase===destino && r.estado===destino)return { reserva:r, proceso:p };
      if(p?.fase!==(accion==='entrada'?'entrada_pendiente':'salida_pendiente'))throw new ConflictException('La operación de estancia cambió.');
      await m.query('UPDATE reservas SET estado=? WHERE id=?',[destino,id]);
      await m.query(`UPDATE procesos_estancia SET fase=?, ${accion==='entrada'?'entrada_en':'salida_en'}=CURRENT_TIMESTAMP WHERE reserva_id=?`,[destino,id]);
      return { reserva:await this.reserva(m,id), proceso:(await m.query<ProcesoEstancia[]>('SELECT * FROM procesos_estancia WHERE reserva_id=?',[id]))[0] };
    });
  }
  consultar(id: string) {
    return this.db.transaction('REPEATABLE READ',async m=>({reserva:await this.reserva(m,id),proceso:(await m.query<ProcesoEstancia[]>('SELECT * FROM procesos_estancia WHERE reserva_id=?',[id]))[0]??null}));
  }
}
