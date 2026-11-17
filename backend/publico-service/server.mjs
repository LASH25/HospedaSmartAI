import * as encuestaCrypto from "node:crypto";
// publico-service: única puerta de entrada pública de HospedaSmart.
// Sin dependencias externas (solo Node 22). Habla con los microservicios internos usando
// una cuenta de servicio (rol recepcionista) y expone únicamente operaciones mínimas.
import http from "node:http";
import { crearAcceso, cookieSesion, AccesoError } from "./estancia.mjs";
import { crearVerificacion, crearEnvioGmail, VerificacionError } from "./verificacion.mjs";
import { pathToFileURL } from "node:url";

const TIPOS = { individual: "Sencilla", doble: "Doble", suite: "Suite" };

class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export function leerConfig(env = process.env) {
  const n = (valor, defecto) => (valor === undefined || valor === "" ? defecto : Number(valor));
  return {
    port: n(env.PORT, 3010),
    sessionSecure: env.SESSION_SECURE === "1" || (env.PUBLIC_ORIGIN ?? "").startsWith("https://"),
    gmailUsuario: env.GMAIL_USUARIO ?? "",
    gmailClave: env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") ?? "",
    usuarios: env.USUARIOS_URL ?? "http://usuarios-service:3004",
    habitaciones: env.HABITACIONES_URL ?? "http://habitaciones-service:3002",
    reservas: env.RESERVAS_URL ?? "http://reservas-service:3001",
    huespedes: env.HUESPEDES_URL ?? "http://huespedes-service:3003",
    asistente: env.ASISTENTE_URL ?? "http://asistente-service:3005",
    n8nWebhookUrl: env.N8N_WEBHOOK_URL ?? "",
    portalEmail: env.PORTAL_EMAIL ?? "",
    portalPassword: env.PORTAL_PASSWORD ?? "",
    trustProxy: env.TRUST_PROXY === "1",
    origin: env.PUBLIC_ORIGIN ?? "",
    turnstileSecret: env.TURNSTILE_SECRET ?? "",
    tz: env.TZ_HOTEL ?? "America/Mexico_City",
    maxNoches: n(env.MAX_NOCHES, 14),
    maxAnticipacionDias: n(env.MAX_ANTICIPACION_DIAS, 365),
    maxReservasPorCorreo: n(env.MAX_RESERVAS_POR_CORREO, 2),
    maxReservasDia: n(env.MAX_RESERVAS_DIA, 100),
    limiteReservasHoraIp: n(env.LIMITE_RESERVAS_HORA_IP, 5),
    limiteConsultasHoraIp: n(env.LIMITE_CONSULTAS_HORA_IP, 30),
    limiteAsistenteHoraIp: n(env.LIMITE_ASISTENTE_HORA_IP, 20),
    limiteDisponibilidadMinutoIp: n(env.LIMITE_DISPONIBILIDAD_MINUTO_IP, 30),
    asistenteConcurrencia: n(env.ASISTENTE_CONCURRENCIA, 2),
    timeoutMs: n(env.TIMEOUT_MS, 10000),
    timeoutAsistenteMs: n(env.TIMEOUT_ASISTENTE_MS, 100000),
  };
}

export function crearServidor(sobrescribir = {}, deps = {}) {
  const cfg = { ...leerConfig(), ...sobrescribir };
  function firmaEncuesta(payload) {
    return encuestaCrypto.createHmac("sha256", cfg.portalPassword)
      .update("hospedasmart:encuesta-reserva:v1:" + payload).digest();
  }
  function emitirTokenEncuesta(id) {
    const payload = Buffer.from(JSON.stringify({
      id, vence: Date.now() + 24 * 60 * 60 * 1000,
    })).toString("base64url");
    return payload + "." + firmaEncuesta(payload).toString("base64url");
  }
  function validarTokenEncuesta(token) {
    const invalido = () => new ErrorHttp(400, "La encuesta no es válida o ha vencido.");
    if (typeof token !== "string" || token.length > 600) throw invalido();
    const partes = token.split(".");
    if (partes.length !== 2) throw invalido();
    const [payload, firma] = partes;
    const esperada = firmaEncuesta(payload);
    const recibida = Buffer.from(firma, "base64url");
    if (recibida.length !== esperada.length ||
        !encuestaCrypto.timingSafeEqual(recibida, esperada)) throw invalido();
    let datos;
    try { datos = JSON.parse(Buffer.from(payload, "base64url").toString()); }
    catch { throw invalido(); }
    if (!datos || typeof datos.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(datos.id) ||
        !Number.isFinite(datos.vence) || datos.vence <= Date.now()) throw invalido();
    return datos.id;
  }

  const verificarTurnstile =
    deps.verificarTurnstile ??
    (async (token, ip) => {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: new URLSearchParams({ secret: cfg.turnstileSecret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json();
      return j.success === true;
    });

  // ---------- utilidades de fecha (zona horaria del hotel) ----------
  const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: cfg.tz }).format(new Date());
  const aUtc = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const diasEntre = (a, b) => Math.round((aUtc(b) - aUtc(a)) / 86400000);
  const fechaValida = (t) => {
    if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
    return new Date(aUtc(t)).toISOString().slice(0, 10) === t;
  };
  const dia = (v) => String(v).slice(0, 10);

  // ---------- límites de uso ----------
  const ventanas = new Map();
  const permitir = (clave, max, ventanaMs) => {
    const ahora = Date.now();
    const lista = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (lista.length >= max) {
      ventanas.set(clave, lista);
      return false;
    }
    lista.push(ahora);
    ventanas.set(clave, lista);
    return true;
  };
  const limpiador = setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of ventanas) {
      const f = v.filter((t) => ahora - t < 3600000);
      if (f.length) ventanas.set(k, f);
      else ventanas.delete(k);
    }
  }, 600000);
  limpiador.unref();
  const exigirLimite = (clave, max, ventanaMs) => {
    if (!permitir(clave, max, ventanaMs))
      throw new ErrorHttp(429, "Demasiadas solicitudes. Intenta de nuevo más tarde.");
  };

  const correo = deps.correo ?? crearVerificacion({ enviar: deps.enviarCorreo ?? crearEnvioGmail(cfg), limitar: exigirLimite });

  const enviarAcceso = deps.enviarAcceso ?? deps.enviarCorreo ?? crearEnvioGmail(cfg);
  const acceso = crearAcceso({ enviar: (email, codigo) => enviarAcceso(email, codigo, "acceso"), limitar: exigirLimite });

  const ipDe = (req) => {
    if (cfg.trustProxy) {
      const xff = req.headers["x-forwarded-for"];
      if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
    }
    return req.socket.remoteAddress ?? "desconocida";
  };

  // ---------- llamadas a servicios internos ----------
  async function llamar(base, ruta, { method = "GET", body, token, timeout } = {}) {
    let r;
    try {
      r = await fetch(new URL(ruta, base), {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout ?? cfg.timeoutMs),
      });
    } catch {
      throw new ErrorHttp(503, "El servicio no está disponible por ahora.");
    }
    let data = null;
    try {
      data = await r.json();
    } catch {
      /* sin cuerpo JSON */
    }
    return { status: r.status, data };
  }

  let token = null;
  let tokenExpira = 0;
  let loginEnCurso = null;
  async function obtenerToken(forzar = false) {
    if (!forzar && token && Date.now() < tokenExpira) return token;
    loginEnCurso ??= (async () => {
      try {
        const r = await llamar(cfg.usuarios, "/auth/login", {
          method: "POST",
          body: { email: cfg.portalEmail, password: cfg.portalPassword },
        });
        if (r.status !== 200 || !r.data?.access_token) {
          console.error(JSON.stringify({ nivel: "error", msg: "login de servicio rechazado", status: r.status }));
          throw new ErrorHttp(503, "El servicio no está disponible por ahora.");
        }
        token = r.data.access_token;
        tokenExpira = Date.now() + Math.max(60, Number(r.data.expires_in ?? 3600) - 60) * 1000;
        return token;
      } finally {
        loginEnCurso = null;
      }
    })();
    return loginEnCurso;
  }
  async function conAuth(base, ruta, opts = {}) {
    let r = await llamar(base, ruta, { ...opts, token: await obtenerToken() });
    if (r.status === 401) r = await llamar(base, ruta, { ...opts, token: await obtenerToken(true) });
    return r;
  }
  const listar = async (base, ruta) => {
    const r = await conAuth(base, ruta);
    if (r.status !== 200 || !Array.isArray(r.data)) throw new ErrorHttp(503, "El servicio no está disponible por ahora.");
    return r.data;
  };

  // ---------- validación ----------
  const emailValido = (e) => typeof e === "string" && e.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const normalizarEmail = (e) => (typeof e === "string" ? e.trim().toLowerCase() : "");

  function validarFechas(entrada, salida) {
    if (!fechaValida(entrada) || !fechaValida(salida)) throw new ErrorHttp(400, "Las fechas deben tener formato AAAA-MM-DD.");
    const h = hoy();
    if (entrada < h) throw new ErrorHttp(400, "La llegada no puede ser en el pasado.");
    const noches = diasEntre(entrada, salida);
    if (noches < 1) throw new ErrorHttp(400, "La salida debe ser después de la llegada.");
    if (noches > cfg.maxNoches) throw new ErrorHttp(400, `Las estancias son de máximo ${cfg.maxNoches} noches.`);
    if (diasEntre(h, entrada) > cfg.maxAnticipacionDias) throw new ErrorHttp(400, "La fecha de llegada es demasiado lejana.");
    return noches;
  }
  function validarPersonas(p) {
    if (p === undefined || p === null || p === "") return 1;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 20) throw new ErrorHttp(400, "El número de personas no es válido.");
    return n;
  }

  // ---------- disponibilidad ----------
  const cancelada = (r) => /cancel/i.test(String(r.estado ?? ""));
  async function habitacionesLibres(entrada, salida, personas, tipo) {
    const [habs, reservas] = await Promise.all([
      listar(cfg.habitaciones, "/habitaciones"),
      listar(cfg.reservas, "/reservas"),
    ]);
    const ocupadas = new Set(
      reservas
        .filter((r) => !cancelada(r) && dia(r.fecha_entrada) < salida && dia(r.fecha_salida) > entrada)
        .map((r) => r.habitacion_id),
    );
    return habs
      .filter(
        (h) =>
          h.estado_operativo !== "mantenimiento" &&
          Object.hasOwn(TIPOS, h.tipo) &&
          (!tipo || h.tipo === tipo) &&
          Number(h.capacidad) >= personas &&
          !ocupadas.has(h.id),
      )
      .sort((a, b) => Number(a.precio_noche) - Number(b.precio_noche) || String(a.numero).localeCompare(String(b.numero)));
  }

  async function disponibilidad(q) {
    const entrada = q.get("fecha_entrada") ?? "";
    const salida = q.get("fecha_salida") ?? "";
    const noches = validarFechas(entrada, salida);
    const personas = validarPersonas(q.get("personas") ?? undefined);
    const libres = await habitacionesLibres(entrada, salida, personas);
    const porTipo = new Map();
    for (const h of libres) {
      const actual = porTipo.get(h.tipo);
      const precio = Number(h.precio_noche);
      if (!actual) porTipo.set(h.tipo, { tipo: h.tipo, nombre: TIPOS[h.tipo], capacidad: Number(h.capacidad), precio_noche: precio });
      else {
        actual.capacidad = Math.max(actual.capacidad, Number(h.capacidad));
        actual.precio_noche = Math.min(actual.precio_noche, precio);
      }
    }
    return {
      fecha_entrada: entrada,
      fecha_salida: salida,
      noches,
      opciones: [...porTipo.values()].map((t) => ({ ...t, total: Math.round(t.precio_noche * noches * 100) / 100 })),
    };
  }

  // ---------- reserva directa ----------
  let reservasHoy = { dia: hoy(), total: 0 };
  let cola = Promise.resolve();
  const enCola = (fn) => {
    const p = cola.then(fn, fn);
    cola = p.catch(() => {});
    return p;
  };

  async function crearReserva(b, ip) {
    exigirLimite(`reservas:${ip}`, cfg.limiteReservasHoraIp, 3600000);
    if (typeof b.sitio_web === "string" && b.sitio_web.trim() !== "") throw new ErrorHttp(400, "Solicitud no válida.");
    if (cfg.turnstileSecret) {
      if (typeof b.turnstile !== "string" || !b.turnstile || !(await verificarTurnstile(b.turnstile, ip)))
        throw new ErrorHttp(400, "No se pudo verificar que eres una persona. Intenta de nuevo.");
    }
    const nombre = typeof b.nombre === "string" ? b.nombre.trim().replace(/\s+/g, " ") : "";
    if (nombre.length < 2 || nombre.length > 100 || !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(nombre))
      throw new ErrorHttp(400, "Escribe un nombre válido.");
    const email = normalizarEmail(b.email);
    if (!emailValido(email)) throw new ErrorHttp(400, "Escribe un correo válido.");
    const telefono = typeof b.telefono === "string" ? b.telefono.trim() : "";
    if (telefono.length < 7 || telefono.length > 20 || !/^[0-9+() .-]+$/.test(telefono))
      throw new ErrorHttp(400, "Escribe un teléfono válido.");
    if (!Object.hasOwn(TIPOS, b.tipo)) throw new ErrorHttp(400, "Elige un tipo de habitación válido.");
    const noches = validarFechas(b.fecha_entrada, b.fecha_salida);
    const personas = validarPersonas(b.personas);

    const h = hoy();
    if (reservasHoy.dia !== h) reservasHoy = { dia: h, total: 0 };
    if (reservasHoy.total >= cfg.maxReservasDia)
      throw new ErrorHttp(503, "Hoy no podemos recibir más reservas en línea. Intenta mañana o contacta al hotel.");

    return enCola(async () => {
      const candidatas = await habitacionesLibres(b.fecha_entrada, b.fecha_salida, personas, b.tipo);
      if (candidatas.length === 0)
        throw new ErrorHttp(409, "No hay habitaciones de ese tipo disponibles en esas fechas.");

      // huésped: se reutiliza si el correo ya existe; nunca se modifican sus datos
      let huespedes = await listar(cfg.huespedes, "/huespedes");
      let huesped = huespedes.find((x) => normalizarEmail(x.email) === email);
      if (!huesped) {
        const r = await conAuth(cfg.huespedes, "/huespedes", { method: "POST", body: { nombre, email, telefono } });
        if (r.status === 201 || r.status === 200) huesped = r.data;
        else if (r.status === 409) {
          huespedes = await listar(cfg.huespedes, "/huespedes");
          huesped = huespedes.find((x) => normalizarEmail(x.email) === email);
        } else if (r.status === 400) throw new ErrorHttp(400, "Revisa tus datos de contacto.");
        if (!huesped?.id) throw new ErrorHttp(503, "El servicio no está disponible por ahora.");
      }

      const todas = await listar(cfg.reservas, "/reservas");
      const activas = todas.filter((r) => r.huesped_id === huesped.id && !cancelada(r) && dia(r.fecha_salida) >= h);
      if (activas.length >= cfg.maxReservasPorCorreo)
        throw new ErrorHttp(429, "Ya tienes reservas próximas con este correo. Contacta al hotel para cambios.");

      for (const hab of candidatas.slice(0, 5)) {
        const r = await conAuth(cfg.reservas, "/reservas", {
          method: "POST",
          body: { habitacion_id: hab.id, huesped_id: huesped.id, fecha_entrada: b.fecha_entrada, fecha_salida: b.fecha_salida },
        });
        if (r.status === 201 || r.status === 200) {
          reservasHoy.total += 1;

          if (cfg.n8nWebhookUrl) {
            const codigo = String(r.data.id).slice(0, 8).toUpperCase();
            const mensaje = [
              "Nueva reserva en Hotel 5 Letras",
              `Código: ${codigo}`,
              `Habitación: ${TIPOS[hab.tipo] ?? hab.tipo}`,
              `Entrada: ${b.fecha_entrada}`,
              `Salida: ${b.fecha_salida}`,
              `Noches: ${noches}`,
            ].join("\n");

            void fetch(cfg.n8nWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mensaje, evento: "reserva_creada", reserva_id: r.data.id, email, nombre, codigo, fecha_entrada: b.fecha_entrada, fecha_salida: b.fecha_salida, habitacion: TIPOS[hab.tipo] ?? hab.tipo, noches, total: Math.round(Number(r.data.total ?? Number(hab.precio_noche) * noches) * 100) / 100 }),
              signal: AbortSignal.timeout(8000),
            }).then(async (respuesta) => {
              await respuesta.body?.cancel();
              if (!respuesta.ok) {
                console.warn("[n8n] Aviso rechazado. HTTP:", respuesta.status);
              }
            }).catch((error) => {
              console.warn("[n8n] No se pudo entregar el aviso:",
                error.cause?.code ?? error.name);
            });
          }

          const total = r.data?.total !== undefined ? Number(r.data.total) : Number(hab.precio_noche) * noches;
          return {
            codigo: String(r.data.id).slice(0, 8).toUpperCase(),
            encuesta_token: emitirTokenEncuesta(r.data.id),
            estado: r.data.estado ?? "confirmada",
            tipo: hab.tipo,
            tipo_nombre: TIPOS[hab.tipo],
            fecha_entrada: b.fecha_entrada,
            fecha_salida: b.fecha_salida,
            noches,
            total: Math.round(total * 100) / 100,
          };
        }
        if (r.status === 409) continue; // otra reserva la tomó: probamos la siguiente habitación
        if (r.status === 400) throw new ErrorHttp(400, "No se pudo crear la reserva con esos datos.");
        throw new ErrorHttp(503, "El servicio no está disponible por ahora.");
      }
      throw new ErrorHttp(409, "No hay habitaciones de ese tipo disponibles en esas fechas.");
    });
  }

  // ---------- consulta de reserva (código + correo) ----------
  async function consultarReserva(codigo, q, ip) {
    exigirLimite(`consultas:${ip}`, cfg.limiteConsultasHoraIp, 3600000);
    const noEncontrada = new ErrorHttp(404, "No encontramos una reserva con esos datos.");
    const cod = String(codigo).toUpperCase();
    const email = normalizarEmail(q.get("email") ?? "");
    if (!/^[A-F0-9]{8}$/.test(cod) || !emailValido(email)) throw noEncontrada;
    const huespedes = await listar(cfg.huespedes, "/huespedes");
    const huesped = huespedes.find((x) => normalizarEmail(x.email) === email);
    if (!huesped) throw noEncontrada;
    const reservas = await listar(cfg.reservas, "/reservas");
    const r = reservas.find((x) => x.huesped_id === huesped.id && String(x.id).toUpperCase().startsWith(cod));
    if (!r) throw noEncontrada;
    const habs = await listar(cfg.habitaciones, "/habitaciones");
    const hab = habs.find((x) => x.id === r.habitacion_id);
    const noches = diasEntre(dia(r.fecha_entrada), dia(r.fecha_salida));
    return {
      codigo: cod,
      estado: r.estado,
      huesped: huesped.nombre,
      tipo_nombre: hab ? (TIPOS[hab.tipo] ?? hab.tipo) : undefined,
      fecha_entrada: dia(r.fecha_entrada),
      fecha_salida: dia(r.fecha_salida),
      noches,
      total: Number(r.total),
    };
  }

  async function datosEstancia(session) {
    const huespedes = await listar(cfg.huespedes, "/huespedes");
    const h = huespedes.find(x => normalizarEmail(x.email) === session.email);
    if (!h) return { email: session.email, perfil: null, reservas: [], csrf: session.csrf, vence: session.vence };
    const [reservas, habs] = await Promise.all([listar(cfg.reservas, "/reservas"), listar(cfg.habitaciones, "/habitaciones")]);
    const propias = reservas.filter(r => r.huesped_id === h.id).map(r => {
      const hab = habs.find(x => x.id === r.habitacion_id);
      return { codigo: String(r.id).slice(0,8).toUpperCase(), estado: r.estado, huesped: h.nombre,
        tipo_nombre: hab ? (TIPOS[hab.tipo] ?? hab.tipo) : "Habitación", fecha_entrada: dia(r.fecha_entrada), fecha_salida: dia(r.fecha_salida),
        noches: diasEntre(dia(r.fecha_entrada), dia(r.fecha_salida)), total: Number(r.total) };
    }).sort((a,b) => b.fecha_entrada.localeCompare(a.fecha_entrada));
    return { email: session.email, perfil: {nombre:h.nombre,email:h.email,telefono:h.telefono}, reservas:propias, csrf:session.csrf, vence:session.vence };
  }
  function comprobarOrigen(req) {
    if (req.headers["sec-fetch-site"] === "cross-site") throw new AccesoError(403, "Origen no permitido.");
    if (!req.headers.origin) return;
    const permitido = cfg.origin || `${cfg.sessionSecure ? "https" : "http"}://${req.headers.host}`;
    if (req.headers.origin !== permitido) throw new AccesoError(403, "Origen no permitido.");
  }

  // ---------- asistente ----------
  let asistenteActivas = 0;
  async function preguntar(b, ip) {
    exigirLimite(`asistente:${ip}`, cfg.limiteAsistenteHoraIp, 3600000);
    const pregunta = typeof b.pregunta === "string" ? b.pregunta.trim() : "";
    if (pregunta.length < 3 || pregunta.length > 500) throw new ErrorHttp(400, "Escribe una pregunta de entre 3 y 500 caracteres.");
    if (asistenteActivas >= cfg.asistenteConcurrencia)
      throw new ErrorHttp(503, "El asistente está ocupado. Intenta de nuevo en un momento.");
    asistenteActivas += 1;
    try {
      const r = await conAuth(cfg.asistente, "/asistente/preguntar", {
        method: "POST",
        body: { pregunta },
        timeout: cfg.timeoutAsistenteMs,
      });
      if (r.status !== 200 && r.status !== 201) {
        if (r.status === 400) throw new ErrorHttp(400, "No pude entender tu pregunta.");
        throw new ErrorHttp(503, "El asistente no está disponible por ahora.");
      }
      return { respuesta: typeof r.data?.respuesta === "string" ? r.data.respuesta : "No tengo información sobre eso. Consulta en recepción." };
    } finally {
      asistenteActivas -= 1;
    }
  }

  // ---------- HTTP ----------
  async function leerJson(req) {
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json"))
      throw new ErrorHttp(415, "Se esperaba JSON.");
    const trozos = [];
    let tam = 0;
    for await (const t of req) {
      tam += t.length;
      if (tam > 10240) throw new ErrorHttp(413, "La solicitud es demasiado grande.");
      trozos.push(t);
    }
    try {
      const v = JSON.parse(Buffer.concat(trozos).toString("utf8"));
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
      return v;
    } catch {
      throw new ErrorHttp(400, "JSON no válido.");
    }
  }

  const servidor = http.createServer(async (req, res) => {
    const t0 = Date.now();
    const ip = ipDe(req);
    const url = new URL(req.url ?? "/", "http://interno");
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    const enviar = (status, cuerpo, extra = {}) => {
      const texto = JSON.stringify(cuerpo);
      const cabeceras = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'",
      };
      const origen = req.headers.origin;
      if (cfg.origin && origen === cfg.origin) {
        cabeceras["Access-Control-Allow-Origin"] = cfg.origin;
        cabeceras["Vary"] = "Origin";
      }
      res.writeHead(status, { ...cabeceras, ...extra });
      res.end(texto);
    };
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          ...(cfg.origin && req.headers.origin === cfg.origin
            ? {
                "Access-Control-Allow-Origin": cfg.origin,
                "Access-Control-Allow-Methods": "GET, POST",
                "Access-Control-Allow-Headers": "Content-Type",
                Vary: "Origin",
              }
            : {}),
        });
        return res.end();
      }

      if (req.method === "POST" && ruta === "/api/publico/encuestas/reserva") {
        comprobarOrigen(req);
        exigirLimite(`encuestas:${ip}`, 20, 3600000);
        const b = await leerJson(req);
        if (!b || typeof b !== "object" || Array.isArray(b))
          throw new ErrorHttp(400, "Revisa los datos de la encuesta.");
        const id = validarTokenEncuesta(b.token);
        for (const campo of ["facilidad", "claridad", "satisfaccion"]) {
          if (!Number.isInteger(b[campo]) || b[campo] < 1 || b[campo] > 5)
            throw new ErrorHttp(400, "Elige una calificación del 1 al 5 en cada pregunta.");
        }
        if (b.comentario !== undefined &&
            (typeof b.comentario !== "string" || b.comentario.length > 1000))
          throw new ErrorHttp(400, "El comentario debe tener como máximo 1000 caracteres.");
        const r = await conAuth(cfg.reservas, `/reservas/${id}/encuesta`, {
          method: "POST",
          body: {
            facilidad: b.facilidad,
            claridad: b.claridad,
            satisfaccion: b.satisfaccion,
            comentario: (b.comentario ?? "").trim(),
          },
        });
        if (r.status !== 200)
          throw new ErrorHttp(503, "No pudimos guardar tu encuesta. Intenta nuevamente.");
        return enviar(200, { registrada: true });
      }
      if (req.method === "GET" && ruta === "/salud") return enviar(200, { servicio: "publico", estado: "ok" });

      if (req.method === "GET" && ruta === "/api/publico/disponibilidad") {
        exigirLimite(`disp:${ip}`, cfg.limiteDisponibilidadMinutoIp, 60000);
        return enviar(200, await disponibilidad(url.searchParams));
      }
      if (ruta.startsWith("/api/publico/estancia/")) {
        comprobarOrigen(req);
        if (req.method === "POST" && ruta === "/api/publico/estancia/solicitar") {
          const b = await leerJson(req);
          if (cfg.turnstileSecret && (typeof b.turnstile !== "string" || !b.turnstile || !(await verificarTurnstile(b.turnstile, ip)))) throw new AccesoError(400,"Completa la verificación de seguridad.");
          return enviar(200, await acceso.solicitar(b, ip));
        }
        if (req.method === "POST" && ruta === "/api/publico/estancia/confirmar") {
          const session = acceso.confirmar(await leerJson(req), ip);
          // El token solo viaja en cookie HttpOnly, nunca en JSON o localStorage.
          return enviar(200, {email:session.email, csrf:session.csrf, vence:session.vence}, {"Set-Cookie":cookieSesion(session.token,cfg.sessionSecure)});
        }
        const mutacion = req.method !== "GET";
        const session = acceso.leer(req.headers.cookie, mutacion ? String(req.headers["x-csrf-token"] ?? "") : undefined);
        exigirLimite(`estancia:${session.key}`, 60, 60000);

        if (req.method === "POST" && [
          "/api/publico/estancia/llave",
          "/api/publico/estancia/llave/probar",
        ].includes(ruta)) {
          exigirLimite(`llaves:${session.key}`, 15, 60000);
          const b = await leerJson(req);
          if (!b || typeof b !== "object" || Array.isArray(b) ||
              typeof b.codigo !== "string" || !/^[A-F0-9]{8}$/.test(b.codigo))
            throw new AccesoError(400, "Selecciona una reserva válida.");

          const huespedes = await listar(cfg.huespedes, "/huespedes");
          const huesped = huespedes.find(
            (h) => normalizarEmail(h.email) === session.email
          );
          if (!huesped) throw new AccesoError(404, "No encontramos esa reserva.");

          const reservas = await listar(cfg.reservas, "/reservas");
          const propias = reservas.filter(
            (r) => r.huesped_id === huesped.id &&
              String(r.id).slice(0, 8).toUpperCase() === b.codigo
          );
          if (propias.length !== 1)
            throw new AccesoError(404, "No encontramos una reserva única con ese código.");
          const reserva = propias[0];

          if (ruta === "/api/publico/estancia/llave") {
            const r = await conAuth(
              cfg.reservas, `/reservas/${encodeURIComponent(reserva.id)}/llave`,
              { method: "POST", body: {} }
            );
            if (r.status === 409)
              throw new AccesoError(409, "La llave solo está disponible con el check-in completo y sin salida en proceso.");
            if (r.status !== 200)
              throw new AccesoError(503, "No pudimos generar la llave. Intenta nuevamente.");
            return enviar(200, {
              token: r.data.token,
              vence_en: r.data.vence_en,
              codigo: b.codigo,
              demostracion: true,
            });
          }

          if (typeof b.token !== "string" || !/^[0-9a-f]{64}$/.test(b.token))
            throw new AccesoError(400, "La llave no es válida.");
          const r = await conAuth(cfg.reservas, "/llaves/validar", {
            method: "POST",
            body: { token: b.token, habitacion_id: reserva.habitacion_id },
          });
          if (r.status === 401 || r.status === 409 || r.status === 404)
            throw new AccesoError(400, "Llave inválida, vencida, reemplazada o estancia no activa.");
          if (r.status !== 200)
            throw new AccesoError(503, "No pudimos validar la llave. Intenta nuevamente.");
          return enviar(200, {
            valida: true,
            demostracion: true,
            mensaje: "Acceso simulado autorizado. No se abrió una puerta física.",
          });
        }
        if (req.method === "GET" && ruta === "/api/publico/estancia/me") return enviar(200, await datosEstancia(session));
        if (req.method === "POST" && ruta === "/api/publico/estancia/salir") {
          acceso.cerrar(session.key);
          return enviar(200, {ok:true}, {"Set-Cookie":cookieSesion("",cfg.sessionSecure,0)});
        }
        if (req.method === "PATCH" && ruta === "/api/publico/estancia/perfil") {
          const b = await leerJson(req);
          if (Object.keys(b).some(k => !["nombre","telefono"].includes(k))) throw new AccesoError(400,"Solo puedes cambiar nombre y teléfono.");
          const nombre = typeof b.nombre === "string" ? b.nombre.trim().replace(/\s+/g," ") : "";
          const telefono = typeof b.telefono === "string" ? b.telefono.trim() : "";
          if (nombre.length<2 || nombre.length>100 || !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(nombre) || telefono.length<7 || telefono.length>20 || telefono.replace(/\D/g,"").length<7 || !/^[0-9+() .-]+$/.test(telefono)) throw new AccesoError(400,"Revisa tu nombre y teléfono.");
          const hs = await listar(cfg.huespedes,"/huespedes");
          const h = hs.find(x => normalizarEmail(x.email) === session.email);
          if (!h) throw new AccesoError(404,"Aún no tienes un perfil de huésped registrado.");
          const r = await conAuth(cfg.huespedes, `/huespedes/${encodeURIComponent(h.id)}/contacto`, {method:"PATCH",body:{nombre,telefono}});
          if (r.status!==200) throw new AccesoError(503,"No pudimos guardar tus datos. Intenta de nuevo.");
          return enviar(200,{perfil:{nombre:r.data.nombre,telefono:r.data.telefono,email:r.data.email}});
        }
        throw new AccesoError(404,"No encontrado.");
      }
      if (req.method === "POST" && ruta === "/api/publico/correo/solicitar") {
        const b = await leerJson(req);
        if (cfg.turnstileSecret && (typeof b.turnstile !== "string" || !b.turnstile || !(await verificarTurnstile(b.turnstile, ip))))
          throw new ErrorHttp(400, "Completa la verificación de seguridad.");
        return enviar(200, await correo.solicitar(b, ip));
      }
      if (req.method === "POST" && ruta === "/api/publico/correo/confirmar")
        return enviar(200, correo.confirmar(await leerJson(req), ip));
      if (req.method === "POST" && ruta === "/api/publico/reservas") {
        const b = await leerJson(req);
        const terminar = correo.autorizar(b);
        let exito = false;
        try {
          const reserva = await crearReserva(b, ip);
          exito = true;
          return enviar(201, reserva);
        } finally { terminar(exito); }
      }
      const m = ruta.match(/^\/api\/publico\/reservas\/([^/]+)$/);
      if (req.method === "GET" && m) return enviar(200, await consultarReserva(decodeURIComponent(m[1]), url.searchParams, ip));
      if (req.method === "POST" && ruta === "/api/publico/asistente") {
        return enviar(200, await preguntar(await leerJson(req), ip));
      }
      throw new ErrorHttp(404, "No encontrado.");
    } catch (e) {
      if (e instanceof ErrorHttp || e instanceof VerificacionError || e instanceof AccesoError) enviar(e.status, { error: e.message }, e.status===401 && ruta.startsWith("/api/publico/estancia/") ? {"Set-Cookie":cookieSesion("",cfg.sessionSecure,0)} : {});
      else {
        console.error(JSON.stringify({ nivel: "error", msg: "fallo interno", detalle: String(e?.message ?? e) }));
        enviar(500, { error: "Error interno." });
      }
    } finally {
      console.log(JSON.stringify({ m: req.method, ruta, status: res.statusCode, ms: Date.now() - t0 }));
    }
  });
  servidor.requestTimeout = 120000;
  servidor.headersTimeout = 15000;
  servidor.keepAliveTimeout = 5000;
  servidor.on("close", () => clearInterval(limpiador));
  return servidor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = leerConfig();
  if (!cfg.portalEmail || !cfg.portalPassword) {
    console.error("Faltan PORTAL_EMAIL y PORTAL_PASSWORD (cuenta de servicio con rol recepcionista).");
    process.exit(1);
  }
  crearServidor().listen(cfg.port, "0.0.0.0", () => console.log(JSON.stringify({ msg: "publico-service listo", port: cfg.port })));
}
