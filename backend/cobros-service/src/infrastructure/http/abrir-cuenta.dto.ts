import { IsUUID } from 'class-validator';

export class AbrirCuentaDto {
  @IsUUID()
  reserva_id!: string;
}