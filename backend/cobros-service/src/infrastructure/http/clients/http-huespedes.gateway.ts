import { internalHeaders } from '../../security/internal-headers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HuespedesGateway } from '../../../application/ports/huespedes.gateway';
import { ServicioHuespedesNoDisponible } from '../../../domain/cuenta';
@Injectable()
export class HttpHuespedesGateway implements HuespedesGateway {
  private readonly baseUrl: URL;
  private readonly internal: Record<string, string>;
  constructor(config: ConfigService) {
    this.internal = internalHeaders(config);
    this.baseUrl = new URL(config.getOrThrow<string>('HUESPEDES_SERVICE_URL'));
  }
  async buscarPorId(id: string): Promise<{ id: string } | null> {
    try {
      const respuesta = await fetch(new URL(`/huespedes/${encodeURIComponent(id)}`, this.baseUrl), {
        signal: AbortSignal.timeout(5000),
        headers: this.internal,
      });
      if (respuesta.status === 404) return null;
      if (!respuesta.ok) throw new Error('Respuesta incorrecta');
      const datos: unknown = await respuesta.json();
      if (!datos || typeof datos !== 'object' || Array.isArray(datos) ||
          (datos as Record<string, unknown>).id !== id) throw new Error('Formato incorrecto');
      return { id };
    } catch {
      throw new ServicioHuespedesNoDisponible('No fue posible consultar el servicio de huéspedes.');
    }
  }
}
