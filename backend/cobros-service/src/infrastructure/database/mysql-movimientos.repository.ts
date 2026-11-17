import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { centavos, importe } from '../../domain/dinero';
import type { ConsumoDto, PagoDto } from '../http/movimientos.dto';

export interface CuentaFila { id: string; reserva_id: string; huesped_id: string; total_estancia: string; moneda: string; estado: string; }
export interface ConsumoFila { id: string; cuenta_id: string; concepto: string; cantidad: number; precio_unitario: string; subtotal: string; creada_en: string; }
export interface PagoFila { id: string; cuenta_id: string; clave_idempotencia: string; monto: string; metodo: string; referencia: string | null; creada_en: string; }
@Injectable()
export class MysqlMovimientosRepository {
  constructor(private readonly db: DataSource) {}

  private conCuenta<T>(id: string, ejecutar: (m: EntityManager, cuenta: CuentaFila) => Promise<T>): Promise<T> {
    return this.db.transaction('READ COMMITTED', async m => {
      const filas = await m.query<CuentaFila[]>(
        `SELECT id, reserva_id, huesped_id, CAST(total_estancia AS CHAR) AS total_estancia,
         moneda, estado FROM cuentas WHERE id = ? FOR UPDATE`, [id]);
      if (!filas[0]) throw new NotFoundException('La cuenta no existe.');
      return ejecutar(m, filas[0]);
    });
  }
  private abierta(cuenta: CuentaFila) {
    if (cuenta.estado !== 'abierta') throw new ConflictException('La cuenta está cerrada.');
  }
  private consumos(m: EntityManager, id: string) {
    return m.query<ConsumoFila[]>(`SELECT id, cuenta_id, concepto, cantidad,
      CAST(precio_unitario AS CHAR) AS precio_unitario, CAST(subtotal AS CHAR) AS subtotal,
      creada_en FROM consumos WHERE cuenta_id = ? ORDER BY creada_en, id`, [id]);
  }
  private pagos(m: EntityManager, id: string) {
    return m.query<PagoFila[]>(`SELECT id, cuenta_id, clave_idempotencia,
      CAST(monto AS CHAR) AS monto, metodo, referencia, creada_en
      FROM pagos WHERE cuenta_id = ? ORDER BY creada_en, id`, [id]);
  }
  private async detalle(m: EntityManager, cuenta: CuentaFila) {
    const consumos = await this.consumos(m, cuenta.id);
    const pagos = await this.pagos(m, cuenta.id);
    const extra = consumos.reduce((s, x) => s + centavos(x.subtotal), 0n);
    const pagado = pagos.reduce((s, x) => s + centavos(x.monto), 0n);
    const total = centavos(cuenta.total_estancia) + extra;
    return { cuenta, consumos, pagos, total_estancia: cuenta.total_estancia,
      total_consumos: importe(extra), total: importe(total),
      total_pagado: importe(pagado), saldo: importe(total - pagado), moneda: cuenta.moneda };
  }
  resumen(id: string) { return this.conCuenta(id, (m, c) => this.detalle(m, c)); }

  agregarConsumo(id: string, datos: ConsumoDto) {
    return this.conCuenta(id, async (m, cuenta) => {
      this.abierta(cuenta);
      const consumoId = randomUUID();
      await m.query(`INSERT INTO consumos (id, cuenta_id, concepto, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?, ?)`, [consumoId, id, datos.concepto, datos.cantidad, datos.precio_unitario.toFixed(2)]);
      return (await this.consumos(m, id)).find(x => x.id === consumoId)!;
    });
  }
  async registrarPago(id: string, datos: PagoDto) {
    const clave = datos.clave_idempotencia.toLowerCase();
    const monto = datos.monto.toFixed(2);
    const referencia = datos.referencia ?? null;
    try {
      return await this.conCuenta(id, async (m, cuenta) => {
        const existentes = await m.query<PagoFila[]>(`SELECT id, cuenta_id, clave_idempotencia,
          CAST(monto AS CHAR) AS monto, metodo, referencia, creada_en
          FROM pagos WHERE clave_idempotencia = ?`, [clave]);
        const previo = existentes[0];
        if (previo) {
          if (previo.cuenta_id !== id || previo.monto !== monto || previo.metodo !== datos.metodo || previo.referencia !== referencia)
            throw new ConflictException('Esa clave de pago ya se utilizó con datos diferentes.');
          // Un reintento idéntico puede recuperar un pago incluso tras cerrar la cuenta.
          return previo;
        }
        this.abierta(cuenta);
        const resumen = await this.detalle(m, cuenta);
        if (centavos(monto) > centavos(resumen.saldo)) throw new ConflictException('El pago supera el saldo pendiente.');
        const pagoId = randomUUID();
        await m.query(`INSERT INTO pagos (id, cuenta_id, clave_idempotencia, monto, metodo, referencia)
          VALUES (?, ?, ?, ?, ?, ?)`, [pagoId, id, clave, monto, datos.metodo, referencia]);
        return (await this.pagos(m, id)).find(x => x.id === pagoId)!;
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new ConflictException('Esa clave de pago ya está registrada.');
      throw error;
    }
  }
  cerrar(id: string) {
    return this.conCuenta(id, async (m, cuenta) => {
      if (cuenta.estado === 'cerrada') return this.detalle(m, cuenta);
      this.abierta(cuenta);
      const resumen = await this.detalle(m, cuenta);
      if (resumen.saldo !== '0.00') throw new ConflictException('La cuenta debe quedar sin saldo para cerrarse.');
      await m.query("UPDATE cuentas SET estado = 'cerrada' WHERE id = ?", [id]);
      return { ...resumen, cuenta: { ...cuenta, estado: 'cerrada' } };
    });
  }
}
