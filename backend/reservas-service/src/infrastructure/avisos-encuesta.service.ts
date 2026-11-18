
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import { internalHeaders } from "./security/internal-headers";

@Injectable()
export class AvisosEncuestaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvisosEncuestaService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ocupado = false;
  private detenido = false;

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.get<string>("N8N_ENCUESTA_WEBHOOK_URL") ||
        !this.config.get<string>("ENCUESTA_PUBLIC_URL")) {
      this.logger.warn("Avisos de encuesta desactivados: falta configurar las URLs.");
      return;
    }
    this.timer = setInterval(() => { void this.procesar(); }, 15000);
    void this.procesar();
  }

  onModuleDestroy() {
    this.detenido = true;
    if (this.timer) clearInterval(this.timer);
  }

  private async tomar() {
    return this.db.transaction("READ COMMITTED", async (m) => {
      const [aviso] = await m.query(
        `SELECT reserva_id, intentos FROM avisos_encuesta
         WHERE (estado = "pendiente" AND proximo_intento_en <= UTC_TIMESTAMP())
            OR (estado = "procesando" AND bloqueo_hasta <= UTC_TIMESTAMP())
         ORDER BY creada_en ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      if (!aviso) return null;
      const bloqueo = randomUUID();
      await m.query(
        `UPDATE avisos_encuesta SET estado = "procesando",
         intentos = intentos + 1, bloqueo_token = ?,
         bloqueo_hasta = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 180 SECOND)
         WHERE reserva_id = ?`,
        [bloqueo, aviso.reserva_id],
      );
      return {
        reserva_id: String(aviso.reserva_id),
        intentos: Number(aviso.intentos) + 1,
        bloqueo,
      };
    });
  }

  private async entregar(id: string) {
    const [reserva] = await this.db.query(
      `SELECT r.huesped_id, r.estado, p.fase
       FROM reservas r
       LEFT JOIN procesos_estancia p ON p.reserva_id = r.id
       WHERE r.id = ?`,
      [id],
    );
    if (!reserva || reserva.estado !== "finalizada" || reserva.fase !== "finalizada")
      throw new Error("Estancia sin salida completa.");

    const url = new URL(
      `/huespedes/${encodeURIComponent(reserva.huesped_id)}`,
      this.config.getOrThrow<string>("HUESPEDES_SERVICE_URL"),
    );
    const respuesta = await fetch(url, {
      headers: internalHeaders(this.config),
      signal: AbortSignal.timeout(10000),
    });
    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      throw new Error("No se pudo consultar al huésped.");
    }
    const h = await respuesta.json() as {
      id?: string; email?: string; nombre?: string;
    };
    if (h.id !== reserva.huesped_id ||
        typeof h.email !== "string" || h.email.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h.email))
      throw new Error("Datos del huésped no válidos.");

    const enlace = new URL(
      this.config.getOrThrow<string>("ENCUESTA_PUBLIC_URL"),
    );
    if (!["http:", "https:"].includes(enlace.protocol))
      throw new Error("Enlace público no válido.");

    const r = await fetch(
      this.config.getOrThrow<string>("N8N_ENCUESTA_WEBHOOK_URL"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "encuesta_estancia",
          evento_id: `encuesta-estancia:${id}`,
          reserva_id: id,
          codigo: id.slice(0, 8).toUpperCase(),
          email: h.email,
          nombre: typeof h.nombre === "string" ? h.nombre : "huésped",
          enlace: enlace.href,
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    await r.body?.cancel();
    if (!r.ok) throw new Error("n8n no confirmó el envío.");
  }

  private async procesar() {
    if (this.ocupado || this.detenido) return;
    this.ocupado = true;
    try {
      const aviso = await this.tomar();
      if (!aviso) return;
      try {
        await this.entregar(aviso.reserva_id);
        await this.db.query(
          `UPDATE avisos_encuesta SET estado = "enviada",
           enviada_en = UTC_TIMESTAMP(), bloqueo_token = NULL, bloqueo_hasta = NULL
           WHERE reserva_id = ? AND bloqueo_token = ? AND estado = "procesando"`,
          [aviso.reserva_id, aviso.bloqueo],
        );
        this.logger.log(`Aviso confirmado: ${aviso.reserva_id}`);
      } catch {
        const segundos = Math.min(3600, 30 * 2 ** Math.min(aviso.intentos, 7));
        await this.db.query(
          `UPDATE avisos_encuesta SET estado = "pendiente",
           proximo_intento_en = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
           bloqueo_token = NULL, bloqueo_hasta = NULL
           WHERE reserva_id = ? AND bloqueo_token = ? AND estado = "procesando"`,
          [segundos, aviso.reserva_id, aviso.bloqueo],
        );
        this.logger.warn(`Aviso pendiente de reintento: ${aviso.reserva_id}`);
      }
    } catch {
      this.logger.warn("No se pudo procesar la cola de avisos; se reintentará.");
    } finally {
      this.ocupado = false;
    }
  }
}
