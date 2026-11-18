import { internalHeaders } from '../../security/internal-headers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServicioHuespedesNoDisponible } from '../../../domain/reserva';
import type { HuespedesGateway } from '../../../application/ports/huespedes.gateway';

@Injectable()
export class HttpHuespedesGateway implements HuespedesGateway {
  private readonly baseUrl: URL;
  private readonly internal: Record<string, string>;

  constructor(config: ConfigService) {
    this.internal = internalHeaders(config);
    this.baseUrl = new URL(
      config.getOrThrow<string>('HUESPEDES_SERVICE_URL'),
    );
  }

  async existe(id: string): Promise<boolean> {
    try {
      const url = new URL(
        `/huespedes/${encodeURIComponent(id)}`,
        this.baseUrl,
      );

      const respuesta = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: this.internal,
      });

      if (respuesta.status === 404) {
        return false;
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

      if (datos.id !== id) {
        throw new Error('El identificador del huésped no coincide.');
      }

      return true;
    } catch {
      throw new ServicioHuespedesNoDisponible(
        'No fue posible consultar el servicio de huéspedes. Intenta nuevamente.',
      );
    }
  }
}