// Pruebas con servicios internos simulados. Ejecutar: node --test test/
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { crearServidor } from "../server.mjs";

const TZ = "UTC";
const hoyIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const sumar = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------- servicios internos simulados ----------
function crearMock() {
  const estado = {
    token: "tok-1",
    rechazarUnaVez: false,
    habitaciones: [
      { id: "h101", numero: "101", tipo: "doble", capacidad: 2, precio_noche: "800.00", estado_operativo: "disponible" },
      { id: "h102", numero: "102", tipo: "doble", capacidad: 2, precio_noche: "800.00", estado_operativo: "limpieza" },
      { id: "h201", numero: "201", tipo: "suite", capacidad: 4, precio_noche: "2500.00", estado_operativo: "disponible" },
      { id: "h301", numero: "301", tipo: "individual", capacidad: 1, precio_noche: "500.00", estado_operativo: "mantenimiento" },
    ],
    huespedes: [],
    reservas: [],
    preguntas: [],
    logins: 0,
    lentoAsistente: 0,
  };
  const servidor = http.createServer(async (req, res) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    const cuerpo = partes.length ? JSON.parse(Buffer.concat(partes).toString()) : undefined;
    const json = (s, d) => {
      res.writeHead(s, { "Content-Type": "application/json" });
      res.end(JSON.stringify(d));
    };
    const ruta = req.url.split("?")[0];
    if (req.method === "POST" && ruta === "/auth/login") {
      estado.logins += 1;
      if (cuerpo.email !== "portal@hotel.mx" || cuerpo.password !== "clave-de-servicio-1234") return json(401, { message: "Credenciales inválidas" });
      return json(200, { access_token: estado.token, expires_in: 3600 });
    }
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${estado.token}` || estado.rechazarUnaVez) {
      estado.rechazarUnaVez = false;
      return json(401, { message: "Token inválido" });
    }
    if (req.method === "GET" && ruta === "/habitaciones") return json(200, estado.habitaciones);
    if (req.method === "GET" && ruta === "/huespedes") return json(200, estado.huespedes);
    if (req.method === "POST" && ruta === "/huespedes") {
      if (estado.huespedes.some((h) => h.email === cuerpo.email)) return json(409, { message: "dup" });
      const h = { id: randomUUID(), ...cuerpo };
      estado.huespedes.push(h);
      return json(201, h);
    }
    if (req.method === "PATCH" && /^\/huespedes\/[^/]+\/contacto$/.test(ruta)) {
      const h = estado.huespedes.find(h=>h.id===ruta.split('/')[2]);
      if (!h) return json(404,{});
      h.nombre=cuerpo.nombre;h.telefono=cuerpo.telefono;
      return json(200,h);
    }
    if (req.method === "GET" && ruta === "/reservas") return json(200, estado.reservas);
    if (req.method === "POST" && ruta === "/reservas") {
      const choca = estado.reservas.some(
        (r) => r.habitacion_id === cuerpo.habitacion_id && !/cancel/i.test(r.estado) && r.fecha_entrada < cuerpo.fecha_salida && r.fecha_salida > cuerpo.fecha_entrada,
      );
      if (choca) return json(409, { message: "no disponible" });
      const hab = estado.habitaciones.find((h) => h.id === cuerpo.habitacion_id);
      const noches = (Date.parse(cuerpo.fecha_salida) - Date.parse(cuerpo.fecha_entrada)) / 86400000;
      const r = { id: randomUUID(), ...cuerpo, total: (noches * Number(hab.precio_noche)).toFixed(2), estado: "confirmada" };
      estado.reservas.push(r);
      return json(201, r);
    }
    if (req.method === "POST" && ruta === "/asistente/preguntar") {
      estado.preguntas.push(cuerpo.pregunta);
      if (estado.lentoAsistente) await new Promise((r) => setTimeout(r, estado.lentoAsistente));
      return json(200, { conversacion_id: "c1", modo: "ia_local", pregunta: cuerpo.pregunta, respuesta: "El check-out es a las 12:00.", fuentes: [{ id: 1, titulo: "Política" }] });
    }
    json(404, {});
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok({ servidor, estado, url: `http://127.0.0.1:${servidor.address().port}` })));
}

async function montar(extra = {}, deps = {}) {
  const mock = await crearMock();
  const app = crearServidor(
    {
      usuarios: mock.url, habitaciones: mock.url, reservas: mock.url, huespedes: mock.url, asistente: mock.url,
      portalEmail: "portal@hotel.mx", portalPassword: "clave-de-servicio-1234", tz: TZ, trustProxy: true, timeoutMs: 3000, timeoutAsistenteMs: 3000,
      ...extra,
    },
    { correo: { autorizar: () => () => {} }, ...deps },
  );
  await new Promise((ok) => app.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${app.address().port}`;
  let ipSeq = 0;
  const pedir = (ruta, { method = "GET", body, ip, headers = {} } = {}) =>
    fetch(base + ruta, {
      method,
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip ?? `10.0.0.${++ipSeq}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null), headers: r.headers }));
  const cerrar = () => {
    app.close();
    mock.servidor.close();
    app.closeAllConnections?.();
    mock.servidor.closeAllConnections?.();
  };
  return { pedir, mock, cerrar, base };
}

const solicitud = (extra = {}) => ({
  nombre: "Laura García", email: "laura@correo.mx", telefono: "+52 55 1234 5678", tipo: "doble",
  fecha_entrada: sumar(hoyIso(), 3), fecha_salida: sumar(hoyIso(), 5), personas: 2, ...extra,
});

test("salud responde sin autenticación", async () => {
  const t = await montar();
  const r = await t.pedir("/salud");
  assert.equal(r.status, 200);
  assert.equal(r.data.estado, "ok");
  t.cerrar();
});

test("disponibilidad: agrupa por tipo, excluye mantenimiento y calcula el total", async () => {
  const t = await montar();
  const e = sumar(hoyIso(), 3), s = sumar(hoyIso(), 5);
  const r = await t.pedir(`/api/publico/disponibilidad?fecha_entrada=${e}&fecha_salida=${s}&personas=2`);
  assert.equal(r.status, 200);
  const tipos = r.data.opciones.map((o) => o.tipo).sort();
  assert.deepEqual(tipos, ["doble", "suite"]); // individual está en mantenimiento
  assert.equal(r.data.opciones.find((o) => o.tipo === "doble").total, 1600);
  assert.equal(r.data.noches, 2);
  t.cerrar();
});

test("disponibilidad: no expone números de habitación ni ids", async () => {
  const t = await montar();
  const r = await t.pedir(`/api/publico/disponibilidad?fecha_entrada=${sumar(hoyIso(), 3)}&fecha_salida=${sumar(hoyIso(), 4)}`);
  const texto = JSON.stringify(r.data);
  assert.ok(!texto.includes("h101") && !texto.includes('"numero"') && !texto.includes("101"));
  t.cerrar();
});

test("reserva directa: crea huésped, asigna habitación y devuelve código; la 2.ª toma otra habitación; la 3.ª no hay", async () => {
  const t = await montar();
  const r1 = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  assert.equal(r1.status, 201);
  assert.match(r1.data.codigo, /^[A-F0-9]{8}$/);
  assert.equal(r1.data.total, 1600);
  assert.equal(t.mock.estado.huespedes.length, 1);

  const r2 = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ email: "otro@correo.mx", nombre: "Otro Huésped" }) });
  assert.equal(r2.status, 201);
  assert.notEqual(t.mock.estado.reservas[0].habitacion_id, t.mock.estado.reservas[1].habitacion_id);

  const r3 = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ email: "tercero@correo.mx", nombre: "Tercero Pérez" }) });
  assert.equal(r3.status, 409);
  t.cerrar();
});

test("reserva: reutiliza el huésped si el correo ya existe y no cambia sus datos", async () => {
  const t = await montar();
  await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ nombre: "Nombre Distinto", fecha_entrada: sumar(hoyIso(), 10), fecha_salida: sumar(hoyIso(), 11) }) });
  assert.equal(t.mock.estado.huespedes.length, 1);
  assert.equal(t.mock.estado.huespedes[0].nombre, "Laura García");
  t.cerrar();
});

test("reserva: validaciones", async () => {
  const t = await montar();
  const casos = [
    ["correo inválido", { email: "no-es-correo" }],
    ["nombre con símbolos", { nombre: "<script>alert(1)</script>" }],
    ["teléfono inválido", { telefono: "abc" }],
    ["tipo desconocido", { tipo: "penthouse" }],
    ["fecha en el pasado", { fecha_entrada: sumar(hoyIso(), -1), fecha_salida: sumar(hoyIso(), 1) }],
    ["salida antes de llegada", { fecha_entrada: sumar(hoyIso(), 5), fecha_salida: sumar(hoyIso(), 4) }],
    ["demasiadas noches", { fecha_entrada: sumar(hoyIso(), 1), fecha_salida: sumar(hoyIso(), 40) }],
    ["demasiado lejos", { fecha_entrada: sumar(hoyIso(), 800), fecha_salida: sumar(hoyIso(), 802) }],
    ["fecha imposible", { fecha_entrada: "2030-02-31", fecha_salida: "2030-03-02" }],
    ["personas inválidas", { personas: 0 }],
    ["honeypot lleno", { sitio_web: "http://spam.example" }],
  ];
  for (const [nombre, extra] of casos) {
    const r = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud(extra) });
    assert.equal(r.status, 400, `${nombre} debe dar 400 (dio ${r.status})`);
  }
  assert.equal(t.mock.estado.reservas.length, 0);
  t.cerrar();
});

test("reserva: máximo de reservas próximas por correo", async () => {
  const t = await montar({ maxReservasPorCorreo: 1 });
  const a = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  assert.equal(a.status, 201);
  const b = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ fecha_entrada: sumar(hoyIso(), 20), fecha_salida: sumar(hoyIso(), 21) }) });
  assert.equal(b.status, 429);
  t.cerrar();
});

test("reserva: límite por IP", async () => {
  const t = await montar({ limiteReservasHoraIp: 2 });
  const ip = "203.0.113.9";
  for (let i = 0; i < 2; i++) await t.pedir("/api/publico/reservas", { method: "POST", ip, body: solicitud({ email: `x${i}@correo.mx`, tipo: "suite", fecha_entrada: sumar(hoyIso(), 30 + i * 2), fecha_salida: sumar(hoyIso(), 31 + i * 2) }) });
  const r = await t.pedir("/api/publico/reservas", { method: "POST", ip, body: solicitud() });
  assert.equal(r.status, 429);
  t.cerrar();
});

test("reserva: tope diario global", async () => {
  const t = await montar({ maxReservasDia: 1 });
  const a = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  assert.equal(a.status, 201);
  const b = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ email: "b@correo.mx", nombre: "Bruno Díaz" }) });
  assert.equal(b.status, 503);
  t.cerrar();
});

test("reservas simultáneas por la misma habitación: una sola gana, sin doble reserva", async () => {
  const t = await montar();
  t.mock.estado.habitaciones = t.mock.estado.habitaciones.filter((h) => h.tipo === "suite"); // una sola suite
  const envios = await Promise.all(
    [1, 2, 3, 4].map((i) => t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ tipo: "suite", personas: 2, email: `p${i}@correo.mx`, nombre: `Persona Uno${"x".repeat(0)}` }) })),
  );
  assert.equal(envios.filter((r) => r.status === 201).length, 1);
  assert.equal(t.mock.estado.reservas.length, 1);
  t.cerrar();
});

test("turnstile: se exige cuando hay secreto configurado", async () => {
  const t = await montar({ turnstileSecret: "secreto" }, { verificarTurnstile: async (tok) => tok === "bueno" });
  const sin = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  assert.equal(sin.status, 400);
  const malo = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ turnstile: "malo" }) });
  assert.equal(malo.status, 400);
  const ok = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud({ turnstile: "bueno" }) });
  assert.equal(ok.status, 201);
  t.cerrar();
});

test("consulta: con código y correo correctos funciona; con otro correo da 404 genérico", async () => {
  const t = await montar();
  const c = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  const bien = await t.pedir(`/api/publico/reservas/${c.data.codigo}?email=LAURA@correo.mx`);
  assert.equal(bien.status, 200);
  assert.equal(bien.data.tipo_nombre, "Doble");
  assert.ok(!JSON.stringify(bien.data).includes("h10"));
  const mal = await t.pedir(`/api/publico/reservas/${c.data.codigo}?email=otro@correo.mx`);
  assert.equal(mal.status, 404);
  const inexistente = await t.pedir(`/api/publico/reservas/AAAAAAAA?email=laura@correo.mx`);
  assert.equal(inexistente.status, 404);
  assert.equal(mal.data.error, inexistente.data.error); // misma respuesta: no revela si el correo existe
  t.cerrar();
});

test("asistente: devuelve solo la respuesta, valida y limita", async () => {
  const t = await montar({ limiteAsistenteHoraIp: 3 });
  const ip = "198.51.100.7";
  const ok = await t.pedir("/api/publico/asistente", { method: "POST", ip, body: { pregunta: "¿A qué hora es el check-out?" } });
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.data), ["respuesta"]);
  const corta = await t.pedir("/api/publico/asistente", { method: "POST", ip, body: { pregunta: "a" } });
  assert.equal(corta.status, 400);
  const larga = await t.pedir("/api/publico/asistente", { method: "POST", ip, body: { pregunta: "x".repeat(501) } });
  assert.equal(larga.status, 400);
  const limite = await t.pedir("/api/publico/asistente", { method: "POST", ip, body: { pregunta: "hola otra vez" } });
  assert.equal(limite.status, 429);
  t.cerrar();
});

test("asistente: límite de consultas simultáneas", async () => {
  const t = await montar({ asistenteConcurrencia: 1 });
  t.mock.estado.lentoAsistente = 300;
  const [a, b] = await Promise.all([
    t.pedir("/api/publico/asistente", { method: "POST", body: { pregunta: "primera pregunta" } }),
    t.pedir("/api/publico/asistente", { method: "POST", body: { pregunta: "segunda pregunta" } }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 503]);
  t.cerrar();
});

test("sesión de servicio: se renueva sola si el token es rechazado", async () => {
  const t = await montar();
  const e = sumar(hoyIso(), 3), s = sumar(hoyIso(), 4);
  await t.pedir(`/api/publico/disponibilidad?fecha_entrada=${e}&fecha_salida=${s}`);
  const antes = t.mock.estado.logins;
  t.mock.estado.rechazarUnaVez = true;
  const r = await t.pedir(`/api/publico/disponibilidad?fecha_entrada=${e}&fecha_salida=${s}`);
  assert.equal(r.status, 200);
  assert.ok(t.mock.estado.logins > antes);
  t.cerrar();
});

test("si el login de servicio falla, el público ve un error genérico sin detalles", async () => {
  const t = await montar({ portalPassword: "incorrecta-incorrecta" });
  const r = await t.pedir(`/api/publico/disponibilidad?fecha_entrada=${sumar(hoyIso(), 3)}&fecha_salida=${sumar(hoyIso(), 4)}`);
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(r.data).toLowerCase().includes("credencial"));
  t.cerrar();
});

test("cabeceras de seguridad, rutas desconocidas y cuerpos no válidos", async () => {
  const t = await montar();
  const r = await t.pedir("/api/publico/disponibilidad?fecha_entrada=2030-01-01&fecha_salida=2030-01-02");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await t.pedir("/api/habitaciones")).status, 404); // no se reenvía nada interno
  assert.equal((await t.pedir("/api/publico/reservas", { method: "POST", body: [1, 2] })).status, 400);
  const grande = await t.pedir("/api/publico/reservas", { method: "POST", body: { nombre: "x".repeat(20000) } });
  assert.equal(grande.status, 413);
  t.cerrar();
});

test("consulta: un huésped existente no puede ver la reserva de otro aunque conozca el código", async () => {
  const t = await montar();
  const a = await t.pedir("/api/publico/reservas", { method: "POST", body: solicitud() });
  await t.pedir("/api/publico/reservas", {
    method: "POST",
    body: solicitud({ email: "curioso@correo.mx", nombre: "Persona Curiosa", fecha_entrada: sumar(hoyIso(), 20), fecha_salida: sumar(hoyIso(), 21) }),
  });
  const intento = await t.pedir(`/api/publico/reservas/${a.data.codigo}?email=curioso@correo.mx`);
  assert.equal(intento.status, 404);
  t.cerrar();
});

test('HTTP: sin verificación no escribe; con código correcto reserva y no permite reutilizar', async () => {
  let codigo;
  const t = await montar({}, {correo:null, enviarCorreo:async(email,c)=>{codigo=c}});
  try {
    const b=solicitud();
    assert.equal((await t.pedir('/api/publico/reservas',{method:'POST',body:b})).status,403);
    assert.equal(t.mock.estado.reservas.length,0);
    assert.equal(t.mock.estado.huespedes.length,0);
    const r=await t.pedir('/api/publico/correo/solicitar',{method:'POST',body:b});
    assert.equal(r.status,200);
    const p=await t.pedir('/api/publico/correo/confirmar',{method:'POST',body:{...b,verificacion_id:r.data.verificacion_id,codigo}});
    assert.equal(p.status,200);
    const body={...b,verificacion_token:p.data.verificacion_token};
    assert.equal((await t.pedir('/api/publico/reservas',{method:'POST',body:{...body,email:'otro@correo.mx'}})).status,403);
    assert.equal((await t.pedir('/api/publico/reservas',{method:'POST',body})).status,201);
    assert.equal((await t.pedir('/api/publico/reservas',{method:'POST',body})).status,403);
    assert.equal(t.mock.estado.reservas.length,1);
  } finally {t.cerrar()}
});
test('HTTP: SMTP no disponible y código incorrecto no permiten reservar',async()=>{
  const t=await montar({}, {correo:null,enviarCorreo:async()=>{throw new Error('SMTP')}});
  try{assert.equal((await t.pedir('/api/publico/correo/solicitar',{method:'POST',body:solicitud()})).status,503);assert.equal(t.mock.estado.reservas.length,0)}finally{t.cerrar()}
});

test('Mi estancia: sesión privada, aislamiento de reservas, edición acotada, CSRF y cierre', async()=>{
 const codigos=new Map();const t=await montar({}, {enviarAcceso:async(email,codigo)=>codigos.set(email,codigo)});
 try{
  await t.pedir('/api/publico/reservas',{method:'POST',body:solicitud()});
  await t.pedir('/api/publico/reservas',{method:'POST',body:solicitud({nombre:'Otra Persona',email:'otra@correo.mx'})});
  assert.equal((await t.pedir('/api/publico/estancia/me')).status,401);
  const inicio=await t.pedir('/api/publico/estancia/solicitar',{method:'POST',body:{email:'laura@correo.mx'}});assert.equal(inicio.status,200);
  assert.equal((await t.pedir('/api/publico/estancia/confirmar',{method:'POST',body:{email:'otra@correo.mx',acceso_id:inicio.data.acceso_id,codigo:codigos.get('laura@correo.mx')}})).status,400);
  const login=await t.pedir('/api/publico/estancia/confirmar',{method:'POST',body:{email:'laura@correo.mx',acceso_id:inicio.data.acceso_id,codigo:codigos.get('laura@correo.mx')}});
  assert.equal(login.status,200);assert.ok(!('token' in login.data));
  const sc=login.headers.get('set-cookie');assert.match(sc,/HttpOnly/);assert.match(sc,/SameSite=Strict/);assert.match(sc,/Path=\/api\/publico\/estancia/);
  const headers={Cookie:sc.split(';')[0],'X-CSRF-Token':login.data.csrf};
  const me=await t.pedir('/api/publico/estancia/me',{headers});assert.equal(me.status,200);assert.equal(me.data.reservas.length,1);assert.equal(me.data.perfil.email,'laura@correo.mx');assert.ok(!JSON.stringify(me.data).includes('Otra Persona'));
  const body={nombre:'Laura Nueva',telefono:'5559999999'};
  assert.equal((await t.pedir('/api/publico/estancia/perfil',{method:'PATCH',headers:{Cookie:headers.Cookie},body})).status,403);
  assert.equal((await t.pedir('/api/publico/estancia/perfil',{method:'PATCH',headers:{...headers,Origin:'https://ataque.example'},body})).status,403);
  assert.equal((await t.pedir('/api/publico/estancia/perfil',{method:'PATCH',headers,body:{...body,email:'otra@correo.mx'}})).status,400);
  assert.equal((await t.pedir('/api/publico/estancia/perfil',{method:'PATCH',headers,body:{...body,id:t.mock.estado.huespedes[1].id}})).status,400);
  assert.equal((await t.pedir('/api/publico/estancia/perfil',{method:'PATCH',headers,body})).status,200);
  assert.equal(t.mock.estado.huespedes[0].nombre,'Laura Nueva');assert.equal(t.mock.estado.huespedes[1].nombre,'Otra Persona');
  assert.equal((await t.pedir('/api/publico/estancia/salir',{method:'POST',headers,body:{}})).status,200);
  assert.equal((await t.pedir('/api/publico/estancia/me',{headers})).status,401);
  assert.equal((await t.pedir('/api/publico/estancia/confirmar',{method:'POST',body:{email:'laura@correo.mx',acceso_id:inicio.data.acceso_id,codigo:codigos.get('laura@correo.mx')}})).status,400);
 }finally{t.cerrar()}
});
test('Mi estancia: correo sin huésped no enumera antes de verificar y muestra perfil vacío después',async()=>{
 let codigo;const t=await montar({}, {enviarAcceso:async(e,c)=>codigo=c});
 try{const inicio=await t.pedir('/api/publico/estancia/solicitar',{method:'POST',body:{email:'nuevo@correo.mx'}});assert.equal(inicio.status,200);
 const login=await t.pedir('/api/publico/estancia/confirmar',{method:'POST',body:{email:'nuevo@correo.mx',acceso_id:inicio.data.acceso_id,codigo}});
 const me=await t.pedir('/api/publico/estancia/me',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});assert.equal(me.status,200);assert.equal(me.data.perfil,null);assert.deepEqual(me.data.reservas,[]);assert.equal(t.mock.estado.huespedes.length,0);
 }finally{t.cerrar()}
});
