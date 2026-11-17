import {
  HabitacionNoDisponible,
  HabitacionNoEncontrada,
  HuespedNoEncontrado,
  ReservaInvalida,
  ReservaNoEncontrada,
  ReservaNoCancelable,
} from '../domain/reserva';
import type { SolicitudReserva } from '../domain/reserva';
import type { ReservasRepository } from './ports/reservas.repository';
import type { HabitacionesGateway } from './ports/habitaciones.gateway';
import type { HuespedesGateway } from './ports/huespedes.gateway';

export class ServicioReservas {
  constructor(
    private readonly repository: ReservasRepository,
    private readonly habitaciones: HabitacionesGateway,
    private readonly huespedes: HuespedesGateway,
  ) {}

  async crear(datos: SolicitudReserva) {
    const fechas = [datos.fecha_entrada, datos.fecha_salida];

    for (const fecha of fechas) {
      const valor = new Date(`${fecha}T00:00:00.000Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        Number.isNaN(valor.getTime()) ||
        valor.toISOString().slice(0, 10) !== fecha ||
        valor.getUTCFullYear() < 1
      ) {
        throw new ReservaInvalida(
          'La fecha debe ser válida: YYYY-MM-DD.',
        );
      }
    }

    if (datos.fecha_salida <= datos.fecha_entrada) {
      throw new ReservaInvalida(
        'La salida debe ser posterior a la entrada.',
      );
    }

    const existeHuesped = await this.huespedes.existe(
      datos.huesped_id,
    );

    if (!existeHuesped) {
      throw new HuespedNoEncontrado('El huésped no existe.');
    }

    const habitacion = await this.habitaciones.buscarPorId(
      datos.habitacion_id,
    );

    if (!habitacion) {
      throw new HabitacionNoEncontrada('La habitación no existe.');
    }

    if (habitacion.estado_operativo !== 'disponible') {
      throw new HabitacionNoDisponible(
        `La habitación está en ${habitacion.estado_operativo}.`,
      );
    }

    const entrada = new Date(`${datos.fecha_entrada}T00:00:00.000Z`);
    const salida = new Date(`${datos.fecha_salida}T00:00:00.000Z`);

    const noches = (salida.getTime() - entrada.getTime()) / 86400000;

    const precioCentavos = Number(
      habitacion.precio_noche.replace('.', ''),
    );

    const totalCentavos = precioCentavos * noches;

    if (
      !Number.isSafeInteger(totalCentavos) ||
      totalCentavos > 999999999999
    ) {
      throw new ReservaInvalida(
        'El total de la estancia supera el importe permitido.',
      );
    }

    return this.repository.crear({
      habitacion_id: datos.habitacion_id,
      huesped_id: datos.huesped_id,
      fecha_entrada: datos.fecha_entrada,
      fecha_salida: datos.fecha_salida,
      total: totalCentavos / 100,
    });
  }

  listar() {
    return this.repository.listar();
  }

  async cancelar(id: string) {
    const cancelada = await this.repository.cancelarConfirmada(id);

    if (cancelada) {
      return cancelada;
    }

    const reserva = await this.repository.buscarPorId(id);

    if (!reserva) {
      throw new ReservaNoEncontrada('La reserva no existe.');
    }

    if (reserva.estado === 'cancelada') {
      return reserva;
    }

    throw new ReservaNoCancelable(
      'Solo se pueden cancelar reservas confirmadas.',
    );
  }
    async buscarPorId(id: string) {
    const reserva = await this.repository.buscarPorId(id);

    if (!reserva) {
      throw new ReservaNoEncontrada('La reserva no existe.');
    }

    return reserva;
  }
}