import FacturacionCuenta from "./FacturacionCuenta";
import { useRef as useSolicitudRef } from "react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  abrirCuenta,
  agregarConsumo,
  cancelarReserva,
  checkIn,
  checkOut,
  cerrarCuenta,
  crearHuesped,
  crearReserva,
  crearUsuario,
  cambiarEstadoHabitacion, getHabitaciones,
  getHabitacion,
  getSolicitudesHabitacion,
  actualizarSolicitudHabitacion,
  getHuespedes,
  getOcupacion,
  getReservas,
  getResumenCuenta,
  getUsuario,
  getUsuarios,
  login as apiLogin,
  preguntarAsistente,
  generarPagoMercadoPago,
  consultarPagoMercadoPago,
  registrarPago,
  setToken,
  setUsuario,
} from "./api";

type Screen =
  | "login"
  | "dashboard"
  | "reservations"
  | "guests"
  | "rooms"
  | "payments"
  | "users"
  | "assistant";
type RoomStatus = "Disponible" | "Ocupada" | "Limpieza" | "Mantenimiento";

const hotelPhoto =
  "https://images.unsplash.com/photo-1738407283641-5e127f36f47d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBib3V0aXF1ZSUyMGhvdGVsJTIwYnJpZ2h0JTIwd2FybSUyMG5ldXRyYWwlMjBpbnRlcmlvciUyMGxvYmJ5fGVufDF8fHx8MTc5NDEwODM1NXww&ixlib=rb-4.1.0&q=85&w=1600";

const rooms: Array<{
  number: string;
  name: string;
  monogram: string;
  status: RoomStatus;
  rate: number;
  floor: number;
}> = [
  { number: "101", name: "Sencilla", monogram: "S", status: "Disponible", rate: 1850, floor: 1 },
  { number: "102", name: "Doble", monogram: "D", status: "Ocupada", rate: 2450, floor: 1 },
  { number: "103", name: "Superior", monogram: "SU", status: "Limpieza", rate: 2950, floor: 1 },
  {
    number: "104",
    name: "Económica",
    monogram: "E",
    status: "Mantenimiento",
    rate: 1550,
    floor: 1,
  },
  { number: "201", name: "Superior", monogram: "SU", status: "Ocupada", rate: 2950, floor: 2 },
  { number: "202", name: "Doble", monogram: "D", status: "Disponible", rate: 2450, floor: 2 },
  {
    number: "203",
    name: "Suite Presidencial",
    monogram: "SP",
    status: "Ocupada",
    rate: 6250,
    floor: 2,
  },
  { number: "204", name: "Sencilla", monogram: "S", status: "Limpieza", rate: 1850, floor: 2 },
  {
    number: "301",
    name: "Suite Presidencial",
    monogram: "SP",
    status: "Disponible",
    rate: 6250,
    floor: 3,
  },
  { number: "302", name: "Superior", monogram: "SU", status: "Ocupada", rate: 2950, floor: 3 },
  { number: "303", name: "Doble", monogram: "D", status: "Disponible", rate: 2450, floor: 3 },
  { number: "304", name: "Sencilla", monogram: "S", status: "Mantenimiento", rate: 1850, floor: 3 },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    bed: (
      <>
        <path d="M3 19v-8m18 8v-5a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v5m-3-3h18" />
        <path d="M7 11V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M2 10h20" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15m6-12v15" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="3.5" cy="6" r=".5" />
        <circle cx="3.5" cy="12" r=".5" />
        <circle cx="3.5" cy="18" r=".5" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    logout: (
      <>
        <path d="M10 17l5-5-5-5m5 5H3" />
        <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    filter: <path d="M4 5h16M7 12h10m-7 7h4" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        H<i>✦</i>
      </span>
      {!compact && (
        <span className="logo-word">
          HospedaSmart <b>AI</b>
        </span>
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      setError("Revisa tu correo y contraseña para continuar.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = (await apiLogin({ email, password })) as {
        access_token: string;
        usuario?: { id?: string; nombre?: string; rol?: string };
      };
      setToken(r.access_token);
      setUsuario(r.usuario ?? null);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-form-side">
        <div className="login-inner">
          <Logo />
          <div className="login-copy">
            <span className="eyebrow">Bienvenida de nuevo</span>
            <h1>
              Todo listo para
              <br />
              <em>hospedar mejor.</em>
            </h1>
            <p>Accede al espacio de trabajo de Casa Áurea.</p>
          </div>
          <form onSubmit={submit} noValidate>
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@hotel.mx"
                aria-invalid={!!error}
              />
            </label>
            <label>
              Contraseña
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <Icon name="eye" />
                </button>
              </span>
            </label>
            <div className="form-row">
              <label className="check">
                <input type="checkbox" defaultChecked /> <span>Recordarme</span>
              </label>
              <button type="button" className="text-button">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button login-button" disabled={loading}>
              {loading ? (
                <span className="loader" />
              ) : (
                <>
                  Iniciar sesión <Icon name="arrow" />
                </>
              )}
            </button>
          </form>
          <p className="secure-note">
            <span>✦</span> Acceso seguro para personal autorizado
          </p>
        </div>
      </section>
      <section className="login-photo" style={{ backgroundImage: `url(${hotelPhoto})` }}>
        <div className="photo-top">
          <span>CASA ÁUREA</span>
          <span>VALLE DE BRAVO · MÉXICO</span>
        </div>
        <blockquote>
          “La hospitalidad está
          <br />
          en los <em>pequeños detalles.</em>”
        </blockquote>
        <p>
          Un espacio creado para que cada estancia
          <br />
          se sienta extraordinaria.
        </p>
        <small>Fotografía: Nereid Ndreu / Unsplash</small>
      </section>
    </main>
  );
}

const navItems = [
  ["dashboard", "grid", "Panel"],
  ["reservations", "calendar", "Reservas"],
  ["guests", "users", "Huéspedes"],
  ["rooms", "bed", "Habitaciones"],
  ["payments", "card", "Cobros"],
  ["assistant", "sparkle", "Asistente IA"],
  ["users", "users", "Usuarios"],
];

function Shell({
  screen,
  setScreen,
  children,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const perfil = perfilActual();
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo compact={collapsed} />
        </div>
        <nav aria-label="Navegación principal">
          {navItems.map(([id, icon, label]) => (
            <button
              key={id}
              className={screen === id ? "active" : ""}
              onClick={() => setScreen(id as Screen)}
              title={collapsed ? label : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {id === "assistant" && <i>AI</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-profile">
            <div className="avatar">{perfil.iniciales}</div>
            <span>
              <b>{perfil.nombre}</b>
              <small>{perfil.rol}</small>
            </span>
          </div>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>
            <Icon name="chevron" />
            <span>Contraer menú</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="mobile-logo" onClick={() => setScreen("dashboard")}>
            <Logo compact />
          </button>
          <button className="command">
            <Icon name="search" />
            <span>Buscar huésped, reserva o habitación...</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="top-actions">
            <button className="icon-button notification" aria-label="Notificaciones">
              <Icon name="bell" />
              <i />
            </button>
            <div className="top-profile">
              <div className="avatar">{perfil.iniciales}</div>
              <span>
                <b>{perfil.nombre}</b>
                <small>{perfil.rol}</small>
              </span>
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
      <nav className="mobile-nav">
        <button
          className={screen === "dashboard" ? "active" : ""}
          onClick={() => setScreen("dashboard")}
        >
          <Icon name="grid" />
          <span>Panel</span>
        </button>
        <button
          className={screen === "reservations" ? "active" : ""}
          onClick={() => setScreen("reservations")}
        >
          <Icon name="calendar" />
          <span>Reservas</span>
        </button>
        <button className="mobile-new" onClick={() => setScreen("reservations")}>
          <Icon name="plus" />
        </button>
        <button className={screen === "rooms" ? "active" : ""} onClick={() => setScreen("rooms")}>
          <Icon name="bed" />
          <span>Habitaciones</span>
        </button>
        <button
          className={screen === "assistant" ? "active" : ""}
          onClick={() => setScreen("assistant")}
        >
          <Icon name="sparkle" />
          <span>Asistente</span>
        </button>
      </nav>
    </div>
  );
}

function Dashboard({
  goRooms,
  newReservation,
  goReservations,
  goAssistant,
}: {
  goRooms: () => void;
  newReservation: () => void;
  goReservations: () => void;
  goAssistant: () => void;
}) {
  const hoy = isoLocal(new Date());
  const perfil = perfilActual();
  const [reservas, setReservas] = useState<ReservaApi[]>([]);
  const [huespedes, setHuespedes] = useState<HuespedApi[]>([]);
  const [habitaciones, setHabitaciones] = useState<Room[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    let vigente = true;
    Promise.all([getReservas(), getHuespedes(), getHabitaciones()])
      .then(async ([r, h, hab]) => {
        if (!vigente) return;
        setReservas(r as ReservaApi[]);
        setHuespedes(h as HuespedApi[]);
        const base = (hab as HabitacionApi[]).map(habitacionARoom);
        setHabitaciones(base);
        const conOcupacion = await Promise.all(
          base.map(async (x): Promise<Room> => {
            if (x.status !== "Disponible" || !x.id) return x;
            try {
              const o = (await getOcupacion(x.id)) as { ocupada?: boolean };
              return o.ocupada ? { ...x, status: "Ocupada" } : x;
            } catch {
              return x;
            }
          }),
        );
        if (vigente) setHabitaciones(conOcupacion);
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const activas = reservas.filter((r) => !/cancel/i.test(r.estado));
  const llegadas = activas.filter((r) => dia(r.fecha_entrada) === hoy);
  const salidas = activas.filter((r) => dia(r.fecha_salida) === hoy);
  const enCasa = activas.filter(
    (r) => dia(r.fecha_entrada) <= hoy && hoy < dia(r.fecha_salida),
  ).length;
  const totalHab = habitaciones.length;
  const cuenta = (estado: RoomStatus) => habitaciones.filter((h) => h.status === estado).length;
  const ocupadas = cuenta("Ocupada");
  const libres = cuenta("Disponible");
  const pct = totalHab ? Math.round((ocupadas / totalHab) * 100) : 0;
  const dias14 = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i));
  const ocupacion = dias14.map((d) =>
    totalHab
      ? Math.min(
          100,
          Math.round(
            (activas.filter((r) => dia(r.fecha_entrada) <= d && d < dia(r.fecha_salida)).length /
              totalHab) *
              100,
          ),
        )
      : 0,
  );
  const nombreDe = (id: string) => huespedes.find((h) => h.id === id)?.nombre ?? "Huésped";
  const detalleDe = (r: ReservaApi) => {
    const hab = habitaciones.find((h) => h.id === r.habitacion_id);
    const n = diasEntre(dia(r.fecha_entrada), dia(r.fecha_salida));
    return `${hab ? `${hab.name} ${hab.number}` : "Habitación"} · ${n} ${n === 1 ? "noche" : "noches"}`;
  };
  const colores = ["sage", "sand", "blue", "terracotta"];
  const fechaHoy = new Date()
    .toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">{fechaHoy}</span>
          <h1>
            {saludo()}, {perfil.primer}.
          </h1>
          <p>
            Hoy hay <b>{enCasa} {enCasa === 1 ? "reserva activa" : "reservas activas"}</b> y{" "}
            {llegadas.length} {llegadas.length === 1 ? "llegada pendiente" : "llegadas pendientes"}.
          </p>
        </div>
        <button className="gold-button" onClick={newReservation}>
          <Icon name="plus" /> Nueva reserva
        </button>
      </header>
      {cargando && <p className="muted">Cargando información del día…</p>}
      {errorCarga && (
        <p className="form-error">No se pudo cargar toda la información: {errorCarga}</p>
      )}
      <section className="bento-grid">
        <article className="card occupancy-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">HOY</span>
              <h2>Ocupación</h2>
            </div>
          </div>
          <div className="ring" style={{ "--value": `${pct}%` } as React.CSSProperties}>
            <div>
              <strong>
                {pct}
                <sup>%</sup>
              </strong>
              <span>
                {ocupadas} de {totalHab}
              </span>
            </div>
          </div>
          <div className="occupancy-note">
            <span className="sparkle">✦</span>
            <p>
              <b>
                {libres} {libres === 1 ? "habitación disponible" : "habitaciones disponibles"}
              </b>
              <br />
              <span>{ocupadas} ocupadas ahora</span>
            </p>
          </div>
        </article>
        <article className="card status-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">EN TIEMPO REAL</span>
              <h2>Estado de habitaciones</h2>
            </div>
            <button className="link-button" onClick={goRooms}>
              Ver todas <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="status-grid">
            {(
              [
                ["Disponible", libres, "available"],
                ["Ocupada", ocupadas, "occupied"],
                ["En limpieza", cuenta("Limpieza"), "cleaning"],
                ["Mantenimiento", cuenta("Mantenimiento"), "maintenance"],
              ] as const
            ).map(([label, count, cls]) => (
              <button key={label} className={`status-tile ${cls}`} onClick={goRooms}>
                <span className="status-dot" />
                <strong>{count}</strong>
                <span>{label}</span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </article>
        <article className="card arrivals-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{llegadas.length} PENDIENTES</span>
              <h2>Llegadas de hoy</h2>
            </div>
            <button className="link-button" onClick={goReservations}>
              Ver agenda
            </button>
          </div>
          {llegadas.length === 0 && <p className="muted">No hay llegadas para hoy.</p>}
          {llegadas.slice(0, 4).map((r, i) => (
            <GuestRow
              key={r.id}
              initials={inicialesDe(nombreDe(r.huesped_id))}
              name={nombreDe(r.huesped_id)}
              detail={detalleDe(r)}
              time="Hoy"
              action="Ver reserva"
              color={colores[i % 4]}
              onAction={goReservations}
            />
          ))}
        </article>
        <article className="card chart-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">PRÓXIMOS 14 DÍAS</span>
              <h2>Tendencia de ocupación</h2>
            </div>
            <div className="legend">
              <i /> Ocupación
            </div>
          </div>
          <div className="chart">
            <div className="chart-lines">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
            </div>
            <div className="bars">
              {ocupacion.map((v, i) => (
                <div key={dias14[i]} className={i === 0 ? "today" : ""}>
                  <i style={{ height: `${v}%` }} />
                  <span>{i % 2 === 0 ? aFecha(dias14[i]).getDate() : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="card departures-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{salidas.length} POR SALIR</span>
              <h2>Salidas de hoy</h2>
            </div>
          </div>
          {salidas.length === 0 && <p className="muted">No hay salidas para hoy.</p>}
          {salidas.slice(0, 4).map((r, i) => (
            <GuestRow
              key={r.id}
              initials={inicialesDe(nombreDe(r.huesped_id))}
              name={nombreDe(r.huesped_id)}
              detail={detalleDe(r)}
              time="Hoy"
              action="Ver reserva"
              color={colores[(i + 2) % 4]}
              onAction={goReservations}
            />
          ))}
        </article>
        <article className="card ai-card">
          <span className="ai-icon">
            <Icon name="sparkle" />
          </span>
          <div>
            <span className="eyebrow">HOSPEDASMART AI</span>
            <h2>Consulta a tu asistente</h2>
            <p>Pregunta por horarios, políticas y servicios del hotel.</p>
            <button onClick={goAssistant}>
              Abrir asistente <Icon name="arrow" size={16} />
            </button>
          </div>
        </article>
      </section>
    </>
  );
}

function GuestRow({
  initials,
  name,
  detail,
  time,
  action,
  color,
  onAction,
}: {
  initials: string;
  name: string;
  detail: string;
  time: string;
  action: string;
  color: string;
  onAction?: () => void;
}) {
  return (
    <div className="guest-row">
      <div className={`avatar ${color}`}>{initials}</div>
      <div className="guest-info">
        <b>{name}</b>
        <span>{detail}</span>
      </div>
      <time>{time}</time>
      <button onClick={onAction}>{action}</button>
    </div>
  );
}

type Room = (typeof rooms)[number] & { id?: string };

// Habitacion del backend (habitaciones-service) -> forma que usa la pantalla.
type HabitacionApi = {
  id: string;
  numero: string;
  tipo: "individual" | "doble" | "suite";
  capacidad: number;
  precio_noche: string | number;
  estado_operativo: "disponible" | "limpieza" | "mantenimiento";
};
const tipoInfo = {
  individual: { name: "Sencilla", monogram: "S" },
  doble: { name: "Doble", monogram: "D" },
  suite: { name: "Suite", monogram: "SU" },
} as const;
const estadoInfo = {
  disponible: "Disponible",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
} as const;
function habitacionARoom(h: HabitacionApi): Room {
  const numero = parseInt(h.numero, 10);
  return {
    id: h.id,
    number: h.numero,
    name: tipoInfo[h.tipo]?.name ?? h.tipo,
    monogram: tipoInfo[h.tipo]?.monogram ?? "H",
    status: estadoInfo[h.estado_operativo] ?? "Disponible",
    rate: Number(h.precio_noche),
    floor: Number.isFinite(numero) && numero >= 100 ? Math.floor(numero / 100) : 1,
  };
}


function BandejaSolicitudes() {
  type Solicitud = {
    id: string; habitacion_numero: string; tipo: string; detalle: string;
    estado: "pendiente" | "en_atencion" | "completada";
  };
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(false);
  const [accion, setAccion] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [verCompletadas, setVerCompletadas] = useState(false);
  const vigente = useSolicitudRef(false);
  const bloqueo = useSolicitudRef(false);
  const etiquetas: Record<string, string> = {
    toallas: "Toallas", limpieza: "Limpieza", mantenimiento: "Mantenimiento",
    pendiente: "Pendiente", en_atencion: "En atención", completada: "Completada",
  };

  const cargar = async () => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setCargando(true); setError(""); setMensaje("");
    try {
      const datos = await getSolicitudesHabitacion();
      if (!Array.isArray(datos)) throw new Error("Respuesta de solicitudes no válida.");
      if (vigente.current) setSolicitudes(datos);
    } catch (e) {
      if (vigente.current) setError(e instanceof Error ? e.message : "No se pudo cargar la bandeja.");
    } finally {
      bloqueo.current = false;
      if (vigente.current) setCargando(false);
    }
  };

  useEffect(() => {
    vigente.current = true;
    void cargar();
    return () => { vigente.current = false; };
  }, []);

  const cambiar = async (id: string, estado: "en_atencion" | "completada") => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setAccion(id); setError(""); setMensaje("");
    try {
      const actualizada = await actualizarSolicitudHabitacion(id, estado);
      if (vigente.current) {
        setSolicitudes((anteriores) => anteriores.map(
          (s) => s.id === id ? { ...s, ...actualizada } : s
        ));
        setMensaje(estado === "completada"
          ? "Solicitud completada." : "Solicitud en atención.");
      }
    } catch (e) {
      if (vigente.current) setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      bloqueo.current = false;
      if (vigente.current) setAccion("");
    }
  };

  const visibles = solicitudes.filter(
    (s) => verCompletadas || s.estado !== "completada"
  );
  return <section className="drawer-section" aria-labelledby="titulo-solicitudes">
    <h2 id="titulo-solicitudes">Solicitudes a habitación</h2>
    <p>Últimas 100 solicitudes permitidas para tu rol. Actualiza para consultar cambios.</p>
    <button type="button" className="secondary-button"
      disabled={cargando || accion !== ""} onClick={cargar}>
      {cargando ? "Cargando…" : "Actualizar solicitudes"}
    </button>
    <label>
      <input type="checkbox" checked={verCompletadas}
        onChange={(e) => setVerCompletadas(e.target.checked)} />
      Mostrar completadas
    </label>
    {error && <p className="form-error" role="alert">{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
    {!cargando && !error && !visibles.length &&
      <p>No hay solicitudes para mostrar.</p>}
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", textAlign: "left" }}>
        <caption>Atención de solicitudes de huéspedes</caption>
        <thead><tr>
          <th scope="col">Habitación</th><th scope="col">Servicio</th>
          <th scope="col">Detalle</th><th scope="col">Estado</th>
          <th scope="col">Acción</th>
        </tr></thead>
        <tbody>{visibles.map((s) => <tr key={s.id}>
          <td>{s.habitacion_numero}</td>
          <td>{etiquetas[s.tipo] ?? s.tipo}</td>
          <td style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {s.detalle || "Sin detalle"}
          </td>
          <td>{etiquetas[s.estado] ?? s.estado}</td>
          <td>{s.estado !== "completada" ? (
            <button type="button" className="secondary-button"
              disabled={cargando || accion !== ""}
              onClick={() => cambiar(s.id,
                s.estado === "pendiente" ? "en_atencion" : "completada")}>
              {accion === s.id ? "Guardando…"
                : s.estado === "pendiente" ? "Atender" : "Completar"}
            </button>
          ) : "Finalizada"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function Rooms() {
  type ReservaCalendario = {
    habitacion_id: string;
    fecha_entrada: string;
    fecha_salida: string;
    estado: string;
  };
  const [reservasCalendario, setReservasCalendario] = useState<ReservaCalendario[]>([]);
  const [cargandoCalendario, setCargandoCalendario] = useState(false);
  const [errorCalendario, setErrorCalendario] = useState("");

  const [detalleHabitacion, setDetalleHabitacion] = useState<HabitacionApi | null>(null);
  const [ocupadaDetalle, setOcupadaDetalle] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalleHabitacion, setErrorDetalleHabitacion] = useState("");

  const verDetalleCompleto = async () => {
    if (!selected?.id || cargandoDetalle) return;
    const id = selected.id;
    setCargandoDetalle(true);
    setErrorDetalleHabitacion("");
    setDetalleHabitacion(null);
    try {
      const [datos, ocupacion] = await Promise.all([
        getHabitacion(id),
        getOcupacion(id),
      ]);
      setDetalleHabitacion(datos as HabitacionApi);
      setOcupadaDetalle(Boolean((ocupacion as { ocupada?: boolean }).ocupada));
    } catch (err) {
      setErrorDetalleHabitacion(err instanceof Error ? err.message : "No se pudo cargar el detalle.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");

  const cambiarEstado = async (estado: RoomStatus) => {
    if (!selected?.id || guardandoEstado || estado === "Ocupada") return;
    const id = selected.id;
    setErrorEstado("");
    setGuardandoEstado(true);
    try {
      const datos = await cambiarEstadoHabitacion(id, {
        estado_operativo: estado.toLowerCase(),
      });
      const actualizada = habitacionARoom(datos as HabitacionApi);
      setLista((previas) => previas.map((r) => r.id === id ? actualizada : r));
      setSelected((previa) => previa?.id === id ? actualizada : previa);
    } catch (err) {
      setErrorEstado(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setGuardandoEstado(false);
    }
  };

  const [view, setView] = useState<"map" | "cards">("map");
  const [filter, setFilter] = useState<"Todas" | RoomStatus>("Todas");
  const [selected, setSelected] = useState<Room | null>(null);
  const [query, setQuery] = useState("");
  const [lista, setLista] = useState<Room[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    let vigente = true;
    getHabitaciones()
      .then(async (datos) => {
        const base = (datos as HabitacionApi[]).map(habitacionARoom);
        if (vigente) setLista(base);
        // Una habitación ocupada sigue "disponible" en el backend: se consulta aparte.
        const conOcupacion = await Promise.all(
          base.map(async (r): Promise<Room> => {
            if (r.status !== "Disponible" || !r.id) return r;
            try {
              const o = (await getOcupacion(r.id)) as { ocupada?: boolean };
              return o.ocupada ? { ...r, status: "Ocupada" } : r;
            } catch {
              return r;
            }
          }),
        );
        if (vigente) setLista(conOcupacion);
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);


  useEffect(() => {
    if (!selected?.id) return;
    let vigente = true;
    setCargandoCalendario(true);
    setErrorCalendario("");
    setReservasCalendario([]);
    getReservas()
      .then((datos) => {
        if (!Array.isArray(datos)) throw new Error("Respuesta de reservas no válida.");
        if (vigente) setReservasCalendario(datos as ReservaCalendario[]);
      })
      .catch((err) => {
        if (vigente) setErrorCalendario(
          err instanceof Error ? err.message : "No se pudo consultar la ocupación."
        );
      })
      .finally(() => {
        if (vigente) setCargandoCalendario(false);
      });
    return () => { vigente = false; };
  }, [selected?.id]);

  const partesHoy = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const parteHoy = (tipo: string) => partesHoy.find((p) => p.type === tipo)?.value ?? "";
  const hoyCalendario = `${parteHoy("year")}-${parteHoy("month")}-${parteHoy("day")}`;
  const diasCalendario = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(`${hoyCalendario}T12:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + i);
    const clave = fecha.toISOString().slice(0, 10);
    const reservada = reservasCalendario.some((r) =>
      r.habitacion_id === selected?.id &&
      !/cancel|finalizada/i.test(r.estado) &&
      r.fecha_entrada.slice(0, 10) <= clave &&
      clave < r.fecha_salida.slice(0, 10)
    );
    return {
      clave,
      numero: fecha.getUTCDate(),
      semana: new Intl.DateTimeFormat("es-MX", {
        weekday: "short", timeZone: "UTC",
      }).format(fecha),
      etiqueta: new Intl.DateTimeFormat("es-MX", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      }).format(fecha),
      reservada,
    };
  });

  const visibleRooms = useMemo(
    () =>
      lista.filter(
        (r) =>
          (filter === "Todas" || r.status === filter) &&
          `${r.number} ${r.name}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [lista, filter, query],
  );

  return (
    <>
      <header className="page-heading rooms-heading">
        <div>
          <span className="eyebrow">ALOJAMIENTO</span>
          <h1>Habitaciones</h1>
          <p>Un vistazo sereno a cada rincón de Casa Áurea.</p>
        </div>
        <button className="primary-button">
          <Icon name="plus" /> Nueva habitación
        </button>
      </header>
      <BandejaSolicitudes />
      <section className="rooms-toolbar">
        <div className="view-toggle">
          <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            <Icon name="map" /> Mapa del hotel
          </button>
          <button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>
            <Icon name="list" /> Tarjetas
          </button>
        </div>
        <div className="room-tools">
          <label className="room-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar habitación"
            />
          </label>
          <button className="filter-button">
            <Icon name="filter" /> Filtros
          </button>
        </div>
      </section>
      <div className="filter-chips">
        {(["Todas", "Disponible", "Ocupada", "Limpieza", "Mantenimiento"] as const).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f !== "Todas" && <i className={`dot ${f.toLowerCase()}`} />}
            {f}
            {f === "Todas" && <span>{lista.length}</span>}
          </button>
        ))}
      </div>
      {cargando && <p className="muted">Cargando habitaciones…</p>}
      {errorCarga && <p className="form-error">No se pudieron cargar las habitaciones: {errorCarga}</p>}
      {view === "map" ? (
        <section className="hotel-map">
          <div className="map-legend">
            <span>
              <i className="dot disponible" /> Disponible
            </span>
            <span>
              <i className="dot ocupada" /> Ocupada
            </span>
            <span>
              <i className="dot limpieza" /> Limpieza
            </span>
            <span>
              <i className="dot mantenimiento" /> Mantenimiento
            </span>
          </div>
          {[3, 2, 1].map((floor) => (
            <div className="floor" key={floor}>
              <div className="floor-label">
                <span>0{floor}</span>
                <div>
                  <b>Piso {floor}</b>
                  <small>
                    {floor === 3
                      ? "Suites & terraza"
                      : floor === 2
                        ? "Habitaciones superiores"
                        : "Jardín & recepción"}
                  </small>
                </div>
              </div>
              <div className="floor-rooms">
                {visibleRooms
                  .filter((r) => r.floor === floor)
                  .map((room) => (
                    <button
                      key={room.number}
                      className={`room-cell ${room.status.toLowerCase()}`}
                      onClick={() => setSelected(room)}
                    >
                      <span className="room-monogram">{room.monogram}</span>
                      <span className="room-number">{room.number}</span>
                      <span className="room-name">{room.name}</span>
                      <span className="room-state">
                        <i />
                        {room.status}
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="room-cards">
          {visibleRooms.map((room) => (
            <button className="room-card" key={room.number} onClick={() => setSelected(room)}>
              <div className={`room-card-image ${room.status.toLowerCase()}`}>
                <span>{room.monogram}</span>
                <small>{room.status}</small>
              </div>
              <div className="room-card-copy">
                <div>
                  <span>Habitación {room.number}</span>
                  <h3>{room.name}</h3>
                </div>
                <p>
                  <b>${room.rate.toLocaleString("es-MX")}</b> MXN <small>/ noche</small>
                </p>
              </div>
            </button>
          ))}
        </section>
      )}
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="room-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Cerrar">
              <Icon name="close" />
            </button>
            <span className="room-monogram large">{selected.monogram}</span>
            <span className="eyebrow">HABITACIÓN {selected.number}</span>
            <h2>{selected.name}</h2>
            <span className={`state-badge ${selected.status.toLowerCase()}`}>
              <i /> {selected.status}
            </span>
            <div className="drawer-rate">
              <span>Tarifa por noche</span>
              <strong>
                ${selected.rate.toLocaleString("es-MX")} <small>MXN</small>
              </strong>
            </div>
            <div className="drawer-section">
              <h3>Ocupación próxima</h3>
              {cargandoCalendario ? (
                <p role="status">Consultando reservas…</p>
              ) : errorCalendario ? (
                <p className="form-error" role="alert">{errorCalendario}</p>
              ) : (
                <>
                  <div className="mini-calendar">
                    {diasCalendario.map((d) => (
                      <span
                        className={d.reservada ? "busy" : ""}
                        key={d.clave}
                        title={`${d.etiqueta}: ${d.reservada ? "Con reserva" : "Sin reserva"}`}
                        aria-label={`${d.etiqueta}: ${d.reservada ? "Con reserva" : "Sin reserva"}`}
                      >
                        <small>{d.semana.toUpperCase()}</small>
                        {d.numero}
                      </span>
                    ))}
                  </div>
                  <p className="muted">
                    Próximos 7 días · Días coloreados: con reserva.
                    Sin reserva no implica disponibilidad si hay limpieza o mantenimiento.
                  </p>
                </>
              )}
            </div>
            <div className="drawer-section">
              <h3>Cambiar estado</h3>
              {errorEstado && <p className="form-error" role="alert">{errorEstado}</p>}
              {guardandoEstado && <p role="status">Guardando estado…</p>}

              <div className="state-selector">
                {(["Disponible", "Ocupada", "Limpieza", "Mantenimiento"] as RoomStatus[]).map(
                  (s) => (
                    <button
                      className={s === selected.status ? "active" : ""}
                      key={s}
                      disabled={guardandoEstado || !selected.id || s === "Ocupada" || selected.status === "Ocupada" || s === selected.status}
                      onClick={() => cambiarEstado(s)}
                    >
                      <i className={`dot ${s.toLowerCase()}`} />
                      {s}
                    </button>
                  ),
                )}
              </div>
            </div>
            <button
              className="primary-button full"
              onClick={verDetalleCompleto}
              disabled={cargandoDetalle || guardandoEstado || !selected.id}
            >
              {cargandoDetalle ? "Cargando detalle…" : "Ver detalle completo"} <Icon name="arrow" />
            </button>
            {errorDetalleHabitacion && (
              <p className="form-error" role="alert">{errorDetalleHabitacion}</p>
            )}
            {detalleHabitacion?.id === selected.id && (
              <div className="drawer-section" aria-live="polite">
                <h3>Detalle de la habitación</h3>
                <div className="booking-facts">
                  <span><small>Número</small><b>{detalleHabitacion.numero}</b></span>
                  <span><small>Tipo</small><b>{tipoInfo[detalleHabitacion.tipo]?.name ?? detalleHabitacion.tipo}</b></span>
                  <span><small>Capacidad</small><b>{detalleHabitacion.capacidad} personas</b></span>
                  <span><small>Tarifa por noche</small><b>{dinero(Number(detalleHabitacion.precio_noche))}</b></span>
                  <span><small>Estado operativo</small><b>{estadoInfo[detalleHabitacion.estado_operativo]}</b></span>
                  <span><small>Ocupación actual</small><b>{ocupadaDetalle ? "Ocupada" : "Sin estancia activa"}</b></span>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

const guestsSeed = [
  {
    initials: "LG",
    name: "Laura García",
    email: "laura.garcia@email.mx",
    phone: "+52 55 8421 3090",
    stays: 8,
    spend: 42680,
    tag: "Frecuente",
    last: "12 may 2025",
  },
  {
    initials: "FM",
    name: "Fernando Mora",
    email: "fernando@mora.mx",
    phone: "+52 81 9023 1147",
    stays: 3,
    spend: 18450,
    tag: "Frecuente",
    last: "28 abr 2025",
  },
  {
    initials: "AC",
    name: "Ana Cortés",
    email: "ana.cortes@email.mx",
    phone: "+52 33 7205 8831",
    stays: 1,
    spend: 4900,
    tag: "Nuevo",
    last: "Primera visita",
  },
  {
    initials: "RS",
    name: "Roberto Silva",
    email: "roberto@silva.mx",
    phone: "+52 55 1480 2230",
    stays: 5,
    spend: 31200,
    tag: "Frecuente",
    last: "18 jun 2025",
  },
  {
    initials: "MV",
    name: "Mónica Vega",
    email: "monica.vega@email.mx",
    phone: "+52 55 6231 9035",
    stays: 2,
    spend: 10280,
    tag: "Nuevo",
    last: "18 jun 2025",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading module-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

type Guest = (typeof guestsSeed)[number] & { id?: string };
type HuespedApi = { id: string; nombre: string; email: string; telefono: string };

function huespedAGuest(h: HuespedApi): Guest {
  const initials = h.nombre
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // El backend aún no guarda estancias ni gasto: se muestran en cero hasta conectar reservas.
  return {
    id: h.id,
    initials,
    name: h.nombre,
    email: h.email,
    phone: h.telefono,
    stays: 0,
    spend: 0,
    tag: "Nuevo",
    last: "Sin estancias",
  };
}

function Guests() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Guest | null>(null);
  const [creating, setCreating] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [name, setName] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    getHuespedes()
      .then((datos) => {
        if (vigente) setGuests((datos as HuespedApi[]).map(huespedAGuest));
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const filtered = guests.filter((guest) =>
    `${guest.name} ${guest.email} ${guest.phone}`.toLowerCase().includes(query.toLowerCase()),
  );

  const createGuest = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setErrorForm("");
    setGuardando(true);
    try {
      const creado = (await crearHuesped({
        nombre: `${name} ${apellidos}`.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
      })) as HuespedApi;
      setGuests((actuales) => [huespedAGuest(creado), ...actuales]);
      setCreating(false);
      setName("");
      setApellidos("");
      setEmail("");
      setTelefono("");
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo guardar el huésped.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <SectionHeading
        eyebrow="RELACIONES"
        title="Huéspedes"
        description="Historias, preferencias y estancias reunidas con cuidado."
        action={
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nuevo huésped
          </button>
        }
      />
      <section className="module-card data-card">
        <div className="data-toolbar">
          <label className="wide-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, correo o teléfono"
            />
          </label>
          <span>{filtered.length} huéspedes</span>
        </div>
        {cargando && <p className="muted">Cargando huéspedes…</p>}
        {errorCarga && (
          <p className="form-error">No se pudieron cargar los huéspedes: {errorCarga}</p>
        )}
        <div className="guest-table">
          <div className="table-head">
            <span>Huésped</span>
            <span>Contacto</span>
            <span>Estancias</span>
            <span>Gasto total</span>
            <span>Última visita</span>
            <span />
          </div>
          {filtered.map((guest) => (
            <button className="table-row" key={guest.id ?? guest.email} onClick={() => setSelected(guest)}>
              <span className="person-cell">
                <i className="avatar">{guest.initials}</i>
                <span>
                  <b>{guest.name}</b>
                  <small className={`guest-tag ${guest.tag.toLowerCase()}`}>{guest.tag}</small>
                </span>
              </span>
              <span>
                <b>{guest.email}</b>
                <small>{guest.phone}</small>
              </span>
              <span className="tabular">{guest.stays}</span>
              <span className="tabular">${guest.spend.toLocaleString("es-MX")}.00</span>
              <span>{guest.last}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </section>
      {(selected || creating) && (
        <div className="drawer-backdrop" onClick={() => (setSelected(null), setCreating(false))}>
          <aside className="room-drawer guest-drawer" onClick={(event) => event.stopPropagation()}>
            <button
              className="drawer-close"
              onClick={() => (setSelected(null), setCreating(false))}
              aria-label="Cerrar"
            >
              <Icon name="close" />
            </button>
            {creating ? (
              <form onSubmit={createGuest}>
                <span className="eyebrow">NUEVO REGISTRO</span>
                <h2>Crear huésped</h2>
                <p className="drawer-intro">
                  Agrega los datos esenciales. Podrás completar el perfil después.
                </p>
                <div className="two-col-form">
                  <label>
                    Nombre(s)
                    <input
                      autoFocus
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nombre completo"
                      required
                    />
                  </label>
                  <label>
                    Apellidos
                    <input
                      value={apellidos}
                      onChange={(event) => setApellidos(event.target.value)}
                      placeholder="Apellidos"
                    />
                  </label>
                  <label className="span-two">
                    Correo electrónico
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nombre@email.mx"
                      required
                    />
                  </label>
                  <label>
                    Teléfono
                    <input
                      value={telefono}
                      onChange={(event) => setTelefono(event.target.value)}
                      placeholder="+52 55 0000 0000"
                      required
                    />
                  </label>
                </div>
                {errorForm && (
                  <div className="form-error" role="alert">
                    {errorForm}
                  </div>
                )}
                <button className="primary-button full" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar huésped"}
                </button>
              </form>
            ) : (
              selected && (
                <>
                  <div className="profile-hero">
                    <div className="avatar">{selected.initials}</div>
                    <span className="eyebrow">PERFIL DEL HUÉSPED</span>
                    <h2>{selected.name}</h2>
                    <span className={`guest-tag ${selected.tag.toLowerCase()}`}>
                      {selected.tag}
                    </span>
                  </div>
                  <div className="profile-contact">
                    <span>
                      <small>Correo</small>
                      <b>{selected.email}</b>
                    </span>
                    <span>
                      <small>Teléfono</small>
                      <b>{selected.phone}</b>
                    </span>
                  </div>
                  <div className="profile-spend">
                    <span>Gasto histórico</span>
                    <strong>${selected.spend.toLocaleString("es-MX")}.00</strong>
                    <small>MXN · {selected.stays} estancias</small>
                  </div>
                  <div className="drawer-section">
                    <h3>Historial de estancias</h3>
                    <p className="muted">El historial aparecerá cuando se conecten las reservas.</p>
                  </div>
                </>
              )
            )}
          </aside>
        </div>
      )}
    </>
  );
}

type ReservaApi = {
  id: string;
  habitacion_id: string;
  huesped_id: string;
  fecha_entrada: string;
  fecha_salida: string;
  total: string | number;
  estado: string;
};

// Fechas como texto AAAA-MM-DD (hora local), para evitar saltos de día por zona horaria.
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dia = (valor: unknown) => String(valor).slice(0, 10);
const aFecha = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const diasEntre = (a: string, b: string) =>
  Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86400000);
const sumarDias = (iso: string, n: number) => {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
const fechaCorta = (iso: string) =>
  aFecha(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const dinero = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const inicialesDe = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Reservations({ onCheckIn }: { onCheckIn: () => void }) {
  const hoy = isoLocal(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [reservas, setReservas] = useState<ReservaApi[]>([]);
  const [huespedes, setHuespedes] = useState<HuespedApi[]>([]);
  const [habitaciones, setHabitaciones] = useState<HabitacionApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [version, setVersion] = useState(0);
  const [semana, setSemana] = useState(0);
  const [detalle, setDetalle] = useState<ReservaApi | null>(null);
  const [errorDetalle, setErrorDetalle] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [accion, setAccion] = useState<"" | "entrada" | "salida">("");
  const [mensajeDetalle, setMensajeDetalle] = useState("");

  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [huespedId, setHuespedId] = useState("");
  const [entrada, setEntrada] = useState(hoy);
  const [salida, setSalida] = useState(sumarDias(hoy, 1));
  const [habitacionId, setHabitacionId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([getReservas(), getHuespedes(), getHabitaciones()])
      .then(([r, h, hab]) => {
        if (!vigente) return;
        setReservas(r as ReservaApi[]);
        setHuespedes(h as HuespedApi[]);
        setHabitaciones(hab as HabitacionApi[]);
        setErrorCarga("");
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  useEffect(() => {
    setDetalle((anterior) => anterior
      ? reservas.find((r) => r.id === anterior.id) ?? anterior
      : null);
  }, [reservas]);

  const abrirDetalle = (r: ReservaApi) => {
    setErrorDetalle("");
    setMensajeDetalle("");
    setDetalle(r);
  };

  const nombreHuesped = (id: string) => huespedes.find((h) => h.id === id)?.nombre ?? "Huésped";
  const etiquetaHab = (id: string) => {
    const h = habitaciones.find((x) => x.id === id);
    return h ? `${h.numero} · ${tipoInfo[h.tipo]?.name ?? h.tipo}` : "Habitación";
  };
  const cancelada = (r: ReservaApi) => /cancel/i.test(r.estado);
  const etiquetaEstado = (r: ReservaApi) =>
    r.estado ? r.estado.charAt(0).toUpperCase() + r.estado.slice(1) : "—";
  const claseEstado = (r: ReservaApi) => (cancelada(r) ? "checkout" : "confirmed");

  const activas = reservas.filter((r) => !cancelada(r));
  const llegadas = activas.filter((r) => dia(r.fecha_entrada) === hoy).length;
  const salidas = activas.filter((r) => dia(r.fecha_salida) === hoy).length;
  const enCasa = activas.filter(
    (r) => dia(r.fecha_entrada) <= hoy && hoy < dia(r.fecha_salida),
  ).length;
  const libres = habitaciones.filter((h) => h.estado_operativo === "disponible").length;

  // Semana visible (lunes a domingo)
  const lunes = sumarDias(hoy, -((aFecha(hoy).getDay() + 6) % 7) + semana * 7);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const finSemana = sumarDias(lunes, 7);
  const barras = activas
    .map((r, i) => {
      const ini = dia(r.fecha_entrada) > lunes ? dia(r.fecha_entrada) : lunes;
      const fin = dia(r.fecha_salida) < finSemana ? dia(r.fecha_salida) : finSemana;
      return { r, i, start: diasEntre(lunes, ini), span: diasEntre(ini, fin) };
    })
    .filter((b) => b.span > 0);
  const ordenadas = [...reservas].sort((a, b) =>
    dia(b.fecha_entrada).localeCompare(dia(a.fecha_entrada)),
  );

  // Asistente de nueva reserva
  const huespedesFiltrados = huespedes
    .filter((h) => `${h.nombre} ${h.email}`.toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 6);
  const noches = entrada && salida ? diasEntre(entrada, salida) : 0;
  const disponibles = habitaciones.filter((h) => h.estado_operativo === "disponible");
  const habSel = habitaciones.find((h) => h.id === habitacionId);
  const total = habSel ? noches * Number(habSel.precio_noche) : 0;
  const puedeContinuar =
    step === 1 ? !!huespedId : step === 2 ? noches > 0 : !!habitacionId && noches > 0;

  const cerrarWizard = () => {
    setWizard(false);
    setStep(1);
    setBusqueda("");
    setHuespedId("");
    setHabitacionId("");
    setEntrada(hoy);
    setSalida(sumarDias(hoy, 1));
    setErrorForm("");
    setSuccess(false);
  };

  const advance = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setErrorForm("");
    setGuardando(true);
    try {
      await crearReserva({
        habitacion_id: habitacionId,
        huesped_id: huespedId,
        fecha_entrada: entrada,
        fecha_salida: salida,
      });
      setSuccess(true);
      setVersion((v) => v + 1);
      window.setTimeout(cerrarWizard, 1500);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo crear la reserva.");
    } finally {
      setGuardando(false);
    }
  };

  const registrar = async (tipo: "entrada" | "salida") => {
    if (!detalle) return;
    setErrorDetalle("");
    setMensajeDetalle("");
    setAccion(tipo);
    try {
      if (tipo === "entrada") await checkIn(detalle.id);
      else await checkOut(detalle.id);
      setMensajeDetalle(tipo === "entrada" ? "Check-in registrado." : "Check-out registrado.");
      setVersion((v) => v + 1);
    } catch (err) {
      setErrorDetalle(err instanceof Error ? err.message : "No se pudo completar la operación.");
    } finally {
      setAccion("");
    }
  };

  const cancelar = async () => {
    if (!detalle) return;
    setErrorDetalle("");
    setCancelando(true);
    try {
      await cancelarReserva(detalle.id);
      setDetalle(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setErrorDetalle(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <SectionHeading
        eyebrow="ESTANCIAS"
        title="Reservas"
        description="Cada llegada, organizada con precisión y calidez."
        action={
          <button className="gold-button" onClick={() => setWizard(true)}>
            <Icon name="plus" /> Nueva reserva
          </button>
        }
      />
      <section className="reservation-summary">
        <div>
          <span className="eyebrow">HOY</span>
          <strong>{llegadas}</strong>
          <small>Llegadas</small>
        </div>
        <div>
          <span className="eyebrow">HOY</span>
          <strong>{salidas}</strong>
          <small>Salidas</small>
        </div>
        <div>
          <span className="eyebrow">EN CASA</span>
          <strong>{enCasa}</strong>
          <small>Reservas activas</small>
        </div>
        <div className="summary-note">
          <Icon name="sparkle" />
          <p>
            <b>Disponibilidad</b>
            <span>
              {libres === 1 ? "Hay 1 habitación disponible." : `Hay ${libres} habitaciones disponibles.`}
            </span>
          </p>
        </div>
      </section>
      <section className="module-card reservations-card">
        <div className="data-toolbar">
          <div className="view-toggle">
            <button
              className={view === "calendar" ? "active" : ""}
              onClick={() => setView("calendar")}
            >
              <Icon name="calendar" /> Calendario
            </button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              <Icon name="list" /> Lista
            </button>
          </div>
          <div className="week-nav">
            <button onClick={() => setSemana(semana - 1)}>‹</button>
            <b>
              {fechaCorta(lunes)} – {fechaCorta(sumarDias(lunes, 6))}
            </b>
            <button onClick={() => setSemana(semana + 1)}>›</button>
          </div>
        </div>
        {cargando && <p className="muted">Cargando reservas…</p>}
        {errorCarga && (
          <p className="form-error">No se pudieron cargar las reservas: {errorCarga}</p>
        )}
        {!cargando && !errorCarga && reservas.length === 0 && (
          <p className="muted">Aún no hay reservas. Crea la primera con “Nueva reserva”.</p>
        )}
        {view === "calendar" ? (
          <div className="gantt-wrap">
            <div className="gantt-header">
              <span>Habitación</span>
              {dias.map((d, i) => (
                <span className={d === hoy ? "today" : ""} key={d}>
                  {["L", "M", "M", "J", "V", "S", "D"][i]} {aFecha(d).getDate()}
                </span>
              ))}
            </div>
            {barras.map(({ r, i, start, span }) => (
              <button className="gantt-row" key={r.id} onClick={() => abrirDetalle(r)}>
                <span>{etiquetaHab(r.habitacion_id)}</span>
                <i
                  className={`booking-bar ${["sage", "blue", "terracotta", "sand"][i % 4]}`}
                  style={{ gridColumn: `${start + 2} / span ${span}` }}
                >
                  {nombreHuesped(r.huesped_id)}
                </i>
              </button>
            ))}
          </div>
        ) : (
          <div className="reservation-list">
            {ordenadas.map((r) => (
              <button key={r.id} onClick={() => abrirDetalle(r)}>
                <span className="avatar">{inicialesDe(nombreHuesped(r.huesped_id))}</span>
                <span>
                  <b>{nombreHuesped(r.huesped_id)}</b>
                  <small>RES-{r.id.slice(0, 6).toUpperCase()}</small>
                </span>
                <span>
                  <small>Estancia</small>
                  <b>
                    {fechaCorta(dia(r.fecha_entrada))} – {fechaCorta(dia(r.fecha_salida))}
                  </b>
                </span>
                <span>
                  <small>Habitación</small>
                  <b>{etiquetaHab(r.habitacion_id)}</b>
                </span>
                <span className={`reservation-status ${claseEstado(r)}`}>{etiquetaEstado(r)}</span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        )}
      </section>
      {wizard && (
        <div className="modal-backdrop" onClick={cerrarWizard}>
          <section className="booking-modal" onClick={(event) => event.stopPropagation()}>
            {success ? (
              <div className="success-state">
                <span className="success-check">✓</span>
                <span className="eyebrow">RESERVA CREADA</span>
                <h2>Todo está listo.</h2>
                <p>La reserva de {nombreHuesped(huespedId)} ya aparece en el calendario.</p>
              </div>
            ) : (
              <>
                <button className="drawer-close" onClick={cerrarWizard}>
                  <Icon name="close" />
                </button>
                <span className="eyebrow">NUEVA RESERVA</span>
                <h2>Una nueva estancia</h2>
                <div className="stepper">
                  {["Huésped", "Fechas", "Habitación"].map((label, index) => (
                    <span className={step >= index + 1 ? "active" : ""} key={label}>
                      <i>{index + 1}</i>
                      {label}
                    </span>
                  ))}
                </div>
                <div className="wizard-content">
                  {step === 1 && (
                    <>
                      <label className="wide-search">
                        <Icon name="search" />
                        <input
                          value={busqueda}
                          onChange={(event) => setBusqueda(event.target.value)}
                          placeholder="Busca un huésped por nombre o correo"
                        />
                      </label>
                      {huespedes.length === 0 && (
                        <p className="muted">Primero crea un huésped en la sección Huéspedes.</p>
                      )}
                      {huespedesFiltrados.map((h) => (
                        <button
                          className={`guest-choice ${huespedId === h.id ? "selected" : ""}`}
                          key={h.id}
                          onClick={() => setHuespedId(h.id)}
                        >
                          <span className="avatar">{inicialesDe(h.nombre)}</span>
                          <span>
                            <b>{h.nombre}</b>
                            <small>{h.email}</small>
                          </span>
                          {huespedId === h.id && <i>✓</i>}
                        </button>
                      ))}
                    </>
                  )}
                  {step === 2 && (
                    <div className="date-step">
                      <label>
                        Llegada
                        <input
                          type="date"
                          value={entrada}
                          min={hoy}
                          onChange={(event) => setEntrada(event.target.value)}
                        />
                      </label>
                      <span>{noches > 0 ? `${noches} ${noches === 1 ? "noche" : "noches"}` : "—"}</span>
                      <label>
                        Salida
                        <input
                          type="date"
                          value={salida}
                          min={entrada}
                          onChange={(event) => setSalida(event.target.value)}
                        />
                      </label>
                      {noches <= 0 && (
                        <div className="friendly-note">
                          <Icon name="sparkle" /> La salida debe ser después de la llegada.
                        </div>
                      )}
                    </div>
                  )}
                  {step === 3 && (
                    <div className="room-choices">
                      {disponibles.length === 0 && (
                        <p className="muted">No hay habitaciones disponibles.</p>
                      )}
                      {disponibles.map((h) => (
                        <button
                          className={habitacionId === h.id ? "selected" : ""}
                          key={h.id}
                          onClick={() => setHabitacionId(h.id)}
                        >
                          <span className="room-monogram">{tipoInfo[h.tipo]?.monogram ?? "H"}</span>
                          <span>
                            <b>
                              {tipoInfo[h.tipo]?.name ?? h.tipo} · {h.numero}
                            </b>
                            <small>{dinero(Number(h.precio_noche))} por noche</small>
                          </span>
                          {habitacionId === h.id && <i>✓</i>}
                        </button>
                      ))}
                      <div className="reservation-total">
                        <span>
                          Total · {noches} {noches === 1 ? "noche" : "noches"}
                        </span>
                        <strong>
                          {dinero(total)} <small>MXN</small>
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
                {errorForm && (
                  <div className="form-error" role="alert">
                    {errorForm}
                  </div>
                )}
                <div className="wizard-actions">
                  <button
                    className="secondary-button"
                    onClick={() => (step > 1 ? setStep(step - 1) : cerrarWizard())}
                  >
                    {step > 1 ? "Atrás" : "Cancelar"}
                  </button>
                  <button
                    className={step === 3 ? "gold-button" : "primary-button"}
                    onClick={advance}
                    disabled={!puedeContinuar || guardando}
                  >
                    {guardando ? "Guardando…" : step === 3 ? "Confirmar reserva" : "Continuar"}{" "}
                    <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {detalle && (
        <div className="drawer-backdrop" onClick={() => setDetalle(null)}>
          <aside
            className="room-drawer reservation-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="drawer-close" onClick={() => setDetalle(null)}>
              <Icon name="close" />
            </button>
            <span className="eyebrow">RESERVA RES-{detalle.id.slice(0, 6).toUpperCase()}</span>
            <h2>{nombreHuesped(detalle.huesped_id)}</h2>
            <span className={`reservation-status ${claseEstado(detalle)}`}>
              {etiquetaEstado(detalle)}
            </span>
            <div className="booking-facts">
              <span>
                <small>Llegada</small>
                <b>{fechaCorta(dia(detalle.fecha_entrada))}</b>
              </span>
              <span>
                <small>Salida</small>
                <b>{fechaCorta(dia(detalle.fecha_salida))}</b>
              </span>
              <span>
                <small>Habitación</small>
                <b>{etiquetaHab(detalle.habitacion_id)}</b>
              </span>
              <span>
                <small>Total</small>
                <b>{dinero(Number(detalle.total))}</b>
              </span>
            </div>
            <div className="drawer-section">
              <h3>Estado de la estancia</h3>
              <div className="stay-progress">
                <span className="done">Reserva {etiquetaEstado(detalle).replace(/_/g, " ").toLowerCase()}</span>
                <span className={["en_estancia", "finalizada"].includes(detalle.estado) ? "done" : ""}>Check-in</span>
                <span className={detalle.estado === "finalizada" ? "done" : ""}>Check-out</span>
              </div>
            </div>
            {errorDetalle && (
              <div className="form-error" role="alert">
                {errorDetalle}
              </div>
            )}
            {mensajeDetalle && <p className="muted">✓ {mensajeDetalle}</p>}
            {!cancelada(detalle) && detalle.estado !== "finalizada" && (
              <>
                <button
                  className="primary-button full"
                  onClick={() => registrar("entrada")}
                  disabled={accion !== "" || cancelando || detalle.estado !== "confirmada"}
                >
                  {accion === "entrada" ? "Registrando…" : "Hacer check-in"} <Icon name="arrow" />
                </button>
                <button
                  className="secondary-button full"
                  onClick={() => registrar("salida")}
                  disabled={accion !== "" || cancelando || detalle.estado !== "en_estancia"}
                >
                  {accion === "salida" ? "Registrando…" : "Hacer check-out"}
                </button>
                <button className="danger-button" onClick={cancelar} disabled={cancelando || accion !== "" || detalle.estado !== "confirmada"}>
                  {cancelando ? "Cancelando…" : "Cancelar reserva"}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

type ResumenApi = {
  cuenta: {
    id: string;
    reserva_id: string;
    huesped_id: string;
    total_estancia: string;
    moneda: string;
    estado: string;
  };
  consumos: {
    id: string;
    concepto: string;
    cantidad: number;
    precio_unitario: string;
    subtotal: string;
    creada_en: string;
  }[];
  pagos: { id: string; monto: string; metodo: string; referencia: string | null; creada_en: string }[];
  total_estancia: string;
  total_consumos: string;
  total: string;
  total_pagado: string;
  saldo: string;
  moneda: string;
};

// UUID v4 que funciona también en http:// sin HTTPS (crypto.randomUUID no existe ahí).
function uuidv4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const redondear = (n: number) => Math.round(n * 100) / 100;
const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Payments() {
  const [reservas, setReservas] = useState<ReservaApi[]>([]);
  const [huespedes, setHuespedes] = useState<HuespedApi[]>([]);
  const [habitaciones, setHabitaciones] = useState<HabitacionApi[]>([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [reservaId, setReservaId] = useState("");
  const [resumen, setResumen] = useState<ResumenApi | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState("");
  const [modal, setModal] = useState<"charge" | "payment" | null>(null);
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta" | "transferencia">("tarjeta");
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [claveRef, setClaveRef] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [checkedOut, setCheckedOut] = useState(false);
  const [ocupadoMP, setOcupadoMP] = useState(false);
  const [resultadoMP, setResultadoMP] = useState<{
    cuentaId: string; mensaje: string; enlace?: string;
  } | null>(null);


  useEffect(() => {
    let vigente = true;
    Promise.all([getReservas(), getHuespedes(), getHabitaciones()])
      .then(([r, h, hab]) => {
        if (!vigente) return;
        setReservas((r as ReservaApi[]).filter((x) => !/cancel/i.test(x.estado)));
        setHuespedes(h as HuespedApi[]);
        setHabitaciones(hab as HabitacionApi[]);
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      });
    return () => {
      vigente = false;
    };
  }, []);

  const nombreDe = (id: string) => huespedes.find((h) => h.id === id)?.nombre ?? "Huésped";
  const habDe = (id: string) => habitaciones.find((h) => h.id === id);
  const etiquetaHab = (id: string) => {
    const h = habDe(id);
    return h ? `${tipoInfo[h.tipo]?.name ?? h.tipo} ${h.numero}` : "Habitación";
  };

  const verCuenta = async () => {
    if (!reservaId) return;
    setErrorCuenta("");
    setCargando(true);
    setCheckedOut(false);
    try {
      const cuenta = (await abrirCuenta({ reserva_id: reservaId })) as { id: string };
      setResumen((await getResumenCuenta(cuenta.id)) as ResumenApi);
    } catch (err) {
      setResumen(null);
      setErrorCuenta(err instanceof Error ? err.message : "No se pudo abrir la cuenta.");
    } finally {
      setCargando(false);
    }
  };

  const recargar = async () => {
    if (!resumen) return;
    setResumen((await getResumenCuenta(resumen.cuenta.id)) as ResumenApi);
  };

  const abrirModal = (tipo: "charge" | "payment") => {
    setErrorModal("");
    setConcepto("");
    setCantidad("1");
    setPrecio("");
    setReferencia("");
    setMetodo("tarjeta");
    setMonto(resumen ? resumen.saldo : "");
    setClaveRef(uuidv4());
    setModal(tipo);
  };

  const guardarMovimiento = async () => {
    if (!resumen) return;
    setErrorModal("");
    setGuardando(true);
    try {
      if (modal === "charge") {
        await agregarConsumo(resumen.cuenta.id, {
          concepto: concepto.trim(),
          cantidad: Number(cantidad),
          precio_unitario: redondear(Number(precio)),
        });
      } else {
        await registrarPago(resumen.cuenta.id, {
          clave_idempotencia: claveRef,
          monto: redondear(Number(monto)),
          metodo,
          referencia: referencia.trim() || undefined,
        });
      }
      setModal(null);
      await recargar();
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };


  const gestionarMercadoPago = async (consultar: boolean) => {
    if (!resumen || ocupadoMP) return;
    const cuentaId = resumen.cuenta.id;
    setOcupadoMP(true);
    setResultadoMP(null);
    try {
      if (consultar) {
        const r = await consultarPagoMercadoPago(cuentaId);
        setResultadoMP({
          cuentaId,
          mensaje: r.mensaje ?? (r.estado === "sin_intento"
            ? "Esta cuenta todavía no tiene un intento de pago."
            : r.estado),
          enlace: r.estado === "pendiente" ? r.enlace : undefined,
        });
      } else {
        const r = await generarPagoMercadoPago(cuentaId);
        setResultadoMP({
          cuentaId,
          mensaje: "Enlace de prueba generado. Ábrelo para continuar.",
          enlace: r.enlace,
        });
      }
      await recargar();
    } catch (e) {
      setResultadoMP({
        cuentaId,
        mensaje: e instanceof Error ? e.message : "No se pudo consultar Mercado Pago.",
      });
    } finally {
      setOcupadoMP(false);
    }
  };

  const cerrar = async () => {
    if (!resumen) return;
    setErrorCuenta("");
    try {
      await cerrarCuenta(resumen.cuenta.id);
      await recargar();
    } catch (err) {
      setErrorCuenta(err instanceof Error ? err.message : "No se pudo cerrar la cuenta.");
    }
  };

  const hacerCheckOut = async () => {
    if (!resumen) return;
    setErrorCuenta("");
    try {
      await checkOut(resumen.cuenta.reserva_id);
      setCheckedOut(true);
      await recargar();
    } catch (err) {
      setErrorCuenta(err instanceof Error ? err.message : "No se pudo hacer el check-out.");
    }
  };

  const reserva = resumen ? reservas.find((r) => r.id === resumen.cuenta.reserva_id) : undefined;
  const cerrada = resumen?.cuenta.estado === "cerrada";
  const saldoCero = resumen?.saldo === "0.00";
  const totalNum = resumen ? Number(resumen.total) : 0;
  const pagadoNum = resumen ? Number(resumen.total_pagado) : 0;
  const avance = totalNum > 0 ? Math.min((pagadoNum / totalNum) * 100, 100) : 0;
  const noches = reserva ? diasEntre(dia(reserva.fecha_entrada), dia(reserva.fecha_salida)) : 0;

  return (
    <>
      <SectionHeading
        eyebrow={
          resumen && reserva
            ? `CUENTA ${cerrada ? "CERRADA" : "ACTIVA"} · ${etiquetaHab(reserva.habitacion_id).toUpperCase()}`
            : "COBROS"
        }
        title={resumen ? `Cuenta de ${nombreDe(resumen.cuenta.huesped_id)}` : "Cuentas y pagos"}
        description={
          reserva
            ? `Estancia del ${fechaCorta(dia(reserva.fecha_entrada))} al ${fechaCorta(dia(reserva.fecha_salida))} · ${noches} ${noches === 1 ? "noche" : "noches"}`
            : "Elige una reserva para ver o abrir su cuenta."
        }
        action={
          resumen ? (
            <span className="account-number">CTA-{resumen.cuenta.id.slice(0, 6).toUpperCase()}</span>
          ) : undefined
        }
      />
      <section className="module-card" style={{ marginBottom: 16, padding: 16 }}>
        <label>
          Reserva
          <select value={reservaId} onChange={(event) => setReservaId(event.target.value)}>
            <option value="">Selecciona una reserva…</option>
            {reservas.map((r) => (
              <option key={r.id} value={r.id}>
                {nombreDe(r.huesped_id)} · {etiquetaHab(r.habitacion_id)} · {fechaCorta(dia(r.fecha_entrada))} –{" "}
                {fechaCorta(dia(r.fecha_salida))}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" onClick={verCuenta} disabled={!reservaId || cargando}>
          {cargando ? "Abriendo…" : "Ver cuenta"}
        </button>
        {errorCarga && <p className="form-error">No se pudieron cargar las reservas: {errorCarga}</p>}
        {errorCuenta && (
          <p className="form-error" role="alert">
            {errorCuenta}
          </p>
        )}
      </section>
      {resumen && (
        <FacturacionCuenta
          key={resumen.cuenta.id}
          cuentaId={resumen.cuenta.id}
          cerrada={Boolean(cerrada)}
        />
      )}
      {resumen && (
        <section className="account-layout">
          <article className="module-card movements">
            <div className="card-heading">
              <div>
                <span className="eyebrow">MOVIMIENTOS</span>
                <h2>Detalle de la cuenta</h2>
              </div>
              <div className="movement-actions">
                <button onClick={() => abrirModal("charge")} disabled={cerrada}>
                  <Icon name="plus" /> Agregar consumo
                </button>
                <button onClick={() => abrirModal("payment")} disabled={cerrada || saldoCero}>
                  <Icon name="card" /> Registrar pago
                </button>
                <button
                  onClick={() => gestionarMercadoPago(false)}
                  disabled={cerrada || saldoCero || ocupadoMP}
                >
                  Generar enlace de prueba
                </button>
                <button
                  onClick={() => gestionarMercadoPago(true)}
                  disabled={ocupadoMP}
                >
                  {ocupadoMP ? "Consultando…" : "Consultar pago"}
                </button>

              </div>
            </div>

            {resultadoMP?.cuentaId === resumen.cuenta.id && (
              <div style={{ padding: 16 }} aria-live="polite">
                <p>{resultadoMP.mensaje}</p>
                {resultadoMP.enlace && (
                  <a href={resultadoMP.enlace} target="_blank" rel="noopener noreferrer">
                    Abrir Mercado Pago de prueba
                  </a>
                )}
              </div>
            )}
            <div className="movement-timeline">
              <div className="charge">
                <i>·</i>
                <span>
                  <b>Hospedaje{reserva ? ` · ${etiquetaHab(reserva.habitacion_id)}` : ""}</b>
                  <small>
                    {noches} {noches === 1 ? "noche" : "noches"}
                  </small>
                </span>
                <strong>{dinero(Number(resumen.total_estancia))}</strong>
              </div>
              {resumen.consumos.map((c) => (
                <div className="charge" key={c.id}>
                  <i>·</i>
                  <span>
                    <b>{c.concepto}</b>
                    <small>
                      {c.cantidad} × {dinero(Number(c.precio_unitario))} · {hora(c.creada_en)}
                    </small>
                  </span>
                  <strong>{dinero(Number(c.subtotal))}</strong>
                </div>
              ))}
              {resumen.pagos.map((p) => (
                <div className="payment" key={p.id}>
                  <i>✓</i>
                  <span>
                    <b>Pago · {p.metodo}</b>
                    <small>
                      {p.referencia ? `${p.referencia} · ` : ""}
                      {hora(p.creada_en)}
                    </small>
                  </span>
                  <strong>−{dinero(Number(p.monto))}</strong>
                </div>
              ))}
            </div>
          </article>
          <aside className="module-card account-summary">
            <span className="eyebrow">RESUMEN</span>
            <h2>Saldo pendiente</h2>
            <strong className={saldoCero ? "settled" : ""}>{dinero(Number(resumen.saldo))}</strong>
            <small>{resumen.moneda}</small>
            <div className="payment-progress">
              <i style={{ width: `${avance}%` }} />
            </div>
            <p>{Math.round(avance)}% pagado</p>
            <dl>
              <div>
                <dt>Cargos</dt>
                <dd>{dinero(totalNum)}</dd>
              </div>
              <div>
                <dt>Pagos</dt>
                <dd>−{dinero(pagadoNum)}</dd>
              </div>
            </dl>
            {checkedOut ? (
              <div className="closed-account checkout-success">
                <span>✓</span>
                <b>Check-out completado</b>
                <small>La habitación pasó a limpieza.</small>
              </div>
            ) : cerrada ? (
              <div className="closed-account">
                <span>✓</span>
                <b>Cuenta cerrada</b>
              </div>
            ) : (
              <button
                className="primary-button full"
                disabled={!saldoCero}
                title={!saldoCero ? "Liquida el saldo para cerrar la cuenta" : ""}
                onClick={cerrar}
              >
                Cerrar cuenta
              </button>
            )}
            <button
              className="checkout-button"
              disabled={!saldoCero || checkedOut}
              onClick={hacerCheckOut}
            >
              Hacer check-out
            </button>
          </aside>
        </section>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section className="small-modal" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setModal(null)}>
              <Icon name="close" />
            </button>
            <span className="eyebrow">{modal === "charge" ? "NUEVO MOVIMIENTO" : "PAGO"}</span>
            <h2>{modal === "charge" ? "Agregar consumo" : "Registrar pago"}</h2>
            {modal === "charge" ? (
              <>
                <label>
                  Concepto
                  <input
                    value={concepto}
                    onChange={(event) => setConcepto(event.target.value)}
                    placeholder="Desayuno, spa, lavandería…"
                  />
                </label>
                <label>
                  Cantidad
                  <input
                    type="number"
                    min={1}
                    value={cantidad}
                    onChange={(event) => setCantidad(event.target.value)}
                  />
                </label>
                <label>
                  Precio unitario
                  <span className="money-input">
                    ${" "}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={precio}
                      onChange={(event) => setPrecio(event.target.value)}
                    />{" "}
                    MXN
                  </span>
                </label>
              </>
            ) : (
              <>
                <label>
                  Método
                  <select
                    value={metodo}
                    onChange={(event) => setMetodo(event.target.value as typeof metodo)}
                  >
                    <option value="tarjeta">Tarjeta</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>
                <label>
                  Importe
                  <span className="money-input">
                    ${" "}
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={monto}
                      onChange={(event) => setMonto(event.target.value)}
                    />{" "}
                    MXN
                  </span>
                </label>
                <label>
                  Referencia (opcional)
                  <input
                    value={referencia}
                    onChange={(event) => setReferencia(event.target.value)}
                    placeholder="Folio o últimos dígitos"
                  />
                </label>
              </>
            )}
            {errorModal && (
              <div className="form-error" role="alert">
                {errorModal}
              </div>
            )}
            <button className="primary-button full" onClick={guardarMovimiento} disabled={guardando}>
              {guardando ? "Guardando…" : modal === "charge" ? "Agregar a la cuenta" : "Registrar pago"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

const rolEtiqueta: Record<string, string> = {
  administrador: "Administrador",
  recepcionista: "Recepcionista",
  limpieza: "Limpieza",
};

function perfilActual() {
  const u = getUsuario();
  const nombre = u?.nombre ?? "Usuario";
  return {
    nombre,
    primer: nombre.split(" ")[0],
    iniciales: inicialesDe(nombre) || "U",
    rol: rolEtiqueta[u?.rol ?? ""] ?? "",
  };
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

type UsuarioApi = {
  id: string;
  nombre: string;
  email: string;
  rol: "administrador" | "recepcionista" | "limpieza";
  activo: boolean;
  creada_en?: string;
};

function Users() {
  const [usuarios, setUsuarios] = useState<UsuarioApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UsuarioApi["rol"]>("recepcionista");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    getUsuarios()
      .then((datos) => {
        if (vigente) {
          setUsuarios(datos as UsuarioApi[]);
          setErrorCarga("");
        }
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof Error ? err.message : "No se pudieron cargar.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  const cerrar = () => {
    setCreating(false);
    setErrorForm("");
  };

  const crear = async () => {
    setErrorForm("");
    if (password.length < 12) {
      setErrorForm("La contraseña debe tener al menos 12 caracteres.");
      return;
    }
    setGuardando(true);
    try {
      await crearUsuario({
        nombre: `${nombre} ${apellidos}`.trim(),
        email: email.trim(),
        password,
        rol,
      });
      setNombre("");
      setApellidos("");
      setEmail("");
      setPassword("");
      setRol("recepcionista");
      setCreating(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <SectionHeading
        eyebrow="ADMINISTRACIÓN"
        title="Usuarios"
        description="Gestiona al equipo y el acceso a cada espacio."
        action={
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Icon name="plus" /> Nuevo usuario
          </button>
        }
      />
      <section className="module-card staff-table">
        <div className="table-head">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Alta</span>
          <span>Estado</span>
        </div>
        {cargando && <p className="muted">Cargando usuarios…</p>}
        {errorCarga && (
          <p className="form-error">No se pudieron cargar los usuarios: {errorCarga}</p>
        )}
        {usuarios.map((u) => (
          <div className="table-row" key={u.id}>
            <span className="person-cell">
              <i className="avatar">{inicialesDe(u.nombre)}</i>
              <span>
                <b>{u.nombre}</b>
                <small>{u.email}</small>
              </span>
            </span>
            <span className={`role-badge ${u.rol}`}>{rolEtiqueta[u.rol] ?? u.rol}</span>
            <span>
              {u.creada_en
                ? new Date(u.creada_en).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
            <span>{u.activo ? "Activo" : "Inactivo"}</span>
          </div>
        ))}
      </section>
      {creating && (
        <div className="drawer-backdrop" onClick={cerrar}>
          <aside className="room-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={cerrar}>
              <Icon name="close" />
            </button>
            <span className="eyebrow">NUEVO ACCESO</span>
            <h2>Agregar usuario</h2>
            <div className="two-col-form user-form">
              <label>
                Nombre
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Nombre"
                />
              </label>
              <label>
                Apellidos
                <input
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  placeholder="Apellidos"
                />
              </label>
              <label className="span-two">
                Correo
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@hotel.mx"
                />
              </label>
              <label className="span-two">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 12 caracteres"
                />
              </label>
            </div>
            <h3 className="role-title">Selecciona un rol</h3>
            <div className="role-options">
              <button
                className={rol === "administrador" ? "selected" : ""}
                onClick={() => setRol("administrador")}
              >
                <Icon name="grid" />
                <span>
                  <b>Administrador</b>
                  <small>Acceso completo y gestión del equipo.</small>
                </span>
              </button>
              <button
                className={rol === "recepcionista" ? "selected" : ""}
                onClick={() => setRol("recepcionista")}
              >
                <Icon name="calendar" />
                <span>
                  <b>Recepcionista</b>
                  <small>Reservas, huéspedes, habitaciones y cobros.</small>
                </span>
              </button>
              <button
                className={rol === "limpieza" ? "selected" : ""}
                onClick={() => setRol("limpieza")}
              >
                <Icon name="bed" />
                <span>
                  <b>Limpieza</b>
                  <small>Solo estado y detalle de habitaciones.</small>
                </span>
              </button>
            </div>
            {errorForm && (
              <div className="form-error" role="alert">
                {errorForm}
              </div>
            )}
            <button className="primary-button full" onClick={crear} disabled={guardando}>
              {guardando ? "Creando…" : "Crear usuario"}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

// El backend puede devolver un texto o un objeto; se toma el primer campo de texto conocido.
function textoDeRespuesta(r: unknown): string {
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    for (const k of ["respuesta", "texto", "mensaje", "answer"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return JSON.stringify(r);
}

function Assistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: `${saludo()}, ${perfilActual().primer}. ¿En qué puedo ayudarte?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const send = async (text = input) => {
    if (!text.trim()) return;
    setMessages([...messages, { role: "user", text }]);
    setInput("");
    setTyping(true);
    try {
      const r = await preguntarAsistente({ pregunta: text });
      setMessages((current) => [...current, { role: "assistant", text: textoDeRespuesta(r) }]);
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "error desconocido";
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `No pude consultar el asistente: ${motivo}` },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <section className="assistant-layout">
      <aside className="knowledge-panel">
        <span className="eyebrow">CONOCIMIENTO</span>
        <h1>Asistente IA</h1>
        <p>Respuestas basadas en la operación y políticas de Casa Áurea.</p>
        <label className="wide-search">
          <Icon name="search" />
          <input placeholder="Buscar en conocimientos" />
        </label>
        <h3>Explorar</h3>
        {[
          "Políticas de cancelación",
          "Horarios y servicios",
          "Tipos de habitación",
          "Protocolos de estancia",
        ].map((item, index) => (
          <button className="knowledge-item" key={item}>
            <span>
              <Icon name={index === 2 ? "bed" : "sparkle"} />
            </span>
            <b>{item}</b>
            <Icon name="chevron" size={15} />
          </button>
        ))}
        <div className="ai-privacy">
          <Icon name="sparkle" />
          <p>
            <b>Información protegida</b>
            <span>Las respuestas respetan los permisos de tu rol.</span>
          </p>
        </div>
      </aside>
      <article className="chat-panel">
        <header>
          <span className="ai-icon">
            <Icon name="sparkle" />
          </span>
          <div>
            <h2>HospedaSmart AI</h2>
            <span>
              <i /> Disponible ahora
            </span>
          </div>
        </header>
        <div className="chat-messages">
          <div className="chat-date">HOY · 10:24</div>
          {messages.map((message, index) => (
            <div className={`message ${message.role}`} key={index}>
              {message.role === "assistant" && (
                <span className="message-avatar">
                  <Icon name="sparkle" size={16} />
                </span>
              )}
              <div>
                <p>{message.text}</p>
                {message.role === "assistant" && index > 0 && (
                  <div className="sources">
                    <span>Fuentes consultadas</span>
                    <button>Disponibilidad en tiempo real</button>
                    <button>Tarifario 2025</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="message assistant">
              <span className="message-avatar">
                <Icon name="sparkle" size={16} />
              </span>
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
        {messages.length === 1 && (
          <div className="prompt-chips">
            {[
              "¿Qué habitaciones están disponibles?",
              "Resume las llegadas de hoy",
              "Política de cancelación",
            ].map((prompt) => (
              <button key={prompt} onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        )}
        <form
          className="chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Pregunta sobre reservas, huéspedes o políticas..."
          />
          <button aria-label="Enviar">
            <Icon name="arrow" />
          </button>
        </form>
      </article>
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  if (screen === "login") return <Login onLogin={() => setScreen("dashboard")} />;
  const content: Record<Exclude<Screen, "login">, ReactNode> = {
    dashboard: (
      <Dashboard
        goRooms={() => setScreen("rooms")}
        newReservation={() => setScreen("reservations")}
        goReservations={() => setScreen("reservations")}
        goAssistant={() => setScreen("assistant")}
      />
    ),
    reservations: <Reservations onCheckIn={() => setScreen("payments")} />,
    guests: <Guests />,
    rooms: <Rooms />,
    payments: <Payments />,
    users: <Users />,
    assistant: <Assistant />,
  };
  return (
    <Shell screen={screen} setScreen={setScreen}>
      {content[screen]}
    </Shell>
  );
}
