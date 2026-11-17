import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import type { Cuenta, NuevaCuenta } from '../../domain/cuenta';
import type { CuentasRepository } from '../../application/ports/cuentas.repository';

@Injectable()
export class MysqlCuentasRepository implements CuentasRepository {
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    reserva_id,
    huesped_id,
    CAST(total_estancia AS CHAR) AS total_estancia,
    moneda,
    estado,
    creada_en
  `;

  async crear(datos: NuevaCuenta): Promise<Cuenta> {
    const id = randomUUID();

    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO cuentas (
             id,
             reserva_id,
             huesped_id,
             total_estancia
           )
           VALUES (?, ?, ?, ?)`,
          [
            id,
            datos.reserva_id,
            datos.huesped_id,
            datos.total_estancia,
          ],
        );

        const filas = await manager.query<Cuenta[]>(
          `SELECT ${this.columnas}
           FROM cuentas
           WHERE id = ?`,
          [id],
        );

        const cuenta = filas[0];

        if (!cuenta) {
          throw new Error('No fue posible recuperar la cuenta creada.');
        }

        return cuenta;
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
          const existente = await this.buscarPorReserva(
            datos.reserva_id,
          );

          if (existente) {
            return existente;
          }
        }
      }

      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Cuenta | null> {
    const filas = await this.dataSource.query<Cuenta[]>(
      `SELECT ${this.columnas}
       FROM cuentas
       WHERE id = ?`,
      [id],
    );

    return filas[0] ?? null;
  }

  async buscarPorReserva(reservaId: string): Promise<Cuenta | null> {
    const filas = await this.dataSource.query<Cuenta[]>(
      `SELECT ${this.columnas}
       FROM cuentas
       WHERE reserva_id = ?`,
      [reservaId],
    );

    return filas[0] ?? null;
  }
}