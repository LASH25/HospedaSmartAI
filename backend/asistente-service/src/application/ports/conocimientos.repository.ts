import type { Conocimiento } from '../../domain/conocimiento';

export const CONOCIMIENTOS_REPOSITORY = Symbol(
  'CONOCIMIENTOS_REPOSITORY',
);

export interface ConocimientosRepository {
  buscar(texto: string): Promise<Conocimiento[]>;
}