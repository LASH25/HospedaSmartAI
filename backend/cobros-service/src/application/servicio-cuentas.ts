import {
  CuentaNoEncontrada,
  HuespedCuentaNoEncontrado,
  ReservaCuentaNoEncontrada,
  ReservaNoFacturable,
} from '../domain/cuenta';
import type { CuentasRepository } from './ports/cuentas.repository';
import type { ReservasGateway } from './ports/reservas.gateway';
import type { HuespedesGateway } from './ports/huespedes.gateway';

export class ServicioCuentas {
  constructor(
    private readonly repository: CuentasRepository,
    private readonly reservas: ReservasGateway,
    private readonly huespedes: HuespedesGateway,
  ) {}

  async abrir(reservaId: string) {
    const existente = await this.repository.buscarPorReserva(reservaId);

    if (existente) {
      return existente;
    }

    const reserva = await this.reservas.buscarPorId(reservaId);

    if (!reserva) {
      throw new ReservaCuentaNoEncontrada('La reserva no existe.');
    }

    if (reserva.estado === 'cancelada') {
      throw new ReservaNoFacturable(
        'No se puede abrir una cuenta para una reserva cancelada.',
      );
    }

    const huesped = await this.huespedes.buscarPorId(
      reserva.huesped_id,
    );

    if (!huesped) {
      throw new HuespedCuentaNoEncontrado(
        'El huésped de la reserva no está registrado.',
      );
    }

    return this.repository.crear({
      reserva_id: reserva.id,
      huesped_id: reserva.huesped_id,
      total_estancia: reserva.total,
    });
  }

  async buscarPorId(id: string) {
    const cuenta = await this.repository.buscarPorId(id);

    if (!cuenta) {
      throw new CuentaNoEncontrada('La cuenta no existe.');
    }

    return cuenta;
  }
}