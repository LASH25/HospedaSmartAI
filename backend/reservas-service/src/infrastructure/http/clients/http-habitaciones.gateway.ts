import { internalHeaders } from '../../security/internal-headers';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServicioHabitacionesNoDisponible } from '../../../domain/reserva';
import type {
  HabitacionConsultada,
  HabitacionesGateway,
} from '../../../application/ports/habitaciones.gateway';

@Injectable()
export class HttpHabitacionesGateway implements HabitacionesGateway {
  private readonly baseUrl: URL;
  private readonly internal: Record<string, string>;

  constructor(config: ConfigService) {
    this.internal = internalHeaders(config);
    this.baseUrl = new URL(
      config.getOrThrow<string>('HABITACIONES_SERVICE_URL'),
    );
  }

  async buscarPorId(id: string): Promise<HabitacionConsultada | null> {
    try {
      const url = new URL(
        `/habitaciones/${encodeURIComponent(id)}`,
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

      if (
        datos.id !== id ||
        typeof datos.estado_operativo !== 'string' ||
        !['disponible', 'limpieza', 'mantenimiento'].includes(
          datos.estado_operativo,
        ) ||
        typeof datos.precio_noche !== 'string' ||
        !/^(0|[1-9]\d{0,7})\.\d{2}$/.test(datos.precio_noche)
      ) {
        throw new Error('Datos de habitación incorrectos.');
      }

      return {
        id,
        precio_noche: datos.precio_noche,
        estado_operativo:
          datos.estado_operativo as HabitacionConsultada['estado_operativo'],
      };
    } catch {
      throw new ServicioHabitacionesNoDisponible(
        'No fue posible consultar el servicio de habitaciones. Intenta nuevamente.',
      );
    }
  }
}