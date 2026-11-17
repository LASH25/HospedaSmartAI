// Capa unica de llamadas al backend. El front siempre llama a /api/...
// (en desarrollo lo reenvia Vite; en Docker lo reenvia nginx).

const TOKEN_KEY = "hs_token";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* sin almacenamiento: seguimos sin guardar */ }
}

const USUARIO_KEY = "hs_usuario";
export type UsuarioSesion = { id?: string; nombre?: string; rol?: string };
export function getUsuario(): UsuarioSesion | null {
  try { return JSON.parse(localStorage.getItem(USUARIO_KEY) ?? "null"); } catch { return null; }
}
export function setUsuario(u: UsuarioSesion | null) {
  try {
    if (u) localStorage.setItem(USUARIO_KEY, JSON.stringify(u));
    else localStorage.removeItem(USUARIO_KEY);
  } catch { /* sin almacenamiento */ }
}

async function api<T = unknown>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = getToken();
  const r = await fetch(`/api/${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });
  if (!r.ok) {
    let detalle = "";
    try { detalle = (await r.json()).message ?? ""; } catch { /* sin cuerpo */ }
    throw new Error(Array.isArray(detalle) ? detalle.join(", ") : detalle || `Error ${r.status}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

const post = <T = unknown>(ruta: string, datos?: unknown) =>
  api<T>(ruta, { method: "POST", body: datos === undefined ? undefined : JSON.stringify(datos) });

// --- usuarios-service (3004) ---
export const login = (datos: unknown) => post("auth/login", datos);
export const me = () => api("auth/me");
export const getUsuarios = () => api("usuarios");
export const crearUsuario = (datos: unknown) => post("usuarios", datos);

// --- habitaciones-service (3002) ---
export const getHabitaciones = () => api("habitaciones");
export const getHabitacion = (id: string) => api(`habitaciones/${id}`);
export const crearHabitacion = (datos: unknown) => post("habitaciones", datos);
export const cambiarEstadoHabitacion = (id: string, datos: unknown) =>
  api(`habitaciones/${id}/estado`, { method: "PATCH", body: JSON.stringify(datos) });
export const getOcupacion = (id: string) => api(`habitaciones/${id}/ocupacion`);

// --- reservas-service (3001) ---
export const getReservas = () => api("reservas");
export const getReserva = (id: string) => api(`reservas/${id}`);
export const crearReserva = (datos: unknown) => post("reservas", datos);
export const cancelarReserva = (id: string) => api(`reservas/${id}/cancelar`, { method: "PATCH" });
export const checkIn = (id: string, datos?: unknown) => post(`reservas/${id}/check-in`, datos);
export const checkOut = (id: string, datos?: unknown) => post(`reservas/${id}/check-out`, datos);
export const getEstancia = (id: string) => api(`reservas/${id}/estancia`);

// --- huespedes-cobros-service (3003) ---
export const getHuespedes = () => api("huespedes");
export const getHuesped = (id: string) => api(`huespedes/${id}`);
export const crearHuesped = (datos: unknown) => post("huespedes", datos);
export const abrirCuenta = (datos: unknown) => post("cuentas/abrir", datos);
export const getCuenta = (id: string) => api(`cuentas/${id}`);
export const getResumenCuenta = (id: string) => api(`cuentas/${id}/resumen`);
export const agregarConsumo = (id: string, datos: unknown) => post(`cuentas/${id}/consumos`, datos);
export const registrarPago = (id: string, datos: unknown) => post(`cuentas/${id}/pagos`, datos);
export const cerrarCuenta = (id: string) => post(`cuentas/${id}/cerrar`);

// --- asistente-service (3005) ---
export const preguntarAsistente = (datos: unknown) => post("asistente/preguntar", datos);
export const buscarConocimientos = (q: string) =>
  api(`conocimientos/buscar?q=${encodeURIComponent(q)}`);
