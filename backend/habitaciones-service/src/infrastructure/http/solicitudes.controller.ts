
import {
  Body, ConflictException, Controller, ForbiddenException,
  Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req,
} from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { DataSource } from "typeorm";
import type { PeticionAutorizada } from "../security/permisos.guard";

class CrearSolicitudDto {
  @IsUUID() id!: string;
  @IsUUID() reserva_id!: string;
  @IsIn(["toallas", "limpieza", "mantenimiento"]) tipo!: string;
  @IsOptional() @IsString() @MaxLength(1000) detalle?: string;
}
class EstadoSolicitudDto {
  @IsIn(["en_atencion", "completada"]) estado!: string;
}

@Controller("solicitudes-habitacion")
export class SolicitudesController {
  constructor(private readonly db: DataSource) {}

  @Post()
  @HttpCode(200)
  crear(@Body() datos: CrearSolicitudDto) {
    return this.db.transaction(async (m) => {
      const detalle = (datos.detalle ?? "").trim();
      const [referencia] = await m.query(
        "SELECT habitacion_id FROM estancias_habitacion WHERE reserva_id = ?",
        [datos.reserva_id],
      );
      if (!referencia) throw new ConflictException("La solicitud requiere una estancia activa.");

      await m.query("SELECT id FROM habitaciones WHERE id = ? FOR UPDATE",
        [referencia.habitacion_id]);
      const [estancia] = await m.query(
        "SELECT habitacion_id, estado FROM estancias_habitacion WHERE reserva_id = ? FOR UPDATE",
        [datos.reserva_id],
      );
      const [anterior] = await m.query(
        "SELECT * FROM solicitudes_habitacion WHERE id = ?", [datos.id],
      );
      if (anterior) {
        if (anterior.reserva_id !== datos.reserva_id ||
            anterior.tipo !== datos.tipo || anterior.detalle !== detalle)
          throw new ConflictException("Ese identificador ya corresponde a otra solicitud.");
        return anterior;
      }
      if (!estancia || estancia.estado !== "en_estancia")
        throw new ConflictException("La solicitud requiere una estancia activa.");

      await m.query(
        `INSERT INTO solicitudes_habitacion
         (id, reserva_id, habitacion_id, tipo, detalle)
         VALUES (?, ?, ?, ?, ?)`,
        [datos.id, datos.reserva_id, estancia.habitacion_id, datos.tipo, detalle],
      );
      return (await m.query(
        "SELECT * FROM solicitudes_habitacion WHERE id = ?", [datos.id],
      ))[0];
    });
  }

  @Get()
  listar(@Req() req: PeticionAutorizada) {
    const soloLimpieza = req.perfilAutorizado?.rol === "limpieza";
    return this.db.query(
      `SELECT s.*, h.numero AS habitacion_numero
       FROM solicitudes_habitacion s
       JOIN habitaciones h ON h.id = s.habitacion_id
       WHERE (? = 0 OR s.tipo IN ("toallas", "limpieza"))
       ORDER BY s.creada_en DESC, s.id DESC LIMIT 100`,
      [soloLimpieza ? 1 : 0],
    );
  }

  @Get("reserva/:id")
  listarReserva(@Param("id", ParseUUIDPipe) id: string) {
    return this.db.query(
      `SELECT id, tipo, detalle, estado, creada_en, actualizada_en, completada_en
       FROM solicitudes_habitacion
       WHERE reserva_id = ? ORDER BY creada_en DESC, id DESC LIMIT 100`,
      [id],
    );
  }

  @Patch(":id/estado")
  actualizar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() datos: EstadoSolicitudDto,
    @Req() req: PeticionAutorizada,
  ) {
    return this.db.transaction(async (m) => {
      const [s] = await m.query(
        "SELECT * FROM solicitudes_habitacion WHERE id = ? FOR UPDATE", [id],
      );
      if (!s) throw new NotFoundException("La solicitud no existe.");
      if (req.perfilAutorizado?.rol === "limpieza" && s.tipo === "mantenimiento")
        throw new ForbiddenException("Mantenimiento requiere recepción o administración.");
      if (s.estado === datos.estado) return s;
      const siguiente = s.estado === "pendiente" ? "en_atencion"
        : s.estado === "en_atencion" ? "completada" : null;
      if (datos.estado !== siguiente)
        throw new ConflictException("La solicitud debe pasar de pendiente a en atención y después a completada.");
      await m.query(
        `UPDATE solicitudes_habitacion SET estado = ?, atendida_por = ?,
         completada_en = CASE WHEN ? = "completada" THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id = ?`,
        [datos.estado, req.perfilAutorizado?.id ?? null, datos.estado, id],
      );
      return (await m.query(
        "SELECT * FROM solicitudes_habitacion WHERE id = ?", [id],
      ))[0];
    });
  }
}
