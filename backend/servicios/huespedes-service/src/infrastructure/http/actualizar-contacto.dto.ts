import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
export class ActualizarContactoDto {
  @IsString() @MinLength(2) @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M} .'-]*$/u)
  nombre!: string;
  @IsString() @MinLength(7) @MaxLength(20) @Matches(/^[0-9+() .-]+$/)
  telefono!: string;
}
