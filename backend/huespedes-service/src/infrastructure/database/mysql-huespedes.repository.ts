import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  EmailHuespedDuplicado,
  HuespedInvalido,
} from '../../domain/huesped';
import type { Huesped, NuevoHuesped } from '../../domain/huesped';
import type { HuespedesRepository } from '../../application/ports/huespedes.repository';

@Injectable()
export class MysqlHuespedesRepository implements HuespedesRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  private readonly columnas = 'id, nombre, email, telefono, creada_en';

  async crear(datos: NuevoHuesped): Promise<Huesped> {
    const id = randomUUID();

    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO huespedes (id, nombre, email, telefono)
           VALUES (?, ?, ?, ?)`,
          [id, datos.nombre, datos.email, datos.telefono],
        );

        const filas = await manager.query<Huesped[]>(
          `SELECT ${this.columnas}
           FROM huespedes
           WHERE id = ?`,
          [id],
        );

        const huesped = filas[0];

        if (!huesped) {
          throw new Error('No se pudo recuperar el huésped creado.');
        }

        return huesped;
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const detalle = error.driverError as {
          code?: string;
          errno?: number;
        };

        if (
          detalle.code === 'ER_DUP_ENTRY' ||
          detalle.errno === 1062
        ) {
          throw new EmailHuespedDuplicado(
            'Ya existe un huésped registrado con ese correo.',
          );
        }

        if (
          detalle.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
          detalle.errno === 3819
        ) {
          throw new HuespedInvalido(
            'Los datos incumplen una regla del huésped.',
          );
        }
      }

      throw error;
    }
  }

  async actualizarContacto(id: string, datos: {nombre: string; telefono: string}): Promise<Huesped | null> {
    return this.dataSource.transaction(async (manager) => {
      const filas = await manager.query<Huesped[]>(`SELECT ${this.columnas} FROM huespedes WHERE id = ? FOR UPDATE`, [id]);
      if (!filas[0]) return null;
      await manager.query('UPDATE huespedes SET nombre = ?, telefono = ? WHERE id = ?', [datos.nombre, datos.telefono, id]);
      const actualizadas = await manager.query<Huesped[]>(`SELECT ${this.columnas} FROM huespedes WHERE id = ?`, [id]);
      return actualizadas[0] ?? null;
    });
  }

  listar(): Promise<Huesped[]> {
    return this.dataSource.query<Huesped[]>(
      `SELECT ${this.columnas}
       FROM huespedes
       ORDER BY nombre ASC, id ASC`,
    );
  }

  async buscarPorId(id: string): Promise<Huesped | null> {
    const filas = await this.dataSource.query<Huesped[]>(
      `SELECT ${this.columnas}
       FROM huespedes
       WHERE id = ?`,
      [id],
    );

    return filas[0] ?? null;
  }
}