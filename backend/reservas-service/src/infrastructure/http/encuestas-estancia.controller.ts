
import {
  Body, ConflictException, Controller, Get, HttpCode,
  NotFoundException, Param, ParseUUIDPipe, Post,
} from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { DataSource } from "typeorm";

class EncuestaEstanciaDto {
  @IsInt() @Min(1) @Max(5)
  atencion!: number;

  @IsInt() @Min(1) @Max(5)
  limpieza!: number;

  @IsInt() @Min(1) @Max(5)
  satisfaccion!: number;

  @IsOptional() @IsString() @MaxLength(1000)
  comentario?: string;
}

@Controller("reservas")
export class EncuestasEstanciaController {
  constructor(private readonly db: DataSource) {}

  @Get(":id/encuesta-estancia")
  async consultar(@Param("id", ParseUUIDPipe) id: string) {
    const [r] = await this.db.query(
      `SELECT r.estado, p.fase,
         EXISTS(SELECT 1 FROM encuestas_estancia e WHERE e.reserva_id = r.id) AS respondida
       FROM reservas r
       LEFT JOIN procesos_estancia p ON p.reserva_id = r.id
       WHERE r.id = ?`,
      [id],
    );
    if (!r) throw new NotFoundException("La reserva no existe.");
    const respondida = Boolean(Number(r.respondida));
    return {
      disponible: r.estado === "finalizada" && r.fase === "finalizada" && !respondida,
      respondida,
    };
  }

  @Post(":id/encuesta-estancia")
  @HttpCode(200)
  async guardar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() datos: EncuestaEstanciaDto,
  ) {
    return this.db.transaction(async (m) => {
      const [r] = await m.query(
        "SELECT estado FROM reservas WHERE id = ? FOR UPDATE", [id],
      );
      if (!r) throw new NotFoundException("La reserva no existe.");
      const [p] = await m.query(
        "SELECT fase FROM procesos_estancia WHERE reserva_id = ? FOR UPDATE", [id],
      );
      if (r.estado !== "finalizada" || p?.fase !== "finalizada")
        throw new ConflictException("La encuesta solo está disponible después del check-out.");

      const [anterior] = await m.query(
        "SELECT reserva_id FROM encuestas_estancia WHERE reserva_id = ?", [id],
      );
      if (anterior) return { registrada: true, ya_existia: true };

      await m.query(
        `INSERT INTO encuestas_estancia
         (reserva_id, atencion, limpieza, satisfaccion, comentario)
         VALUES (?, ?, ?, ?, ?)`,
        [id, datos.atencion, datos.limpieza, datos.satisfaccion,
          (datos.comentario ?? "").trim()],
      );
      return { registrada: true, ya_existia: false };
    });
  }
}
