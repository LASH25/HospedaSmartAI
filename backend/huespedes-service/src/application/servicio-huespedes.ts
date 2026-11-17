import {
  HuespedInvalido,
  HuespedNoEncontrado,
} from '../domain/huesped';
import type { NuevoHuesped } from '../domain/huesped';
import type { HuespedesRepository } from './ports/huespedes.repository';

export class ServicioHuespedes {
  constructor(private readonly repository: HuespedesRepository) {}

  crear(datos: NuevoHuesped) {
    const nombre = datos.nombre.trim();
    const email = datos.email.trim().toLowerCase();
    const telefono = datos.telefono.trim();

    if (nombre.length < 2 || nombre.length > 100) {
      throw new HuespedInvalido(
        'El nombre debe tener entre 2 y 100 caracteres.',
      );
    }

    if (email.length < 3 || email.length > 150) {
      throw new HuespedInvalido('El correo no es válido.');
    }

    if (
      telefono.length > 20 ||
      telefono.replace(/\D/g, '').length < 7
    ) {
      throw new HuespedInvalido(
        'El teléfono debe contener al menos 7 dígitos y máximo 20 caracteres.',
      );
    }

    return this.repository.crear({
      nombre,
      email,
      telefono,
    });
  }

  async actualizarContacto(id: string, datos: {nombre: string; telefono: string}) {
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ');
    const telefono = datos.telefono.trim();
    if (nombre.length < 2 || nombre.length > 100 || !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(nombre) || telefono.length > 20 || telefono.replace(/\D/g, '').length < 7 || !/^[0-9+() .-]+$/.test(telefono))
      throw new HuespedInvalido('Revisa el nombre y teléfono.');
    const huesped = await this.repository.actualizarContacto(id, {nombre, telefono});
    if (!huesped) throw new HuespedNoEncontrado('El huésped no existe.');
    return huesped;
  }

  listar() {
    return this.repository.listar();
  }

  async buscarPorId(id: string) {
    const huesped = await this.repository.buscarPorId(id);

    if (!huesped) {
      throw new HuespedNoEncontrado('El huésped no existe.');
    }

    return huesped;
  }
}