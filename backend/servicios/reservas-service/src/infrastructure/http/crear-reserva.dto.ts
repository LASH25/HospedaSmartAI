import {
  IsDateString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CrearReservaDto {
  @IsUUID()
  habitacion_id!: string;

  @IsUUID()
  huesped_id!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_entrada!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_salida!: string;
}