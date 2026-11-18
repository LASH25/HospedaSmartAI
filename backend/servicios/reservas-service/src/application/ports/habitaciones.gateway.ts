export interface HabitacionConsultada {
  id: string;
  precio_noche: string;
  estado_operativo: 'disponible' | 'limpieza' | 'mantenimiento';
}

export const HABITACIONES_GATEWAY = Symbol('HABITACIONES_GATEWAY');

export interface HabitacionesGateway {
  buscarPorId(id: string): Promise<HabitacionConsultada | null>;
}