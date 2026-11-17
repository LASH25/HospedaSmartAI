import { CredencialesInvalidas } from '../domain/usuario';
import type { Usuario } from '../domain/usuario';
import type { UsuariosRepository } from './ports/usuarios.repository';
import type { ClavesService } from './ports/claves.service';

export class ServicioAuth {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly claves: ClavesService,
  ) {}

  async iniciarSesion(
    email: string,
    password: string,
  ): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorEmail(
      email.trim().toLowerCase(),
    );

    const valida = await this.claves.verificar(
      password,
      usuario?.password_hash ?? '',
    );

    if (!usuario || !valida || !usuario.activo) {
      throw new CredencialesInvalidas(
        'Correo o contraseña incorrectos.',
      );
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo,
      creada_en: usuario.creada_en,
    };
  }

  async consultarPerfil(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorId(id);

    if (!usuario || !usuario.activo) {
      throw new CredencialesInvalidas(
        'La sesión ya no está disponible.',
      );
    }

    return usuario;
  }
}