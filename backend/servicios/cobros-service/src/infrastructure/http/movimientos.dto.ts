import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export class ConsumoDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(150)
  concepto!: string;
  @IsInt() @Min(1) @Max(1000)
  cantidad!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9999999999.99)
  precio_unitario!: number;
}
export class PagoDto {
  @IsUUID()
  clave_idempotencia!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99)
  monto!: number;
  @IsIn(['efectivo', 'tarjeta', 'transferencia'])
  metodo!: 'efectivo' | 'tarjeta' | 'transferencia';
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(100)
  referencia?: string | null;
}
