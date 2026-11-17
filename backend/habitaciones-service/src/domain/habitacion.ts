export type TipoHabitacion = 'individual' | 'doble' | 'suite';

export type EstadoHabitacion =
  | 'disponible'
  | 'limpieza'
  | 'mantenimiento';

export interface NuevaHabitacion {
  numero: string;
  tipo: TipoHabitacion;
  capacidad: number;
  precio_noche: number;
}

export interface Habitacion {
  id: string;
  numero: string;
  tipo: TipoHabitacion;
  capacidad: number;
  precio_noche: string;
  estado_operativo: EstadoHabitacion;
  creada_en: Date;
}

export class HabitacionInvalida extends Error {}

export class NumeroHabitacionDuplicado extends Error {}

export class HabitacionNoEncontrada extends Error {}
export class EstadoHabitacionNoPermitido extends Error {}

export class HabitacionOcupada extends Error {}
