import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  HabitacionInvalida,
  NumeroHabitacionDuplicado,
} from '../../domain/habitacion';
import type {
  EstadoHabitacion,
  Habitacion,
  NuevaHabitacion,
} from '../../domain/habitacion';
import type { HabitacionesRepository } from '../../application/ports/habitaciones.repository';

@Injectable()
export class PostgresHabitacionesRepository
  implements HabitacionesRepository
{
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    numero,
    tipo,
    capacidad,
    precio_noche::text AS precio_noche,
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

  async crear(datos: NuevaHabitacion): Promise<Habitacion> {
    try {
      const filas = await this.dataSource.query<Habitacion[]>(
        `INSERT INTO habitaciones (
           numero,
           tipo,
           capacidad,
           precio_noche
         )
         VALUES ($1, $2, $3, $4)
         RETURNING ${this.columnas}`,
        [
          datos.numero,
          datos.tipo,
          datos.capacidad,
          String(datos.precio_noche),
        ],
      );

      return filas[0];
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const detalle = error.driverError as {
          code?: string;
          constraint?: string;
        };

        if (
          detalle.code === '23505' &&
          detalle.constraint === 'habitaciones_numero_key'
        ) {
          throw new NumeroHabitacionDuplicado(
            'Ya existe una habitación con ese número.',
          );
        }

        if (detalle.code === '23514') {
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
  ): Promise<Habitacion | null> {
    const filas = await this.dataSource.query<Habitacion[]>(
      `
        WITH actualizada AS (
          UPDATE habitaciones
          SET estado_operativo = $2
          WHERE id = $1
          RETURNING *
        )
        SELECT ${this.columnas}
        FROM actualizada
      `,
      [id, estado],
    );


    return filas[0] ?? null;
  }
    async buscarPorId(id: string): Promise<Habitacion | null> {
    const filas = await this.dataSource.query<Habitacion[]>(
      `SELECT ${this.columnas}
       FROM habitaciones
       WHERE id = $1`,
      [id],
    );

    return filas[0] ?? null;
  }
} 