import type { Cuenta, NuevaCuenta } from '../../domain/cuenta';

export const CUENTAS_REPOSITORY = Symbol('CUENTAS_REPOSITORY');

export interface CuentasRepository {
  crear(datos: NuevaCuenta): Promise<Cuenta>;
  buscarPorId(id: string): Promise<Cuenta | null>;
  buscarPorReserva(reservaId: string): Promise<Cuenta | null>;
}