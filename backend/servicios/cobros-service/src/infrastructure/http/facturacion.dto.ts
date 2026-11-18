import { Transform } from 'class-transformer';
import {
  IsIn, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';

const texto = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class EmitirFacturaDto {
  @Transform(texto)
  @IsString()
  @MinLength(2)
  @MaxLength(254)
  razon_social!: string;

  @Transform(texto)
  @IsString()
  @Matches(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/)
  rfc!: string;

  @IsString()
  @Matches(/^[0-9]{3}$/)
  regimen_fiscal!: string;

  @IsString()
  @Matches(/^[0-9]{5}$/)
  codigo_postal!: string;

  @IsIn(['G03', 'S01'])
  uso_cfdi!: 'G03' | 'S01';

  @IsIn(['01', '03', '04', '28'])
  forma_pago!: '01' | '03' | '04' | '28';
}
