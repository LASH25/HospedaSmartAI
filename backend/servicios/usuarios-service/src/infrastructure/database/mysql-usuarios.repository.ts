import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { EmailUsuarioDuplicado } from '../../domain/usuario';
import type {
  NuevoUsuario,
  Usuario,
  UsuarioConCredenciales,
} from '../../domain/usuario';
import type { UsuariosRepository } from '../../application/ports/usuarios.repository';

interface FilaUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: Usuario['rol'];
  activo: number | boolean;
  creada_en: Date;
}

interface FilaCredenciales extends FilaUsuario {
  password_hash: string;
}

@Injectable()
export class MysqlUsuariosRepository implements UsuariosRepository {
  constructor(private readonly dataSource: DataSource) {}

  private readonly columnas = `
    id,
    nombre,
    email,
    rol,
    activo,
    creada_en
  `;

  private convertir(fila: FilaUsuario): Usuario {
    return {
      id: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      rol: fila.rol,
      activo: Boolean(fila.activo),
      creada_en: fila.creada_en,
    };
  }

  async crear(datos: NuevoUsuario): Promise<Usuario> {
    const id = randomUUID();

    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO usuarios (
             id,
             nombre,
             email,
             password_hash,
             rol
           )
           VALUES (?, ?, ?, ?, ?)`,
          [
            id,
            datos.nombre,
            datos.email,
            datos.password_hash,
            datos.rol,
          ],
        );

        const filas = await manager.query<FilaUsuario[]>(
          `SELECT ${this.columnas}
           FROM usuarios
           WHERE id = ?`,
          [id],
        );

        const fila = filas[0];

        if (!fila) {
          throw new Error('No fue posible recuperar el usuario creado.');
        }

        return this.convertir(fila);
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const detalle = error.driverError as {
          code?: string;
          errno?: number;
        };

        if (
          detalle.code === 'ER_DUP_ENTRY' ||
          detalle.errno === 1062
        ) {
          throw new EmailUsuarioDuplicado(
            'Ya existe un usuario registrado con ese correo.',
          );
        }
      }

      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const filas = await this.dataSource.query<FilaUsuario[]>(
      `SELECT ${this.columnas}
       FROM usuarios
       WHERE id = ?`,
      [id],
    );

    const fila = filas[0];

    return fila ? this.convertir(fila) : null;
  }

  async buscarPorEmail(
    email: string,
  ): Promise<UsuarioConCredenciales | null> {
    const filas = await this.dataSource.query<FilaCredenciales[]>(
      `SELECT ${this.columnas}, password_hash
       FROM usuarios
       WHERE email = ?`,
      [email],
    );

    const fila = filas[0];

    if (!fila) {
      return null;
    }

    return {
      ...this.convertir(fila),
      password_hash: fila.password_hash,
    };
  }
}