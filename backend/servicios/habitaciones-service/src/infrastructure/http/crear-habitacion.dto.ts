import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { TipoHabitacion } from '../../domain/habitacion';

export class CrearHabitacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  numero!: string;

  @IsIn(['individual', 'doble', 'suite'])
  tipo!: TipoHabitacion;

  @IsInt()
  @Min(1)
  @Max(20)
  capacidad!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  precio_noche!: number;
}