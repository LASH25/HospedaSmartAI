import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { ConversacionesRepository } from '../../application/ports/conversaciones.repository';

@Injectable()
export class MysqlConversacionesRepository
  implements ConversacionesRepository
{
  constructor(private readonly dataSource: DataSource) {}

  registrarIntercambio(
    pregunta: string,
    respuesta: string,
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const id = randomUUID();

      await manager.query(
        `INSERT INTO conversaciones (id, canal)
         VALUES (?, 'web')`,
        [id],
      );

      await manager.query(
        `INSERT INTO mensajes (
           conversacion_id,
           rol,
           contenido
         )
         VALUES (?, 'usuario', ?)`,
        [id, pregunta],
      );

      await manager.query(
        `INSERT INTO mensajes (
           conversacion_id,
           rol,
           contenido
         )
         VALUES (?, 'asistente', ?)`,
        [id, respuesta],
      );

      return id;
    });
  }
}