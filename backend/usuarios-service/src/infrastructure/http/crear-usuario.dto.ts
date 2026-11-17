import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { RolUsuario } from '../../domain/usuario';
export class CrearUsuarioDto {
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(100)
  nombre!: string;
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(150)
  email!: string;
  @IsString() @MinLength(12) @MaxLength(128)
  password!: string;
  @IsIn(['administrador', 'recepcionista', 'limpieza'])
  rol!: RolUsuario;
}
