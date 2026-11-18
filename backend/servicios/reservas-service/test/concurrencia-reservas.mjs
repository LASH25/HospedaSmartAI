
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const urls = {
  usuarios: process.env.USUARIOS_URL || "http://usuarios-service:3004",
  habitaciones: process.env.HABITACIONES_URL || "http://habitaciones-service:3002",
  huespedes: process.env.HUESPEDES_URL || "http://huespedes-service:3003",
  reservas: process.env.RESERVAS_URL || "http://reservas-service:3001",
};
let token;
async function llamar(base, ruta, method = "GET", body) {
  const r = await fetch(new URL(ruta, base), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function listar(base, ruta) {
  const r = await llamar(base, ruta);
  assert.equal(r.status, 200, `No se pudo consultar ${ruta}: HTTP ${r.status}`);
  assert.ok(Array.isArray(r.data), `Respuesta no válida en ${ruta}`);
  return r.data;
}
const dia = (valor) => String(valor).slice(0, 10);
const activa = (r) => ["confirmada", "en_estancia"].includes(r.estado);

async function main() {
  assert.ok(process.env.PORTAL_EMAIL && process.env.PORTAL_PASSWORD,
    "Faltan las credenciales de servicio en este contenedor.");
  const login = await llamar(urls.usuarios, "/auth/login", "POST", {
    email: process.env.PORTAL_EMAIL,
    password: process.env.PORTAL_PASSWORD,
  });
  assert.equal(login.status, 200, "No se pudo autenticar la cuenta de servicio.");
  assert.ok(login.data?.access_token, "No se recibió un token.");
  token = login.data.access_token;

  const habitaciones = await listar(urls.habitaciones, "/habitaciones");
  const hab = habitaciones.find((h) => h.numero === "TEST-D01");
  assert.ok(hab, "No existe TEST-D01. Se detuvo sin crear reservas.");
  assert.equal(hab.estado_operativo, "disponible",
    "TEST-D01 no está disponible. Se detuvo sin cambiar su estado.");

  const existentes = await listar(urls.reservas, "/reservas");
  let entrada, salida;
  for (let dias = 30; dias < 90; dias++) {
    const a = new Date();
    a.setUTCDate(a.getUTCDate() + dias);
    const b = new Date(a);
    b.setUTCDate(b.getUTCDate() + 1);
    const ini = a.toISOString().slice(0, 10);
    const fin = b.toISOString().slice(0, 10);
    const cruce = existentes.some((r) =>
      r.habitacion_id === hab.id && activa(r) &&
      dia(r.fecha_entrada) < fin && dia(r.fecha_salida) > ini
    );
    if (!cruce) { entrada = ini; salida = fin; break; }
  }
  assert.ok(entrada && salida, "No hay fechas libres para la prueba.");

  const run = randomUUID();
  const huesped = await llamar(urls.huespedes, "/huespedes", "POST", {
    nombre: "Prueba automatica concurrencia",
    email: `concurrencia-${run}@example.com`,
    telefono: "0000000000",
  });
  assert.ok([200, 201].includes(huesped.status) && huesped.data?.id,
    `No se pudo crear el huésped ficticio: HTTP ${huesped.status}`);
  const huespedId = huesped.data.id;
  const propia = (r) => r.huesped_id === huespedId &&
    r.habitacion_id === hab.id &&
    dia(r.fecha_entrada) === entrada && dia(r.fecha_salida) === salida;

  console.log("Prueba:", run);
  console.log("Habitacion: TEST-D01 | Fechas:", entrada, salida);
  let fallo;
  try {
    let liberar;
    const barrera = new Promise((resolve) => { liberar = resolve; });
    const inicios = [];
    const tareas = Array.from({ length: 12 }, async () => {
      await barrera;
      inicios.push(performance.now());
      return llamar(urls.reservas, "/reservas", "POST", {
        habitacion_id: hab.id, huesped_id: huespedId,
        fecha_entrada: entrada, fecha_salida: salida,
      });
    });
    liberar();
    const resultados = await Promise.allSettled(tareas);
    const estados = resultados.map((r) =>
      r.status === "fulfilled" ? r.value.status : "ERROR_RED"
    );
    const aceptadas = estados.filter((s) => s === 201 || s === 200).length;
    const conflictos = estados.filter((s) => s === 409).length;
    console.log("HTTP de las 12 peticiones:", estados.join(", "));
    console.log("Ventana de lanzamiento:",
      (Math.max(...inicios) - Math.min(...inicios)).toFixed(1), "ms");
    console.log("Aceptadas:", aceptadas, "| Rechazadas por conflicto:", conflictos);

    const persistidas = (await listar(urls.reservas, "/reservas"))
      .filter((r) => propia(r) && activa(r));
    console.log("Reservas activas persistidas de esta prueba:", persistidas.length);
    assert.equal(aceptadas, 1, "Debe aceptarse exactamente una reserva.");
    assert.equal(conflictos, 11, "Las otras once deben responder HTTP 409.");
    assert.equal(persistidas.length, 1, "La base debe conservar una sola reserva activa.");
  } catch (e) {
    fallo = e;
  } finally {
    const creadas = (await listar(urls.reservas, "/reservas")).filter(propia);
    for (const r of creadas) {
      if (r.estado !== "confirmada") continue;
      const cancelacion = await llamar(
        urls.reservas, `/reservas/${r.id}/cancelar`, "PATCH"
      );
      assert.ok(cancelacion.status === 200 && cancelacion.data?.estado === "cancelada",
        `No se confirmó la cancelación de la reserva de prueba ${r.id}`);
    }
    const restantes = (await listar(urls.reservas, "/reservas"))
      .filter((r) => propia(r) && activa(r));
    assert.equal(restantes.length, 0, "Quedaron reservas de prueba activas.");
    console.log("Limpieza verificada: ninguna reserva de esta prueba sigue activa.");
    console.log("El huésped ficticio y las reservas canceladas se conservan como evidencia.");
  }
  if (fallo) throw fallo;
  console.log("PRUEBA SUPERADA: una reserva aceptada y once conflictos.");
}

main().catch((e) => {
  console.error("PRUEBA NO SUPERADA:", e.message);
  process.exitCode = 1;
});
