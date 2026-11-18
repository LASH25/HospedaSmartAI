import {
  ConflictException, Injectable, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { centavos } from '../domain/dinero';
import { MysqlMovimientosRepository } from './database/mysql-movimientos.repository';
import { EmitirFacturaDto } from './http/facturacion.dto';

interface FacturaFila {
  id: string;
  cuenta_id: string;
  proveedor_id: string | null;
  uuid_fiscal: string | null;
  total: string;
  estado: string;
  solicitud: Record<string, unknown> | string;
}

@Injectable()
export class FacturacionService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly movimientos: MysqlMovimientosRepository,
  ) {}

  private clave() {
    const clave = this.config.get<string>('FACTURAPI_SECRET_KEY')?.trim();
    if (!clave?.startsWith('sk_test_')) {
      throw new ConflictException('Solo se permite Facturapi en TEST.');
    }
    return clave;
  }

  private async pedir(ruta: string, body?: Record<string, unknown>) {
    try {
      const r = await fetch(`https://www.facturapi.io/v2${ruta}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.clave()}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(25000),
      });
      const data = await r.json() as Record<string, unknown>;
      return { status: r.status, data };
    } catch {
      throw new ServiceUnavailableException(
        'No se recibió confirmación de Facturapi. Reintenta la misma operación.',
      );
    }
  }

  private solicitud(fila: FacturaFila): Record<string, unknown> {
    return typeof fila.solicitud === 'string'
      ? JSON.parse(fila.solicitud) as Record<string, unknown>
      : fila.solicitud;
  }

  private async guardar(
    fila: FacturaFila,
    factura: Record<string, unknown>,
  ) {
    const total = Number(factura.total);
    if (
      typeof factura.id !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(factura.id) ||
      factura.livemode !== false ||
      factura.external_id !== fila.id ||
      factura.currency !== 'MXN' ||
      !Number.isFinite(total) ||
      total <= 0 ||
      centavos(total.toFixed(2)) !== centavos(fila.total)
    ) {
      throw new ConflictException(
        'La factura recibida no coincide con la solicitud de prueba.',
      );
    }

    const uuid = typeof factura.uuid === 'string' ? factura.uuid : null;
    const emitida = factura.status === 'valid' && Boolean(uuid);
    const estado = emitida ? 'emitida' : 'pendiente';

    await this.db.query(
      `UPDATE facturas
       SET proveedor_id = ?, uuid_fiscal = ?, estado = ?
       WHERE id = ? AND ambiente = 'test'`,
      [factura.id, uuid, estado, fila.id],
    );
    return {
      id: fila.id,
      estado,
      uuid_fiscal: uuid,
      total: fila.total,
      demostracion: true,
      mensaje: emitida
        ? 'Factura de prueba emitida. Sin validez fiscal.'
        : 'Factura en procesamiento. Consulta nuevamente.',
    };
  }

  private async recuperar(fila: FacturaFila) {
    if (fila.proveedor_id) {
      const r = await this.pedir(
        `/invoices/${encodeURIComponent(fila.proveedor_id)}`,
      );
      if (r.status !== 200) {
        throw new ServiceUnavailableException(
          'No se pudo consultar la factura existente.',
        );
      }
      return this.guardar(fila, r.data);
    }

    const r = await this.pedir(
      `/invoices?external_id=${encodeURIComponent(fila.id)}&limit=100`,
    );
    if (r.status !== 200 || !Array.isArray(r.data.data)) {
      throw new ServiceUnavailableException(
        'No se pudo verificar si la factura ya fue creada.',
      );
    }
    const coincidencias = r.data.data.filter(
      (x: Record<string, unknown>) => x.external_id === fila.id,
    );
    if (coincidencias.length > 1) {
      throw new ConflictException(
        'Se encontraron varias facturas. Requiere revisión.',
      );
    }
    return coincidencias.length
      ? this.guardar(fila, coincidencias[0])
      : null;
  }

  async emitir(cuentaId: string, datos: EmitirFacturaDto) {
    this.clave();
    const resumen = await this.movimientos.resumen(cuentaId);
    if (
      resumen.cuenta.estado !== 'cerrada' ||
      resumen.saldo !== '0.00' ||
      resumen.moneda !== 'MXN' ||
      centavos(resumen.total) <= 0n
    ) {
      throw new ConflictException(
        'Se requiere una cuenta cerrada, liquidada y en MXN.',
      );
    }

    const customer = {
      legal_name: datos.razon_social,
      tax_id: datos.rfc,
      tax_system: datos.regimen_fiscal,
      address: { zip: datos.codigo_postal },
    };

    const fila = await this.db.transaction('READ COMMITTED', async m => {
      await m.query(
        'SELECT id FROM cuentas WHERE id = ? FOR UPDATE', [cuentaId],
      );
      const [previa] = await m.query<FacturaFila[]>(
        `SELECT id, cuenta_id, proveedor_id, uuid_fiscal, estado,
                CAST(total AS CHAR) AS total, solicitud
         FROM facturas WHERE cuenta_id = ? AND ambiente = 'test'`,
        [cuentaId],
      );
      if (previa) {
        const solicitud = this.solicitud(previa);
        if (
          JSON.stringify(solicitud.customer) !== JSON.stringify(customer) ||
          solicitud.use !== datos.uso_cfdi ||
          solicitud.payment_form !== datos.forma_pago
        ) {
          // MySQL puede reordenar las claves del objeto JSON.
          const anterior = solicitud.customer as typeof customer;
          if (
            anterior?.legal_name !== customer.legal_name ||
            anterior?.tax_id !== customer.tax_id ||
            anterior?.tax_system !== customer.tax_system ||
            anterior?.address?.zip !== customer.address.zip ||
            solicitud.use !== datos.uso_cfdi ||
            solicitud.payment_form !== datos.forma_pago
          ) {
            throw new ConflictException(
              'Esta cuenta ya tiene una solicitud con otros datos fiscales.',
            );
          }
        }
        return previa;
      }

      const id = randomUUID();
      const solicitud = {
        type: 'I',
        customer,
        use: datos.uso_cfdi,
        payment_form: datos.forma_pago,
        payment_method: 'PUE',
        currency: 'MXN',
        external_id: id,
        idempotency_key: id,
        items: [{
          quantity: 1,
          product: {
            description: 'Servicios de demostración del proyecto HospedaSmartAI',
            product_key: '01010101',
            unit_key: 'E48',
            price: Number(resumen.total),
            tax_included: true,
            taxes: [{ type: 'IVA', rate: 0.16 }],
          },
        }],
      };
      await m.query(
        `INSERT INTO facturas
         (id, cuenta_id, clave_idempotencia, total, solicitud)
         VALUES (?, ?, ?, ?, ?)`,
        [id, cuentaId, id, resumen.total, JSON.stringify(solicitud)],
      );
      return {
        id, cuenta_id: cuentaId, proveedor_id: null,
        uuid_fiscal: null, estado: 'pendiente',
        total: resumen.total, solicitud,
      } as FacturaFila;
    });

    const existente = await this.recuperar(fila);
    if (existente) return existente;

    const r = await this.pedir('/invoices', this.solicitud(fila));
    if ([200, 201, 202].includes(r.status)) {
      return this.guardar(fila, r.data);
    }
    if (r.status === 409) {
      const recuperada = await this.recuperar(fila);
      if (recuperada) return recuperada;
      throw new ConflictException(
        'La emisión sigue en proceso. Reintenta con los mismos datos.',
      );
    }
    throw new ConflictException(
      `Facturapi rechazó la solicitud: HTTP ${r.status}. Revisa los datos y la configuración de TEST.`,
    );
  }
    async consultar(cuentaId: string) {
    this.clave();
    await this.movimientos.resumen(cuentaId);
    const [fila] = await this.db.query<FacturaFila[]>(
      `SELECT id, cuenta_id, proveedor_id, uuid_fiscal, estado,
              CAST(total AS CHAR) AS total, solicitud
       FROM facturas WHERE cuenta_id = ? AND ambiente = 'test'`,
      [cuentaId],
    );
    if (!fila) {
      return {
        estado: 'sin_factura',
        demostracion: true,
        mensaje: 'Esta cuenta todavía no tiene una factura de prueba.',
      };
    }
    const resultado = await this.recuperar(fila);
    return resultado ?? {
      id: fila.id,
      estado: 'pendiente',
      demostracion: true,
      mensaje: 'Sin confirmación del proveedor. Reintenta la emisión con los mismos datos.',
    };
  }

  async descargar(cuentaId: string, formato: string) {
    if (!['pdf', 'xml'].includes(formato)) {
      throw new ConflictException('Solo se admite PDF o XML.');
    }
    const estado = await this.consultar(cuentaId);
    if (estado.estado !== 'emitida') {
      throw new ConflictException(
        'La factura debe estar emitida antes de descargarla.',
      );
    }
    const [fila] = await this.db.query<FacturaFila[]>(
      `SELECT proveedor_id FROM facturas
       WHERE cuenta_id = ? AND ambiente = 'test'`,
      [cuentaId],
    );
    if (!fila?.proveedor_id) {
      throw new ConflictException('No se encontró la factura.');
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(
        `https://www.facturapi.io/v2/invoices/${encodeURIComponent(fila.proveedor_id)}/${formato}`,
        {
          headers: { Authorization: `Bearer ${this.clave()}` },
          signal: AbortSignal.timeout(25000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo descargar el archivo. Intenta nuevamente.',
      );
    }
    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      throw new ServiceUnavailableException(
        'Facturapi no devolvió el archivo solicitado.',
      );
    }
    return Buffer.from(await respuesta.arrayBuffer());
  }
}
