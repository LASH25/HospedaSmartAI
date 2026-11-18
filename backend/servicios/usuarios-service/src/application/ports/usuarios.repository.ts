import type {
  NuevoUsuario,
  Usuario,
  UsuarioConCredenciales,
} from '../../domain/usuario';

export const USUARIOS_REPOSITORY = Symbol('USUARIOS_REPOSITORY');

export interface UsuariosRepository {
  crear(datos: NuevoUsuario): Promise<Usuario>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<UsuarioConCredenciales | null>;
}