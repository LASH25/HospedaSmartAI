import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
export interface PerfilAutorizado { id: string; rol: 'administrador' | 'recepcionista' | 'limpieza'; activo: boolean; }
export interface PeticionAutorizada extends Request { perfilAutorizado?: PerfilAutorizado; }
const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
@Injectable()
export class PermisosGuard implements CanActivate {
  private readonly usuarios: URL;
  private readonly servicio: string;
  private readonly readers: Record<string, string>;
  constructor(config: ConfigService) {
    this.usuarios = new URL(config.getOrThrow<string>('USUARIOS_SERVICE_URL'));
    this.servicio = config.getOrThrow<string>('SERVICE_NAME');
    this.readers = JSON.parse(config.get<string>('INTERNAL_READERS') ?? '{}') as Record<string, string>;
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PeticionAutorizada>();
    const path = req.path.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && path === '/salud') return true;
    // El perfil conserva su guard JWT local; el login conserva su límite de intentos.
    if (this.servicio === 'usuarios' && ((req.method === 'POST' && path === '/auth/login') || (req.method === 'GET' && path === '/auth/me'))) return true;
    const bearer = req.headers.authorization;
    if (!bearer) {
      const caller = req.headers['x-hospeda-servicio'];
      const clave = req.headers['x-hospeda-clave'];
      const permitida = typeof caller === 'string' && Object.hasOwn(this.readers, caller) ? this.readers[caller] : undefined;
      if (typeof clave !== 'string' || !permitida || Buffer.byteLength(clave) !== Buffer.byteLength(permitida) || !timingSafeEqual(Buffer.from(clave), Buffer.from(permitida)))
        throw new UnauthorizedException('Debes iniciar sesión.');
      const recurso = { habitaciones: 'habitaciones', huespedes: 'huespedes', reservas: 'reservas' }[this.servicio];
      const lectura = req.method === 'GET' && recurso && new RegExp(`^/${recurso}/${uuid}$`).test(path);
      const comando = caller === 'reservas' && req.method === 'POST' && (
        (this.servicio === 'habitaciones' && new RegExp(`^/interno/habitaciones/${uuid}/(?:entrada|salida)$`).test(path)) ||
        (this.servicio === 'cobros' && new RegExp(`^/interno/cuentas/${uuid}/(?:preparar-entrada|cerrar-salida)$`).test(path)));
      if (!lectura && !comando) throw new ForbiddenException('La credencial de servicio no permite esta operación.');
      return true;
    }
    if (path.startsWith('/interno/')) throw new ForbiddenException('Ruta exclusiva de comunicación entre servicios.');
    if (!/^Bearer \S+$/i.test(bearer)) throw new UnauthorizedException('Token inválido.');
    let perfil: PerfilAutorizado;
    try {
      const response = await fetch(new URL('/auth/me', this.usuarios), {
        headers: { Authorization: bearer }, signal: AbortSignal.timeout(5000),
      });
      if (response.status === 401) throw new UnauthorizedException('Token inválido o vencido.');
      if (!response.ok) throw new Error('Servicio de identidad no disponible.');
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Perfil inválido');
      const p = value as Record<string, unknown>;
      if (typeof p.id !== 'string' || !new RegExp(`^${uuid}$`).test(p.id) || p.activo !== true || !['administrador', 'recepcionista', 'limpieza'].includes(String(p.rol))) throw new Error('Perfil inválido');
      perfil = p as unknown as PerfilAutorizado;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new ServiceUnavailableException('No fue posible verificar la sesión.');
    }
    req.perfilAutorizado = perfil;
    if (perfil.rol === 'administrador') return true;
    if (this.servicio === 'usuarios') throw new ForbiddenException('Solo administración puede gestionar usuarios.');
    if (perfil.rol === 'recepcionista') {
      const r = new RegExp(`^/habitaciones/${uuid}(?:/ocupacion)?$`);
      const estado = new RegExp(`^/habitaciones/${uuid}/estado$`);
      const allowed =
        (this.servicio === 'habitaciones' && ((req.method === 'GET' && (path === '/habitaciones' || r.test(path))) || (req.method === 'PATCH' && estado.test(path)))) ||
        (this.servicio === 'huespedes' && ((req.method === 'GET' && (path === '/huespedes' || new RegExp(`^/huespedes/${uuid}$`).test(path))) || (req.method === 'POST' && path === '/huespedes'))) ||
        (this.servicio === 'reservas' && ((req.method === 'GET' && (path === '/reservas' || new RegExp(`^/reservas/${uuid}(?:/estancia)?$`).test(path))) || (req.method === 'POST' && (path === '/reservas' || new RegExp(`^/reservas/${uuid}/(?:check-in|check-out)$`).test(path))) || (req.method === 'PATCH' && new RegExp(`^/reservas/${uuid}/cancelar$`).test(path)))) ||
        (this.servicio === 'cobros' && ((req.method === 'GET' && new RegExp(`^/cuentas/${uuid}(?:/resumen)?$`).test(path)) || (req.method === 'POST' && (path === '/cuentas/abrir' || new RegExp(`^/cuentas/${uuid}/(?:consumos|pagos|cerrar)$`).test(path))))) ||
        (this.servicio === 'asistente' && ((req.method === 'POST' && path === '/asistente/preguntar') || (req.method === 'GET' && path === '/conocimientos/buscar')));
      if (allowed) return true;
      throw new ForbiddenException('Tu rol no tiene permiso para esta operación.');
    }
    if (this.servicio === 'asistente' && ((req.method === 'POST' && path === '/asistente/preguntar') || (req.method === 'GET' && path === '/conocimientos/buscar'))) return true;
    if (this.servicio === 'habitaciones') {
      if (req.method === 'GET' && (path === '/habitaciones' || new RegExp(`^/habitaciones/${uuid}(?:/ocupacion)?$`).test(path))) return true;
      if (req.method === 'PATCH' && new RegExp(`^/habitaciones/${uuid}/estado$`).test(path) && ['disponible', 'limpieza'].includes(req.body?.estado_operativo)) return true;
    }
    throw new ForbiddenException('Tu rol no tiene permiso para esta operación.');
  }
}
