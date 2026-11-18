import {
  HabitacionInvalida,
  EstadoHabitacionNoPermitido,
  HabitacionNoEncontrada,
} from '../domain/habitacion';
import type {
  EstadoHabitacion,
  NuevaHabitacion,
} from '../domain/habitacion';
import type { HabitacionesRepository } from './ports/habitaciones.repository';

export class ServicioHabitaciones {
  constructor(
    private readonly repository: HabitacionesRepository,
  ) {}

  listar() {
    return this.repository.listar();
  }

  crear(datos: NuevaHabitacion) {
    const numero = datos.numero.trim().toUpperCase();

    if (!numero || numero.length > 10) {
      throw new HabitacionInvalida(
        'El número de habitación debe tener entre 1 y 10 caracteres.',
      );
    }

    if (!['individual', 'doble', 'suite'].includes(datos.tipo)) {
      throw new HabitacionInvalida('El tipo de habitación no es válido.');
    }

    if (
      !Number.isInteger(datos.capacidad) ||
      datos.capacidad < 1 ||
      datos.capacidad > 20
    ) {
      throw new HabitacionInvalida(
        'La capacidad debe estar entre 1 y 20 personas.',
      );
    }

    if (
      !Number.isFinite(datos.precio_noche) ||
      datos.precio_noche < 0 ||
      datos.precio_noche > 99999999.99
    ) {
      throw new HabitacionInvalida('El precio por noche no es válido.');
    }

    return this.repository.crear({
      ...datos,
      numero,
    });
  }

  async cambiarEstado(id: string, estado: EstadoHabitacion, permitirMantenimiento = true) {
    if (!['disponible', 'limpieza', 'mantenimiento'].includes(estado)) {
      throw new HabitacionInvalida('El estado operativo no es válido.');
    }

    const habitacion = await this.repository.cambiarEstado(id, estado, permitirMantenimiento);

    if (!habitacion) {
      throw new HabitacionNoEncontrada('La habitación no existe.');
    }

    if (!permitirMantenimiento && habitacion.estado_operativo === 'mantenimiento') throw new EstadoHabitacionNoPermitido('Solo recepción o administración puede retirar mantenimiento.');
    return habitacion;
  }
    async buscarPorId(id: string) {
    const habitacion = await this.repository.buscarPorId(id);

    if (!habitacion) {
      throw new HabitacionNoEncontrada('La habitación no existe.');
    }

    return habitacion;
  }
}