export interface NuevaCuenta {
  reserva_id: string;
  huesped_id: string;
  total_estancia: string;
}

export interface Cuenta extends NuevaCuenta {
  id: string;
  moneda: 'MXN';
  estado: 'abierta' | 'cerrada';
  creada_en: Date;
}

export class CuentaNoEncontrada extends Error {}

export class ReservaCuentaNoEncontrada extends Error {}

export class ReservaNoFacturable extends Error {}

export class HuespedCuentaNoEncontrado extends Error {}

export class ServicioReservasNoDisponible extends Error {}
export class ServicioHuespedesNoDisponible extends Error {}
