import { internalHeaders } from '../../security/internal-headers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServicioReservasNoDisponible } from '../../../domain/cuenta';
import type {
  ReservaConsultada,
  ReservasGateway,
} from '../../../application/ports/reservas.gateway';

@Injectable()
export class HttpReservasGateway implements ReservasGateway {
  private readonly baseUrl: URL;
  private readonly internal: Record<string, string>;

  constructor(config: ConfigService) {
    this.internal = internalHeaders(config);
    this.baseUrl = new URL(
      config.getOrThrow<string>('RESERVAS_SERVICE_URL'),
    );
  }

  async buscarPorId(id: string): Promise<ReservaConsultada | null> {
    try {
      const url = new URL(
        `/reservas/${encodeURIComponent(id)}`,
        this.baseUrl,
      );

      const respuesta = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: this.internal,
      });

      if (respuesta.status === 404) {
        return null;
      }

      if (!respuesta.ok) {
        throw new Error('Respuesta incorrecta del servicio.');
      }

      const contenido: unknown = await respuesta.json();

      if (
        typeof contenido !== 'object' ||
        contenido === null ||
        Array.isArray(contenido)
      ) {
        throw new Error('Formato de respuesta incorrecto.');
      }

      const datos = contenido as Record<string, unknown>;

      const formatoUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (
        datos.id !== id ||
        typeof datos.huesped_id !== 'string' ||
        !formatoUuid.test(datos.huesped_id) ||
        typeof datos.total !== 'string' ||
        !/^(0|[1-9]\d{0,9})\.\d{2}$/.test(datos.total) ||
        typeof datos.estado !== 'string' ||
        !['confirmada', 'en_estancia', 'finalizada', 'cancelada'].includes(
          datos.estado,
        )
      ) {
        throw new Error('Datos de reserva incorrectos.');
      }

      return {
        id,
        huesped_id: datos.huesped_id,
        total: datos.total,
        estado: datos.estado as ReservaConsultada['estado'],
      };
    } catch {
      throw new ServicioReservasNoDisponible(
        'No fue posible consultar el servicio de reservas. Intenta nuevamente.',
      );
    }
  }
}