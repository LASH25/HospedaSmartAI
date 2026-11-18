import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";

const require = createRequire(`${process.cwd()}/package.json`);
const { DataSource } = require("typeorm");
const { LlavesController } = require(
  "./dist/infrastructure/http/llaves.controller.js"
);

const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "Z",
  synchronize: false,
});

let conexion;
try {
  await db.initialize();
  conexion = db.createQueryRunner();
  await conexion.connect();
  await conexion.startTransaction();

  const [reserva] = await conexion.manager.query(
    `SELECT r.id, r.habitacion_id
     FROM reservas r
     JOIN procesos_estancia p ON p.reserva_id = r.id
     WHERE r.estado = 'finalizada' AND p.fase = 'finalizada'
     ORDER BY r.id LIMIT 1`
  );
  assert.ok(reserva, "Se necesita una estancia finalizada para esta prueba.");

  // Conserva el mismo orden de bloqueo que el controlador.
  const [r] = await conexion.manager.query(
    "SELECT estado FROM reservas WHERE id = ? FOR UPDATE",
    [reserva.id]
  );
  const [p] = await conexion.manager.query(
    "SELECT fase FROM procesos_estancia WHERE reserva_id = ? FOR UPDATE",
    [reserva.id]
  );
  assert.equal(r.estado, "finalizada");
  assert.equal(p.fase, "finalizada");

  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");

  await conexion.manager.query(
    `INSERT INTO llaves_digitales
       (reserva_id, token_hash, vence_en, revocada_en)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), NULL)
     ON DUPLICATE KEY UPDATE
       token_hash = VALUES(token_hash),
       vence_en = VALUES(vence_en),
       revocada_en = NULL`,
    [reserva.id, hash]
  );

  const [llave] = await conexion.manager.query(
    `SELECT token_hash, revocada_en,
            vence_en > UTC_TIMESTAMP() AS vigente
     FROM llaves_digitales WHERE reserva_id = ?`,
    [reserva.id]
  );
  assert.equal(llave.token_hash, hash);
  assert.equal(llave.revocada_en, null);
  assert.equal(Number(llave.vigente), 1);
  console.log("Llave temporal: coincide, no está revocada y no ha vencido.");

  // Ejecuta el controlador real dentro de nuestra transacción reversible.
  const controlador = new LlavesController({
    transaction: async (trabajo) => trabajo(conexion.manager),
  });

  await assert.rejects(
    () => controlador.validar({
      token,
      habitacion_id: reserva.habitacion_id,
    }),
    (error) =>
      error.getStatus?.() === 409 &&
      error.message.includes("check-in completo")
  );
  console.log("Validar llave en estancia finalizada: rechazado con HTTP 409.");

  await assert.rejects(
    () => controlador.emitir(reserva.id),
    (error) => error.getStatus?.() === 409
  );
  console.log("Emitir otra llave en estancia finalizada: rechazado con HTTP 409.");

  await conexion.rollbackTransaction();
  console.log("Transacción revertida: no se conservó la llave temporal.");
  console.log("PRUEBA SUPERADA: una estancia finalizada impide usar una llave aún vigente.");
} catch (error) {
  console.error("PRUEBA NO SUPERADA:", error.message);
  process.exitCode = 1;
} finally {
  if (conexion?.isTransactionActive) await conexion.rollbackTransaction();
  if (conexion) await conexion.release();
  if (db.isInitialized) await db.destroy();
}
