import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MysqlUsuariosRepository } from '../database/mysql-usuarios.repository';
import { ScryptClavesService } from '../security/scrypt-claves.service';
import { EmailUsuarioDuplicado } from '../../domain/usuario';
import { CrearUsuarioDto } from './crear-usuario.dto';
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly repo: MysqlUsuariosRepository, private readonly claves: ScryptClavesService, private readonly db: DataSource) {}
  @Post()
  async crear(@Body() datos: CrearUsuarioDto) {
    try {
      return await this.repo.crear({ nombre: datos.nombre, email: datos.email,
        rol: datos.rol, password_hash: await this.claves.generar(datos.password) });
    } catch (e) {
      if (e instanceof EmailUsuarioDuplicado) throw new ConflictException('El correo ya está registrado.');
      throw e;
    }
  }
  @Get()
  listar() { return this.db.query('SELECT id, nombre, email, rol, activo, creada_en FROM usuarios ORDER BY nombre, id'); }
}
