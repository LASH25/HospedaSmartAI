import type { NuevaReserva, Reserva } from '../../domain/reserva';

export const RESERVAS_REPOSITORY = Symbol('RESERVAS_REPOSITORY');

export interface ReservasRepository {
  crear(datos: NuevaReserva): Promise<Reserva>;
  listar(): Promise<Reserva[]>;
  buscarPorId(id: string): Promise<Reserva | null>;
  cancelarConfirmada(id: string): Promise<Reserva | null>;
}