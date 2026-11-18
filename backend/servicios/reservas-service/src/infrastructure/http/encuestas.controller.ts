
import { Body, Controller, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { DataSource } from "typeorm";

class EncuestaReservaDto {
  @IsInt() @Min(1) @Max(5)
  facilidad!: number;

  @IsInt() @Min(1) @Max(5)
  claridad!: number;

  @IsInt() @Min(1) @Max(5)
  satisfaccion!: number;

  @IsOptional() @IsString() @MaxLength(1000)
  comentario?: string;
}

@Controller("reservas")
export class EncuestasController {
  constructor(private readonly db: DataSource) {}

  @Post(":id/encuesta")
  @HttpCode(200)
  async guardar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() datos: EncuestaReservaDto,
  ) {
    return this.db.transaction(async (m) => {
      const reservas = await m.query(
        "SELECT id FROM reservas WHERE id = ? FOR UPDATE", [id],
      );
      if (!reservas.length) throw new NotFoundException("La reserva no existe.");

      const anteriores = await m.query(
        "SELECT reserva_id FROM encuestas_reserva WHERE reserva_id = ?", [id],
      );
      if (anteriores.length) return { registrada: true, ya_existia: true };

      await m.query(
        "INSERT INTO encuestas_reserva (reserva_id, facilidad, claridad, satisfaccion, comentario) VALUES (?, ?, ?, ?, ?)",
        [id, datos.facilidad, datos.claridad, datos.satisfaccion, (datos.comentario ?? "").trim()],
      );
      return { registrada: true, ya_existia: false };
    });
  }
}
