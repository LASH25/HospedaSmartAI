import { IsIn } from 'class-validator';
import type { EstadoHabitacion } from '../../domain/habitacion';

export class CambiarEstadoDto {
  @IsIn(['disponible', 'limpieza', 'mantenimiento'])
  estado_operativo!: EstadoHabitacion;
}