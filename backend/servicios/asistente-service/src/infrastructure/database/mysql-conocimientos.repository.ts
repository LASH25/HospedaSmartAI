import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Conocimiento } from '../../domain/conocimiento';
import type { ConocimientosRepository } from '../../application/ports/conocimientos.repository';

@Injectable()
export class MysqlConocimientosRepository
  implements ConocimientosRepository
{
  constructor(private readonly dataSource: DataSource) {}

  buscar(texto: string): Promise<Conocimiento[]> {
    return this.dataSource.query<Conocimiento[]>(
      `SELECT id, titulo, categoria, contenido
       FROM conocimientos
       WHERE activo = TRUE
         AND MATCH(titulo, contenido)
             AGAINST (? IN NATURAL LANGUAGE MODE) > 0
       ORDER BY
         MATCH(titulo, contenido)
             AGAINST (? IN NATURAL LANGUAGE MODE) DESC,
         id ASC
       LIMIT 3`,
      [texto, texto],
    );
  }
}