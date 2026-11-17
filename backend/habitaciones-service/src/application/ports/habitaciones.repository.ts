import type {
  EstadoHabitacion,
  Habitacion,
  NuevaHabitacion,
} from '../../domain/habitacion';

export const HABITACIONES_REPOSITORY = Symbol(
  'HABITACIONES_REPOSITORY',
);

export interface HabitacionesRepository {
  listar(): Promise<Habitacion[]>;
  buscarPorId(id: string): Promise<Habitacion | null>;
  crear(datos: NuevaHabitacion): Promise<Habitacion>;
  cambiarEstado(
    id: string,
    estado: EstadoHabitacion,
    permitirMantenimiento?: boolean,
  ): Promise<Habitacion | null>;
}