import type { ConfigService } from '@nestjs/config';
export function internalHeaders(config: ConfigService): Record<string, string> {
  return {
    'x-hospeda-servicio': config.getOrThrow<string>('INTERNAL_SERVICE_NAME'),
    'x-hospeda-clave': config.getOrThrow<string>('INTERNAL_SERVICE_TOKEN'),
  };
}
