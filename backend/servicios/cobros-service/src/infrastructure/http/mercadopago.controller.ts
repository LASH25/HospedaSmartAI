import {
  ConflictException, Controller, HttpCode, Param,
  ParseUUIDPipe, Post, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MysqlMovimientosRepository } from '../database/mysql-movimientos.repository';
import { centavos } from '../../domain/dinero';
import { Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Controller('cuentas')
export class MercadoPagoController {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly movimientos: MysqlMovimientosRepository,
  ) {}

  private async solicitar(
    ruta: string,
    opciones: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    try {
      const respuesta = await fetch(
        `https://api.mercadopago.com${ruta}`,
        {
          ...opciones,
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow<string>(
              'MERCADOPAGO_ACCESS_TOKEN',
            ).trim()}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!respuesta.ok) throw new Error('Mercado Pago rechazó la operación.');
      return await respuesta.json() as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con Mercado Pago. Intenta nuevamente.',
      );
    }
  }
  @Post('mercadopago/webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    const secreto = this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secreto?.trim()) {
      throw new ServiceUnavailableException('Webhook sin configurar.');
    }

    const url = new URL(req.originalUrl, 'http://localhost');
    const identificadores = url.searchParams.getAll('data.id');
    const pagoId = identificadores[0] ?? '';
    const firma = req.get('x-signature') ?? '';
    const solicitudId = req.get('x-request-id') ?? '';

    if (
      identificadores.length !== 1 ||
      !/^\d{1,30}$/.test(pagoId) ||
      !solicitudId ||
      solicitudId.length > 200 ||
      firma.length > 1000
    ) {
      throw new UnauthorizedException('Notificación inválida.');
    }

    const partes = firma.split(',').map(x => x.trim());
    const tiempos = partes.filter(x => x.startsWith('ts='));
    const firmas = partes.filter(x => x.startsWith('v1='));
    const ts = tiempos[0]?.slice(3) ?? '';
    const recibida = firmas[0]?.slice(3) ?? '';

    if (
      tiempos.length !== 1 ||
      firmas.length !== 1 ||
      !/^\d{1,20}$/.test(ts) ||
      !/^[a-fA-F0-9]{64}$/.test(recibida)
    ) {
      throw new UnauthorizedException('Firma inválida.');
    }

    const manifiesto =
      `id:${pagoId};request-id:${solicitudId};ts:${ts};`;
    const esperada = createHmac('sha256', secreto.trim())
      .update(manifiesto)
      .digest();

    if (!timingSafeEqual(esperada, Buffer.from(recibida, 'hex'))) {
      throw new UnauthorizedException('Firma inválida.');
    }

    // El estado y el importe se consultan directamente al proveedor.
    const pago = await this.solicitar(`/v1/payments/${pagoId}`);
    const referencia = pago.external_reference;
    if (
      typeof referencia !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referencia)
    ) {
      return { recibido: true };
    }

    const [intento] = await this.db.query(
      'SELECT cuenta_id FROM intentos_mercadopago WHERE id = ?',
      [referencia],
    );
    if (!intento) return { recibido: true };

    await this.consultar(intento.cuenta_id, referencia);
    return { recibido: true };
  }


  @Post(':id/mercadopago/consultar')
  @HttpCode(200)
  async consultar(
    @Param("id", ParseUUIDPipe) id: string,
    intentoId?: string,
  ) {
    await this.movimientos.resumen(id);

    const [intento] = await this.db.query(
      `SELECT id, CAST(monto AS CHAR) AS monto, moneda,
              enlace, pago_local_id
       FROM intentos_mercadopago
       WHERE cuenta_id = ? AND (? IS NULL OR id = ?)
       ORDER BY creada_en DESC, id DESC LIMIT 1`,
      [id, intentoId ?? null, intentoId ?? null],
    );
    if (!intento) {
      return { estado: 'sin_intento' };
    }

    const vendedor = await this.solicitar('/users/me');
    if (
      vendedor.site_id !== 'MLM' ||
      !Array.isArray(vendedor.tags) ||
      !vendedor.tags.includes('test_user')
    ) {
      throw new ConflictException('Se requiere un vendedor de prueba.');
    }

    const filtros = new URLSearchParams({
      external_reference: intento.id,
      sort: 'date_created',
      criteria: 'desc',
      limit: '100',
    });
    const busqueda = await this.solicitar(
      `/v1/payments/search?${filtros}`,
    );
    if (!Array.isArray(busqueda.results)) {
      throw new ServiceUnavailableException(
        'No se pudo consultar el estado del pago.',
      );
    }

    const aprobados = busqueda.results.filter(
      (p: Record<string, unknown>) =>
        p.external_reference === intento.id &&
        p.status === 'approved',
    );
    if (aprobados.length > 1) {
      throw new ConflictException(
        'Hay varios pagos aprobados. Se requiere revisar esta cuenta.',
      );
    }
    if (!aprobados.length) {
      return {
        estado: intento.pago_local_id ? 'requiere_revision' : 'pendiente',
        enlace: intento.enlace,
        mensaje: intento.pago_local_id
          ? 'El estado externo cambió. Revisa el pago en Mercado Pago.'
          : 'Todavía no hay un pago aprobado. No vuelvas a pagar si ya completaste la operación; consulta nuevamente.',
      };
    }

    const externoId = String(aprobados[0].id);
    if (!/^\d+$/.test(externoId)) {
      throw new ServiceUnavailableException('Identificador de pago inválido.');
    }

    // Recupera el pago directamente antes de abonarlo a la cuenta.
    const pago = await this.solicitar(`/v1/payments/${externoId}`);
    const montoExterno = String(pago.transaction_amount);
    if (
      pago.status !== 'approved' ||
      pago.external_reference !== intento.id ||
      String(pago.collector_id) !== String(vendedor.id) ||
      pago.currency_id !== intento.moneda ||
      !/^\d+(?:\.\d{1,2})?$/.test(montoExterno) ||
      centavos(montoExterno) !== centavos(intento.monto) ||
      (
        pago.transaction_amount_refunded !== undefined &&
        Number(pago.transaction_amount_refunded) !== 0
      )
    ) {
      throw new ConflictException(
        'El pago no coincide con el intento o requiere revisión.',
      );
    }

    // La misma clave permite consultar varias veces sin duplicar el abono.
    const registrado = await this.movimientos.registrarPago(id, {
      clave_idempotencia: intento.id,
      monto: Number(intento.monto),
      metodo: 'tarjeta',
      referencia: `MP-PRUEBA:${externoId}`,
    });

    await this.db.query(
      `UPDATE intentos_mercadopago
       SET estado = 'acreditado', pago_externo_id = ?, pago_local_id = ?
       WHERE id = ?`,
      [externoId, registrado.id, intento.id],
    );
    return {
      estado: 'acreditado',
      demostracion: true,
      mensaje: 'Pago de prueba registrado en la cuenta.',
    };
  }


  @Post(':id/mercadopago')
  @HttpCode(200)
  async crear(@Param('id', ParseUUIDPipe) id: string) {
    // Una credencial real nunca debe generar cobros desde esta integración.
    const vendedor = await this.solicitar('/users/me');
    if (
      vendedor.site_id !== 'MLM' ||
      !Array.isArray(vendedor.tags) ||
      !vendedor.tags.includes('test_user')
    ) {
      throw new ConflictException(
        'Esta integración solo admite vendedores de prueba de México.',
      );
    }

    const origen = new URL(
      this.config.getOrThrow<string>('MERCADOPAGO_PUBLIC_URL'),
    );
    if (origen.protocol !== 'https:') {
      throw new ConflictException('Configura una dirección pública HTTPS.');
    }
    const retorno = new URL('/', origen);
    retorno.searchParams.set('pago', 'retorno');

    // Verifica que exista la cuenta antes de iniciar la operación.
    await this.movimientos.resumen(id);

    return this.db.transaction('READ COMMITTED', async m => {
      const [cuenta] = await m.query(
        'SELECT estado, moneda FROM cuentas WHERE id = ? FOR UPDATE',
        [id],
      );
      if (!cuenta || cuenta.estado !== 'abierta') {
        throw new ConflictException('La cuenta debe estar abierta.');
      }
      if (cuenta.moneda !== 'MXN') {
        throw new ConflictException('La cuenta debe estar en pesos mexicanos.');
      }

      const [totales] = await m.query(
        `SELECT
           CAST(total_estancia AS CHAR) AS estancia,
           CAST(COALESCE(
             (SELECT SUM(subtotal) FROM consumos WHERE cuenta_id = ?),
             0
           ) AS CHAR) AS consumos,
           CAST(COALESCE(
             (SELECT SUM(monto) FROM pagos WHERE cuenta_id = ?),
             0
           ) AS CHAR) AS pagado
         FROM cuentas WHERE id = ?`,
        [id, id, id],
      );
      const saldo =
        centavos(totales.estancia) +
        centavos(totales.consumos) -
        centavos(totales.pagado);

      if (saldo <= 0n) {
        throw new ConflictException('La cuenta no tiene saldo pendiente.');
      }
      if (saldo > 999999999999n) {
        throw new ConflictException('El saldo supera el importe permitido.');
      }

      const [previo] = await m.query(
        `SELECT id FROM intentos_mercadopago
         WHERE cuenta_id = ? AND estado IN ('creando', 'pendiente')
         LIMIT 1`,
        [id],
      );
      if (previo) {
        throw new ConflictException(
          'Esta cuenta ya tiene un intento de pago. Consulta su estado antes de crear otro.',
        );
      }

      const intento = randomUUID();
      await m.query(
        `INSERT INTO intentos_mercadopago (id, cuenta_id, monto)
         VALUES (?, ?, ?)`,
        [intento, id, `${saldo / 100n}.${String(saldo % 100n).padStart(2, '0')}`],
      );

      const preferencia = await this.solicitar('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
          items: [{
            id: intento,
            title: 'Hotel 5 Letras - pago de prueba',
            quantity: 1,
            currency_id: 'MXN',
            unit_price: Number(saldo) / 100,
          }],
          external_reference: intento,
          back_urls: {
            success: retorno.href,
            pending: retorno.href,
            failure: retorno.href,
          },
          auto_return: 'approved',
          expires: true,
          expiration_date_to: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(),
        }),
      });

      if (
        typeof preferencia.id !== 'string' ||
        typeof preferencia.init_point !== 'string'
      ) {
        throw new ServiceUnavailableException(
          'Mercado Pago no devolvió un enlace válido.',
        );
      }
      const enlace = new URL(preferencia.init_point);
      if (
        enlace.protocol !== 'https:' ||
        enlace.hostname !== 'www.mercadopago.com.mx'
      ) {
        throw new ServiceUnavailableException(
          'El enlace recibido no corresponde a Mercado Pago México.',
        );
      }

      await m.query(
        `UPDATE intentos_mercadopago
         SET estado = 'pendiente', preferencia_id = ?, enlace = ?
         WHERE id = ?`,
        [preferencia.id, enlace.href, intento],
      );
      return { intento_id: intento, enlace: enlace.href, demostracion: true };
    });
  }
}
