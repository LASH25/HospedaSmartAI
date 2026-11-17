import type { Huesped, NuevoHuesped } from '../../domain/huesped';

export const HUESPEDES_REPOSITORY = Symbol('HUESPEDES_REPOSITORY');

export interface HuespedesRepository {
  crear(datos: NuevoHuesped): Promise<Huesped>;
  actualizarContacto(id: string, datos: {nombre: string; telefono: string}): Promise<Huesped | null>;
  listar(): Promise<Huesped[]>;
  buscarPorId(id: string): Promise<Huesped | null>;
}