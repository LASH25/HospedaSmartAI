export interface ReservaConsultada {
  id: string;
  huesped_id: string;
  total: string;
  estado: 'confirmada' | 'en_estancia' | 'finalizada' | 'cancelada';
}

export const RESERVAS_GATEWAY = Symbol('RESERVAS_GATEWAY');

export interface ReservasGateway {
  buscarPorId(id: string): Promise<ReservaConsultada | null>;
}