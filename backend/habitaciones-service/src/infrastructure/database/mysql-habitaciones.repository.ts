import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  HabitacionInvalida,
  HabitacionOcupada,
  NumeroHabitacionDuplicado,
} from '../../domain/habitacion';
import type {
  EstadoHabitacion,
  Habitacion,
  NuevaHabitacion,
} from '../../domain/habitacion';
import type { HabitacionesRepository } from '../../application/ports/habitaciones.repository';

@Injectable()
export class MysqlHabitacionesRepository
  implements HabitacionesRepository
{
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    numero,
    tipo,
    capacidad,
    CAST(precio_noche AS CHAR) AS precio_noche,
    estado_operativo,
    creada_en
  `;

  listar(): Promise<Habitacion[]> {
    return this.dataSource.query<Habitacion[]>(
      `SELECT ${this.columnas}
       FROM habitaciones
       ORDER BY numero ASC`,
    );
  }

  async buscarPorId(id: string): Promise<Habitacion | null> {
    const filas = await this.dataSource.query<Habitacion[]>(
      `SELECT ${this.columnas}
       FROM habitaciones
       WHERE id = ?`,
      [id],
    );

    return filas[0] ?? null;
  }

  async crear(datos: NuevaHabitacion): Promise<Habitacion> {
    const id = randomUUID();

    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO habitaciones (
             id,
             numero,
             tipo,
             capacidad,
             precio_noche
           )
           VALUES (?, ?, ?, ?, ?)`,
          [
            id,
            datos.numero,
            datos.tipo,
            datos.capacidad,
            String(datos.precio_noche),
          ],
        );

        const filas = await manager.query<Habitacion[]>(
          `SELECT ${this.columnas}
           FROM habitaciones
           WHERE id = ?`,
          [id],
        );

        const habitacion = filas[0];

        if (!habitacion) {
          throw new Error('No se pudo recuperar la habitación creada.');
        }

        return habitacion;
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
          throw new NumeroHabitacionDuplicado(
            'Ya existe una habitación con ese número.',
          );
        }

        if (
          detalle.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
          detalle.errno === 3819
        ) {
          throw new HabitacionInvalida(
            'Los datos incumplen una regla de la habitación.',
          );
        }
      }

      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    estado: EstadoHabitacion,
    permitirMantenimiento = true,
  ): Promise<Habitacion | null> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM habitaciones WHERE id=? FOR UPDATE',[id]);
      const ocupadas = await manager.query<{reserva_id:string}[]>("SELECT reserva_id FROM estancias_habitacion WHERE habitacion_id=? AND estado='en_estancia'",[id]);
      if (ocupadas.length) throw new HabitacionOcupada('No se puede cambiar el estado operativo mientras la habitación esté ocupada.');

      await manager.query(
        `UPDATE habitaciones
         SET estado_operativo = ?
         WHERE id = ? AND (? = TRUE OR estado_operativo <> 'mantenimiento')`,
        [estado, id, permitirMantenimiento],
      );

      const filas = await manager.query<Habitacion[]>(
        `SELECT ${this.columnas}
         FROM habitaciones
         WHERE id = ?`,
        [id],
      );

      return filas[0] ?? null;
    });
  }
}