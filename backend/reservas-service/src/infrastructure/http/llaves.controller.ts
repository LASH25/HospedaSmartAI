
import {
  Body, ConflictException, Controller, HttpCode,
  NotFoundException, Param, ParseUUIDPipe, Post, UnauthorizedException,
} from "@nestjs/common";
import { IsString, IsUUID, Matches } from "class-validator";
import { createHash, randomBytes } from "node:crypto";
import { DataSource } from "typeorm";
import type { EntityManager } from "typeorm";

class ValidarLlaveDto {
  @IsString() @Matches(/^[0-9a-f]{64}$/)
  token!: string;

  @IsUUID()
  habitacion_id!: string;
}

@Controller()
export class LlavesController {
  constructor(private readonly db: DataSource) {}

  private huella(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async estancia(m: EntityManager, id: string) {
    const [r] = await m.query(
      "SELECT id, habitacion_id, estado FROM reservas WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!r) throw new NotFoundException("La reserva no existe.");
    const [p] = await m.query(
      "SELECT fase FROM procesos_estancia WHERE reserva_id = ? FOR UPDATE",
      [id],
    );
    if (r.estado !== "en_estancia" || p?.fase !== "en_estancia")
      throw new ConflictException("La llave requiere una estancia con check-in completo y sin salida en proceso.");
    return r;
  }

  @Post("reservas/:id/llave")
  @HttpCode(200)
  async emitir(@Param("id", ParseUUIDPipe) id: string) {
    return this.db.transaction(async (m) => {
      const r = await this.estancia(m, id);
      const token = randomBytes(32).toString("hex");
      await m.query(
        `INSERT INTO llaves_digitales (reserva_id, token_hash, vence_en, revocada_en)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), NULL)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash),
           vence_en = VALUES(vence_en), revocada_en = NULL`,
        [id, this.huella(token)],
      );
      const [llave] = await m.query(
        `SELECT TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00', vence_en) AS vence_unix FROM llaves_digitales WHERE reserva_id = ?`,
        [id],
      );
      return {
        token, vence_en: new Date(Number(llave.vence_unix) * 1000).toISOString(),
        habitacion_id: r.habitacion_id,
        demostracion: true,
      };
    });
  }

  @Post("llaves/validar")
  @HttpCode(200)
  async validar(@Body() datos: ValidarLlaveDto) {
    const hash = this.huella(datos.token);
    return this.db.transaction(async (m) => {
      const [referencia] = await m.query(
        "SELECT reserva_id FROM llaves_digitales WHERE token_hash = ?", [hash],
      );
      if (!referencia) throw new UnauthorizedException("Llave inválida o reemplazada.");
      const r = await this.estancia(m, referencia.reserva_id);
      const [llave] = await m.query(
        `SELECT token_hash, revocada_en, vence_en > UTC_TIMESTAMP() AS vigente
         FROM llaves_digitales WHERE reserva_id = ? FOR UPDATE`,
        [r.id],
      );
      if (!llave || llave.token_hash !== hash || llave.revocada_en || !Number(llave.vigente))
        throw new UnauthorizedException("Llave vencida, revocada o reemplazada.");
      if (r.habitacion_id !== datos.habitacion_id)
        throw new UnauthorizedException("La llave no corresponde a esta habitación.");
      return { valida: true, demostracion: true, mensaje: "Acceso simulado autorizado." };
    });
  }
}
