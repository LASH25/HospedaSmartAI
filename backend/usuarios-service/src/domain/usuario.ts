export type RolUsuario =
  | 'administrador'
  | 'recepcionista'
  | 'limpieza';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  creada_en: Date;
}

export interface UsuarioConCredenciales extends Usuario {
  password_hash: string;
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  password_hash: string;
  rol: RolUsuario;
}

export class EmailUsuarioDuplicado extends Error {}
export class CredencialesInvalidas extends Error {}