export interface SolicitudReserva {
  habitacion_id: string;
  huesped_id: string;
  fecha_entrada: string;
  fecha_salida: string;
}

export interface NuevaReserva extends SolicitudReserva {
  total: number;
}

export interface Reserva {
  id: string;
  habitacion_id: string;
  huesped_id: string;
  fecha_entrada: string;
  fecha_salida: string;
  total: string;
  estado: string;
  creada_en: Date;
}

export class ReservaInvalida extends Error {}

export class HabitacionNoDisponible extends Error {}

export class HabitacionNoEncontrada extends Error {}

export class ServicioHabitacionesNoDisponible extends Error {}

export class HuespedNoEncontrado extends Error {}

export class ServicioHuespedesNoDisponible extends Error {}

export class ReservaNoEncontrada extends Error {}

export class ReservaNoCancelable extends Error {}