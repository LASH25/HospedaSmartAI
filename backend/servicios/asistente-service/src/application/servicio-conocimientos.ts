import type { ConocimientosRepository } from './ports/conocimientos.repository';

export class ServicioConocimientos {
  constructor(
    private readonly repository: ConocimientosRepository,
  ) {}

  buscar(pregunta: string) {
    const texto = pregunta
      .trim()
      .toLowerCase()
      .replace(/\bcheck[\s-]*in\b/g, 'entrada')
      .replace(/\bcheck[\s-]*out\b/g, 'salida');

    return this.repository.buscar(texto);
  }
}