import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import {
  HabitacionNoDisponible,
  ReservaInvalida,
  ReservaNoCancelable,
} from '../../domain/reserva';
import type { NuevaReserva, Reserva } from '../../domain/reserva';
import type { ReservasRepository } from '../../application/ports/reservas.repository';

@Injectable()
export class MysqlReservasRepository implements ReservasRepository {
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    habitacion_id,
    huesped_id,
    DATE_FORMAT(fecha_entrada, '%Y-%m-%d') AS fecha_entrada,
    DATE_FORMAT(fecha_salida, '%Y-%m-%d') AS fecha_salida,
    CAST(total AS CHAR) AS total,
    estado,
    creada_en
  `;

  private async bloquearHabitacion(
    manager: EntityManager,
    habitacionId: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO bloqueos_habitaciones (habitacion_id)
       VALUES (?)
       ON DUPLICATE KEY UPDATE habitacion_id = habitacion_id`,
      [habitacionId],
    );

    await manager.query(
      `SELECT habitacion_id
       FROM bloqueos_habitaciones
       WHERE habitacion_id = ?
       FOR UPDATE`,
      [habitacionId],
    );
  }

  async crear(datos: NuevaReserva): Promise<Reserva> {
    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          await this.bloquearHabitacion(
            manager,
            datos.habitacion_id,
          );

          const cruzadas = await manager.query<{ id: string }[]>(
            `SELECT id
             FROM reservas
             WHERE habitacion_id = ?
               AND estado IN ('confirmada', 'en_estancia')
               AND fecha_entrada < ?
               AND fecha_salida > ?
             LIMIT 1
             FOR UPDATE`,
            [
              datos.habitacion_id,
              datos.fecha_salida,
              datos.fecha_entrada,
            ],
          );

          if (cruzadas.length > 0) {
            throw new HabitacionNoDisponible(
              'La habitación ya está reservada en esas fechas.',
            );
          }

          const id = randomUUID();

          await manager.query(
            `INSERT INTO reservas (
               id,
               habitacion_id,
               huesped_id,
               fecha_entrada,
               fecha_salida,
               total
             )
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              datos.habitacion_id,
              datos.huesped_id,
              datos.fecha_entrada,
              datos.fecha_salida,
              String(datos.total),
            ],
          );

          const filas = await manager.query<Reserva[]>(
            `SELECT ${this.columnas}
             FROM reservas
             WHERE id = ?`,
            [id],
          );

          const reserva = filas[0];

          if (!reserva) {
            throw new Error(
              'No fue posible recuperar la reserva creada.',
            );
          }

          return reserva;
        },
      );
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const detalle = error.driverError as {
          code?: string;
          errno?: number;
        };

        if (
          detalle.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
          detalle.errno === 3819
        ) {
          throw new ReservaInvalida(
            'Los datos incumplen una regla de la reserva.',
          );
        }
      }

      throw error;
    }
  }

  listar(): Promise<Reserva[]> {
    return this.dataSource.query<Reserva[]>(
      `SELECT ${this.columnas}
       FROM reservas
       ORDER BY creada_en DESC, id DESC`,
    );
  }

  async buscarPorId(id: string): Promise<Reserva | null> {
    const filas = await this.dataSource.query<Reserva[]>(
      `SELECT ${this.columnas}
       FROM reservas
       WHERE id = ?`,
      [id],
    );

    return filas[0] ?? null;
  }

  async cancelarConfirmada(id: string): Promise<Reserva | null> {
    return this.dataSource.transaction(
      'READ COMMITTED',
      async (manager) => {
        const iniciales = await manager.query<
          { habitacion_id: string }[]
        >(
          `SELECT habitacion_id
           FROM reservas
           WHERE id = ?`,
          [id],
        );

        const inicial = iniciales[0];

        if (!inicial) {
          return null;
        }

        await this.bloquearHabitacion(
          manager,
          inicial.habitacion_id,
        );

        const procesos = await manager.query<{reserva_id:string}[]>(
          "SELECT reserva_id FROM procesos_estancia WHERE reserva_id=? AND fase IN ('entrada_pendiente','en_estancia','salida_pendiente')", [id]);
        if (procesos.length) throw new ReservaNoCancelable('La reserva tiene una estancia u operación pendiente; completa o reintenta esa operación.');

        await manager.query(
          `UPDATE reservas
           SET estado = 'cancelada'
           WHERE id = ?
             AND estado IN ('confirmada', 'cancelada')`,
          [id],
        );

        const filas = await manager.query<Reserva[]>(
          `SELECT ${this.columnas}
           FROM reservas
           WHERE id = ?
             AND estado = 'cancelada'`,
          [id],
        );

        return filas[0] ?? null;
      },
    );
  }
}