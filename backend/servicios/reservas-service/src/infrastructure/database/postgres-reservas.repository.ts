import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  HabitacionNoDisponible,
  ReservaInvalida,
} from '../../domain/reserva';
import type { NuevaReserva, Reserva } from '../../domain/reserva';
import type { ReservasRepository } from '../../application/ports/reservas.repository';

@Injectable()
export class PostgresReservasRepository implements ReservasRepository {
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    habitacion_id,
    huesped_id,
    to_char(fecha_entrada, 'YYYY-MM-DD') AS fecha_entrada,
    to_char(fecha_salida, 'YYYY-MM-DD') AS fecha_salida,
    total::text AS total,
    estado,
    creada_en
  `;

  async crear(datos: NuevaReserva): Promise<Reserva> {
    try {
      const filas = await this.dataSource.query<Reserva[]>(
        `
          INSERT INTO reservas (
            habitacion_id,
            huesped_id,
            fecha_entrada,
            fecha_salida,
            total
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING ${this.columnas}
        `,
        [
          datos.habitacion_id,
          datos.huesped_id,
          datos.fecha_entrada,
          datos.fecha_salida,
          String(datos.total),
        ],
      );

      return filas[0];
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const codigo = (error.driverError as { code?: string }).code;

        if (codigo === '23P01') {
          throw new HabitacionNoDisponible(
            'La habitación ya está reservada en esas fechas.',
          );
        }

        if (codigo === '23514') {
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
       WHERE id = $1`,
      [id],
    );

    return filas[0] ?? null;
  }

    async cancelarConfirmada(id: string): Promise<Reserva | null> {
    const filas = await this.dataSource.query<Reserva[]>(
      `
        WITH cancelada AS (
          UPDATE reservas
          SET estado = 'cancelada'
          WHERE id = $1
            AND estado IN ('confirmada', 'cancelada')
          RETURNING *
        )
        SELECT ${this.columnas}
        FROM cancelada
      `,
      [id],
    );

    return filas[0] ?? null;
  }
}