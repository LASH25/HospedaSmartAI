const ORIGEN =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://chest-jump-railway.ngrok-free.dev";

export type Reserva = {
  codigo: string;
  estado: string;
  huesped: string;
  tipo_nombre: string;
  fecha_entrada: string;
  fecha_salida: string;
  noches: number;
  total: number;
};

export type Sesion = {
  email: string;
  csrf: string;
  vence: number;
  perfil: {
    nombre: string;
    email: string;
    telefono: string;
  } | null;
  reservas: Reserva[];
};

export class ErrorApi extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(
  ruta: string,
  body?: unknown,
  opciones: { method?: string; csrf?: string } = {},
): Promise<T> {
  const origen = new URL(ORIGEN);
  if (origen.protocol !== "https:") {
    throw new Error("Configura una dirección HTTPS para el hotel.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const respuesta = await fetch(
      new URL(`/api/publico/${ruta}`, origen).href,
      {
        method: opciones.method ?? (body !== undefined ? "POST" : "GET"),
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(opciones.csrf
            ? { "X-CSRF-Token": opciones.csrf }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      },
    );

    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      throw new ErrorApi(
        datos?.error ?? "No se pudo completar la solicitud.",
        respuesta.status,
      );
    }
    if (datos === null) {
      throw new Error("El servidor no devolvió una respuesta válida.");
    }
    return datos as T;
  } catch (error) {
    if (error instanceof ErrorApi) throw error;
    throw new Error(
      "No pudimos conectar con el hotel. Comprueba internet y que ngrok esté activo.",
    );
  } finally {
    clearTimeout(timer);
  }
}
