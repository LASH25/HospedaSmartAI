import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID, randomBytes } from "node:crypto";

const require = createRequire(`${process.cwd()}/package.json`);
const { DataSource } = require("typeorm");
const { ScryptClavesService } = require(
  "./dist/infrastructure/security/scrypt-claves.service.js"
);
const { MysqlUsuariosRepository } = require(
  "./dist/infrastructure/database/mysql-usuarios.repository.js"
);

const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
});

const urls = {
  usuarios: "http://usuarios-service:3004",
  habitaciones: "http://habitaciones-service:3002",
  reservas: "http://reservas-service:3001",
  huespedes: "http://huespedes-service:3003",
  cobros: "http://cobros-service:3006",
};

let token;
let usuario;

async function llamar(servicio, ruta, method = "GET", body) {
  const r = await fetch(new URL(ruta, urls[servicio]), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: r.status,
    data: await r.json().catch(() => null),
  };
}

async function comprobar(nombre, servicio, ruta, esperado, method, body) {
  const r = await llamar(servicio, ruta, method, body);
  console.log(`${nombre}: HTTP ${r.status}`);
  assert.equal(r.status, esperado, `${nombre}: se esperaba HTTP ${esperado}`);
  return r.data;
}

try {
  await db.initialize();
  const password = randomBytes(24).toString("hex");
  const email = `permisos-${randomUUID()}@example.com`;
  const claves = new ScryptClavesService();
  const repo = new MysqlUsuariosRepository(db);

  usuario = await repo.crear({
    nombre: "Prueba temporal permisos limpieza",
    email,
    password_hash: await claves.generar(password),
    rol: "limpieza",
  });

  const login = await llamar("usuarios", "/auth/login", "POST", {
    email, password,
  });
  assert.equal(login.status, 200, "Falló el inicio de sesión temporal.");
  assert.ok(login.data?.access_token);
  token = login.data.access_token;

  const perfil = await comprobar(
    "Perfil propio", "usuarios", "/auth/me", 200
  );
  assert.equal(perfil.rol, "limpieza");

  await comprobar(
    "Consultar habitaciones", "habitaciones", "/habitaciones", 200
  );
  const solicitudes = await comprobar(
    "Consultar solicitudes", "habitaciones", "/solicitudes-habitacion", 200
  );
  assert.ok(Array.isArray(solicitudes));
  assert.ok(
    solicitudes.every(s => ["toallas", "limpieza"].includes(s.tipo)),
    "El listado expone solicitudes ajenas al rol de limpieza."
  );

  await comprobar("Listar usuarios bloqueado", "usuarios", "/usuarios", 403);
  await comprobar("Listar reservas bloqueado", "reservas", "/reservas", 403);
  await comprobar("Listar huéspedes bloqueado", "huespedes", "/huespedes", 403);

  const inexistente = randomUUID();
  await comprobar(
    "Consultar cobros bloqueado",
    "cobros", `/cuentas/${inexistente}/resumen`, 403
  );
  await comprobar(
    "Cambiar habitación a mantenimiento bloqueado",
    "habitaciones", `/habitaciones/${inexistente}/estado`, 403,
    "PATCH", { estado_operativo: "mantenimiento" }
  );
  await comprobar(
    "Crear usuario bloqueado",
    "usuarios", "/usuarios", 403, "POST", {}
  );
  await comprobar(
    "Crear enlace de pago bloqueado",
    "cobros", `/cuentas/${inexistente}/mercadopago`, 403, "POST", {}
  );

  token = undefined;
  await comprobar(
    "Consultar habitaciones sin sesión bloqueado",
    "habitaciones", "/habitaciones", 401
  );

  console.log("PRUEBA SUPERADA: accesos permitidos y restricciones de limpieza verificados.");
} catch (error) {
  console.error("PRUEBA NO SUPERADA:", error.message);
  process.exitCode = 1;
} finally {
  try {
    if (usuario && db.isInitialized) {
      await db.query(
        "DELETE FROM usuarios WHERE id = ? AND email = ? AND rol = ?",
        [usuario.id, usuario.email, "limpieza"]
      );
      const restantes = await db.query(
        "SELECT id FROM usuarios WHERE id = ?", [usuario.id]
      );
      assert.equal(restantes.length, 0);
      console.log("Limpieza verificada: usuario temporal eliminado.");
    }
  } catch (error) {
    console.error("No se pudo confirmar la eliminación del usuario temporal:", error.message);
    process.exitCode = 1;
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
