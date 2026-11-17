import { IsString, Length, Matches } from 'class-validator';

export class BuscarConocimientosDto {
  @IsString()
  @Length(3, 500)
  @Matches(/\S/, {
    message: 'La pregunta debe contener texto.',
  })
  pregunta!: string;
}