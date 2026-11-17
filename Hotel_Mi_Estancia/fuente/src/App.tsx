import QRCode from "qrcode";
import { useEffect, useMemo, useState, useRef } from "react";

declare global { interface Window { HS_CONFIG?: { hotel?: string; turnstileSiteKey?: string }; turnstile?: any } }
type RoomOption = { tipo: string; nombre: string; capacidad: number; precio_noche: number; total: number };
async function api(path: string, body?: unknown, extra: {method?:string;csrf?:string} = {}) {
  let response: Response;
  try { response = await fetch(`/api/publico/${path}`, { method:extra.method ?? (body ? "POST":"GET"), credentials:"same-origin", headers:{...(body ? {"Content-Type":"application/json"}:{}), ...(extra.csrf ? {"X-CSRF-Token":extra.csrf}:{})}, body:body ? JSON.stringify(body):undefined, signal:AbortSignal.timeout(120000) }); }
  catch { throw new Error("No pudimos conectar. Revisa tu conexión antes de intentar de nuevo."); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.error || "No pudimos completar la solicitud."), {status:response.status});
  return data;
}
function Captcha({onToken}: {onToken:(token:string)=>void}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.HS_CONFIG?.turnstileSiteKey) return;
    let dead=false, widget:any, timer:ReturnType<typeof setTimeout>;
    onToken("");
    if (!document.querySelector('script[data-turnstile]')) {
      const script=document.createElement("script"); script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.dataset.turnstile="true"; script.async=true; document.head.append(script);
    }
    const mount=()=>{if(dead)return;if(!window.turnstile){timer=setTimeout(mount,250);return;}
      widget=window.turnstile.render(ref.current,{sitekey:window.HS_CONFIG?.turnstileSiteKey,callback:(t:string)=>onToken(t),"expired-callback":()=>onToken(""),"error-callback":()=>onToken("")});};mount();
    return ()=>{dead=true;clearTimeout(timer);if(widget!==undefined)window.turnstile?.remove(widget);onToken("");};
  },[onToken]);
  return <div ref={ref} aria-label="Verificación de seguridad"/>;
}
type Page = "inicio" | "habitaciones" | "estancia" | "ayuda" | "ubicacion";
type BookingStep = 1 | 2 | 3 | 4 | 5 | 6;

const HERO =
  "https://images.unsplash.com/photo-1739520081275-f893dc11fbd6?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1800";
const ROOM =
  "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1400";
const ROOM_ALT =
  "https://images.unsplash.com/photo-1731336478850-6bce7235e320?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000";
const CATEGORIAS = [
 {tipo:"individual",nombre:"Sencilla",capacidad:1,precio:500,descripcion:"Una opción para viajar por tu cuenta."},
 {tipo:"doble",nombre:"Doble",capacidad:2,precio:800,descripcion:"Espacio para una estancia de una o dos personas."},
 {tipo:"suite",nombre:"Suite",capacidad:4,precio:1400,descripcion:"Una opción para grupos de hasta cuatro personas."},
];

const nav: { id: Page; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "habitaciones", label: "Habitaciones" },
  { id: "estancia", label: "Mi estancia" },
  { id: "ayuda", label: "Ayuda" },
  { id: "ubicacion", label: "Ubicación" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    bed: (
      <>
        <path d="M2 4v16M22 20V9a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v11M2 14h20M6 7h2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </>
    ),
    chevron: (
      <>
        <path d="m9 18 6-6-6-6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    phone: (
      <>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000,
    ),
  );
}

function App() {
  const [page, setPage] = useState<Page>("inicio");
  const [menu, setMenu] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [step, setStep] = useState<BookingStep>(1);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyState, setVerifyState] = useState<
    "idle" | "sent" | "wrong" | "expired" | "verified"
  >("idle");
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [gallery, setGallery] = useState(0);
  
  
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const nights = useMemo(() => daysBetween(arrival, departure), [arrival, departure]);
  const [options, setOptions] = useState<RoomOption[]>([]);
  const [option, setOption] = useState<RoomOption | null>(null);
  const [receipt, setReceipt] = useState<any>(null);
  const [challenge, setChallenge] = useState("");
  const [proof, setProof] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [proofUntil, setProofUntil] = useState(0);
  const total = Number(option?.total ?? 0);
  const resendSeconds = Math.max(0, Math.ceil((resendAt-now)/1000));
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(t)},[]);
  useEffect(()=>{setOption(null);setOptions([])},[arrival,departure,guests]);
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  useEffect(() => {
    setVerifyState("idle"); setChallenge(""); setProof(""); setCode("");
  }, [name, phone, email]);

  const go = (target: Page) => {
    setPage(target);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openBooking = () => {
    if(busyRef.current)return;
    setBookingOpen(true); setStep(1); setFormError(""); setReceipt(null); setOption(null);
    setVerifyState("idle"); setChallenge(""); setProof(""); setCode("");
  };
  const execute = async (work:()=>Promise<void>) => {
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setFormError("");
    try {await work()} catch(e){setFormError((e as Error).message)} finally{busyRef.current=false;setBusy(false)}
  };
  const validateDates = () => {
    setBookingOpen(true); setStep(1);
    if (!arrival || !departure || arrival<today || nights<1) {setFormError("Elige llegada desde hoy y salida posterior.");return;}
    void execute(async()=>{
      const q=new URLSearchParams({fecha_entrada:arrival,fecha_salida:departure,personas:guests});
      const r=await api(`disponibilidad?${q}`);
      const available=(r.opciones??[]).filter((o:RoomOption)=>CATEGORIAS.some(c=>c.tipo===o.tipo)).sort((a:RoomOption,b:RoomOption)=>Number(a.precio_noche)-Number(b.precio_noche));
      if(!available.length)throw new Error("No hay habitaciones disponibles para esas fechas y personas. Prueba otras fechas.");
      setOptions(available);setOption(available[0]);setReceipt(null);setStep(2);
    });
  };
  const identity=()=>({nombre:name.trim().replace(/\s+/g," "),email:email.trim().toLowerCase(),telefono:phone.trim()});
  const validateIdentity = () => {
    if(!option){setStep(1);setFormError("Consulta disponibilidad de nuevo.");return;}
    if (!name.trim() || !phone.trim() || !/^\S+@\S+\.\S+$/.test(email)) {setFormError("Completa nombre, teléfono y un correo válido.");return;}
    if(window.HS_CONFIG?.turnstileSiteKey && !captcha){setFormError("Completa la verificación de seguridad.");return;}
    void execute(async()=>{
      const r=await api("correo/solicitar",{...identity(),turnstile:captcha,sitio_web:""});
      setChallenge(r.verificacion_id);setProof("");setCode("");setVerifyState("sent");setResendAt(Date.now()+r.reenviar_en*1000);setStep(3);
    });
  };
  const resend = () => {
    if(resendSeconds || busy)return;
    if(window.HS_CONFIG?.turnstileSiteKey){setStep(2);setFormError("Completa la verificación de seguridad para reenviar el código.");return;}
    validateIdentity();
  };
  const verify = () => void execute(async()=>{
    const r=await api("correo/confirmar",{...identity(),verificacion_id:challenge,codigo:code});
    setProof(r.verificacion_token);setProofUntil(Date.now()+r.vence_en*1000);setVerifyState("verified");setStep(5);
  });
  const confirm = () => {
    if(!proof || verifyState!=="verified" || Date.now()>=proofUntil){setProof("");setVerifyState("idle");setStep(2);setFormError("Verifica tu correo nuevamente.");return;}
    if(!option){setStep(1);setFormError("Consulta la disponibilidad otra vez.");return;}
    if(window.HS_CONFIG?.turnstileSiteKey && !captcha){setFormError("Completa la verificación de seguridad.");return;}
    void execute(async()=>{
      const r=await api("reservas",{...identity(),tipo:option.tipo,fecha_entrada:arrival,fecha_salida:departure,personas:Number(guests),verificacion_token:proof,turnstile:captcha,sitio_web:""});
      setReceipt(r);setProof("");setStep(6);
    });
  };

  const showPage = () => {
    if (page === "habitaciones")
      return <Rooms onBook={openBooking} gallery={gallery} setGallery={setGallery} />;
    if (page === "estancia")
      return (
        <StayArea />
      );
    if (page === "ayuda") return <Help open={faqOpen} setOpen={setFaqOpen} />;
    if (page === "ubicacion") return <Location />;
    return (
      <Home
        busy={busy}
        arrival={arrival}
        departure={departure}
        guests={guests}
        setArrival={setArrival}
        setDeparture={setDeparture}
        setGuests={setGuests}
        onSearch={validateDates}
        onBook={openBooking}
        go={go}
        today={today}
      />
    );
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="site-header">
        <button className="brand" onClick={() => go("inicio")} aria-label="Ir al inicio">
          <span className="brand-mark" aria-hidden="true">
            H5L
          </span>
          <span>
            <b>HOTEL 5 LETRAS</b>
            <small>HOSPITALIDAD LOCAL</small>
          </span>
        </button>
        <nav className={menu ? "nav open" : "nav"} aria-label="Navegación principal">
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button className="primary header-cta" onClick={openBooking}>
          Reservar
        </button>
        <button
          className="menu-button"
          aria-label={menu ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Icon name={menu ? "close" : "menu"} />
        </button>
      </header>
      <main id="contenido"><p className="inventory-note">Inventario de demostración · tarifas y habitaciones de prueba</p>{showPage()}</main>
      <Footer go={go} />
      {bookingOpen && (
        <Booking
          step={step}
          setStep={setStep}
          close={() => { if(!busyRef.current)setBookingOpen(false); }}
          busy={busy} option={option} options={options} setOption={setOption} receipt={receipt} confirm={confirm} resend={resend} resendSeconds={resendSeconds} setCaptcha={setCaptcha}
          arrival={arrival}
          departure={departure}
          guests={guests}
          nights={nights}
          total={total}
          setArrival={setArrival}
          setDeparture={setDeparture}
          setGuests={setGuests}
          name={name}
          phone={phone}
          email={email}
          setName={setName}
          setPhone={setPhone}
          setEmail={setEmail}
          code={code}
          setCode={setCode}
          verifyState={verifyState}
          setVerifyState={setVerifyState}
          formError={formError}
          setFormError={setFormError}
          validateDates={validateDates}
          validateIdentity={validateIdentity}
          verify={verify}
          copied={copied}
          setCopied={setCopied}
          today={today}
        />
      )}
    </div>
  );
}

function Home({
  busy,
  arrival,
  departure,
  guests,
  setArrival,
  setDeparture,
  setGuests,
  onSearch,
  onBook,
  go,
  today,
}: any) {
  return (
    <>
      <section className="hero">
        <img src={HERO} alt="Imagen reemplazable: patio de referencia para el hotel" />
        <div className="hero-overlay" />
        <div className="hero-copy">
          <p className="eyebrow light">UNA PAUSA EN EL CAMINO</p>
          <h1>
            Descansa como
            <br />
            si estuvieras en casa.
          </h1>
          <p>
            Una estancia sencilla, cálida y personal. Estamos preparando cada detalle para
            recibirte.
          </p>
        </div>
        <p className="replaceable-label">Fotografía de referencia · Reemplazar por imagen real</p>
      </section>
      <section className="search-wrap" aria-label="Buscar disponibilidad">
        <div className="search-card">
          <label>
            Llegada
            <input
              disabled={busy}
              type="date"
              min={today}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </label>
          <label>
            Salida
            <input
              disabled={busy}
              type="date"
              min={arrival || today}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </label>
          <label>
            Personas
            <select disabled={busy} value={guests} onChange={(e) => setGuests(e.target.value)}>
              <option value="1">1 huésped</option>
              <option value="2">2 huéspedes</option>
              <option value="3">3 huéspedes</option>
              <option value="4">4 huéspedes</option>
            </select>
          </label>
          <button className="primary" onClick={onSearch}>
            Ver disponibilidad <Icon name="arrow" />
          </button>
        </div>
        <p className="integration-note">
          Consulta disponibilidad y precio para tus fechas antes de continuar.
        </p>
      </section>
      <section className="intro section">
        <div>
          <p className="eyebrow">HOTEL 5 LETRAS</p>
          <h2>
            Lo esencial,
            <br />
            <em>bien cuidado.</em>
          </h2>
        </div>
        <div className="intro-copy">
          <p>
            Un espacio de descanso con una propuesta honesta y acogedora. La información definitiva
            sobre horarios, servicios y políticas se publicará cuando sea confirmada por el hotel.
          </p>
          <button className="text-link" onClick={() => go("ubicacion")}>
            Conocer la ubicación <Icon name="arrow" />
          </button>
        </div>
      </section>
      <section className="room-feature section">
        <div className="room-image">
          <img src={ROOM} alt="Imagen reemplazable: habitación doble de referencia" />
          <span>Imagen de referencia</span>
        </div>
        <div className="room-copy">
          <p className="eyebrow">CATEGORÍA CONFIRMADA</p>
          <h2>Una habitación para cada estancia</h2>
          <div className="feature-line">
            <span>
              <Icon name="users" /> Hasta 4 personas
            </span>
            <span>
              <Icon name="bed" /> 3 categorías de prueba
            </span>
          </div>
          <p>
            Sencilla, Doble y Suite. Inventario de demostración; los servicios están pendientes de confirmar.
          </p>
          <div className="price">
            <span>Desde</span>
            <strong>Desde $500</strong>
            <span>MXN / noche</span>
          </div>
          <button className="secondary" onClick={onBook}>
            Ver fechas y reservar <Icon name="arrow" />
          </button>
        </div>
      </section>
      <section className="stay-promo">
        <div>
          <p className="eyebrow light">TU VIAJE, EN UN SOLO LUGAR</p>
          <h2>¿Ya tienes una reserva?</h2>
          <p>Consulta tu reserva con el código del comprobante y el correo que utilizaste.</p>
        </div>
        <button className="cream-button" onClick={() => go("estancia")}>
          Ir a Mi estancia <Icon name="arrow" />
        </button>
      </section>
      <ContactStrip />
    </>
  );
}

function Rooms({onBook}:any) {
 return <div className="page"><section className="page-heading"><p className="eyebrow">ELIGE TU ESTANCIA</p><h1>Nuestras habitaciones</h1><p>Inventario de demostración. Consulta disponibilidad y precio final para tus fechas.</p></section>
 <section className="section category-grid">{CATEGORIAS.map(c=><article className="category-card" key={c.tipo}>
 <div className="category-visual"><Icon name="bed" size={48}/><span>Fotografía pendiente</span></div>
 <div className="category-content"><p className="eyebrow">{c.capacidad===1?"VIAJE INDIVIDUAL":c.capacidad===2?"PARA COMPARTIR":"EN GRUPO"}</p><h2>{c.nombre}</h2><p><Icon name="users"/> Hasta {c.capacidad} {c.capacidad===1?"persona":"personas"}</p><p>{c.descripcion}</p><p className="pending-box">Camas, fotografías y servicios por confirmar.</p><div className="price"><span>Tarifa de prueba por noche</span><strong>${c.precio.toLocaleString("es-MX")}</strong><span>MXN</span></div><button className="primary wide" onClick={onBook}>Consultar fechas</button></div></article>)}</section>
 <section className="notice section"><b>Antes de reservar</b><p>Las opciones disponibles y el total se consultan en el sistema. El precio indicado es por noche; una reserva no implica pago.</p></section></div>;
}


function EncuestaReserva({ token }: { token?: string }) {
  const [valores, setValores] = useState({
    facilidad: "", claridad: "", satisfaccion: "", comentario: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState("");
  const bloqueo = useRef(false);

  if (!token) return null;
  if (enviada) return (
    <section className="info-callout" role="status">
      <b>¡Gracias por compartir tu opinión!</b>
      <p>Tu respuesta quedó registrada.</p>
    </section>
  );

  const enviar = async () => {
    if (bloqueo.current) return;
    const notas = {
      facilidad: Number(valores.facilidad),
      claridad: Number(valores.claridad),
      satisfaccion: Number(valores.satisfaccion),
    };
    if (Object.values(notas).some((n) => !Number.isInteger(n) || n < 1 || n > 5)) {
      setError("Selecciona una calificación para cada pregunta.");
      return;
    }
    bloqueo.current = true;
    setEnviando(true);
    setError("");
    try {
      await api("encuestas/reserva", {
        token, ...notas, comentario: valores.comentario.trim(),
      });
      setEnviada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la encuesta.");
    } finally {
      bloqueo.current = false;
      setEnviando(false);
    }
  };

  return (
    <section className="info-callout" aria-labelledby="encuesta-titulo">
      <h3 id="encuesta-titulo">¿Cómo fue tu experiencia al reservar?</h3>
      <p>Encuesta opcional. 1 es la calificación más baja y 5 la más alta.</p>
      <fieldset disabled={enviando}>
        <legend>Tu experiencia con la reserva</legend>
        {([
          ["facilidad", "¿Qué tan fácil fue reservar?"],
          ["claridad", "¿Qué tan clara fue la información?"],
          ["satisfaccion", "¿Qué tan satisfecho quedaste con el proceso?"],
        ] as const).map(([campo, pregunta]) => (
          <p key={campo}>
            <label htmlFor={`encuesta-${campo}`}>{pregunta}</label>
            <select
              id={`encuesta-${campo}`}
              value={valores[campo]}
              onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
            >
              <option value="">Selecciona</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </p>
        ))}
        <p>
          <label htmlFor="encuesta-comentario">Comentarios (opcional)</label>
          <textarea
            id="encuesta-comentario"
            maxLength={1000}
            rows={3}
            value={valores.comentario}
            onChange={(e) => setValores((v) => ({ ...v, comentario: e.target.value }))}
          />
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="primary" type="button" onClick={enviar}>
          {enviando ? "Enviando…" : "Enviar opinión"}
        </button>
      </fieldset>
      <p>Puedes cerrar el comprobante sin responder. Tu reserva ya está registrada.</p>
    </section>
  );
}

function Booking(props: any) {
  const {
    busy, option, options, setOption, receipt, confirm, resend, resendSeconds, setCaptcha,
    step,
    setStep,
    close,
    arrival,
    departure,
    guests,
    nights,
    total,
    setArrival,
    setDeparture,
    setGuests,
    name,
    phone,
    email,
    setName,
    setPhone,
    setEmail,
    code,
    setCode,
    verifyState,
    setVerifyState,
    formError,
    setFormError,
    validateDates,
    validateIdentity,
    verify,
    copied,
    setCopied,
    today,
  } = props;
  const modalRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const opener=document.activeElement as HTMLElement|null;const old=document.body.style.overflow;document.body.style.overflow="hidden";const background=Array.from(document.querySelectorAll<HTMLElement>(".site-header, main, .app-shell > footer"));background.forEach(e=>e.inert=true);modalRef.current?.focus();return()=>{document.body.style.overflow=old;background.forEach(e=>e.inert=false);opener?.focus()}},[]);
  const keyboard=(e:React.KeyboardEvent)=>{
    if(e.key==="Escape"){e.preventDefault();close();}
    if(e.key==="Tab"){
      const focusables=Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')??[]).filter(x=>x.getClientRects().length);
      const first=focusables[0],last=focusables.at(-1);
      if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modalRef.current)){e.preventDefault();first.focus()}
    }
  };
  const labels = ["Fechas", "Datos", "Correo", "Código", "Revisar", "Comprobante"];
  const copy = async () => {
    try { await navigator.clipboard.writeText(receipt.codigo); setCopied(true); }
    catch { setFormError("Selecciona y copia el código de reserva manualmente."); }
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <div className="booking-modal" ref={modalRef} tabIndex={-1} onKeyDown={keyboard}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">RESERVA DIRECTA</p>
            <h2 id="booking-title">
              {step === 6 ? "Tu reserva quedó registrada" : "Reserva tu estancia"}
            </h2>
          </div>
          <button disabled={busy} className="icon-button" onClick={close} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="steps" aria-label={`Paso ${step} de 6`}>
          {labels.map((label, i) => (
            <div key={label} className={step >= i + 1 ? "done" : ""}>
              <span>{step > i + 1 ? <Icon name="check" size={14} /> : i + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <div className="modal-content">
          {busy && <p role="status" className="info-callout">Procesando tu solicitud…</p>}
          <fieldset disabled={busy} className="booking-fields">
          {step === 1 && (
            <>
              <StepTitle
                n="01"
                title="Elige tus fechas"
                text="Consultaremos disponibilidad y precio en el sistema del hotel."
              />
              <div className="form-grid">
                <label>
                  Llegada
                  <input
                    type="date"
                    min={today}
                    value={arrival}
                    onChange={(e) => setArrival(e.target.value)}
                  />
                </label>
                <label>
                  Salida
                  <input
                    type="date"
                    min={arrival || today}
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value)}
                  />
                </label>
                <label>
                  Personas
                  <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                    <option value="1">1 huésped</option>
                    <option value="2">2 huéspedes</option>
              <option value="3">3 huéspedes</option>
              <option value="4">4 huéspedes</option>
                  </select>
                </label>
              </div>
              {option && <RoomSummary nights={nights} total={total} price={option.precio_noche} room={option.nombre} capacity={option.capacidad} />}
              <FormError text={formError} />
              <button className="primary wide" onClick={validateDates}>
                Continuar con mis datos <Icon name="arrow" />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <fieldset className="room-choices"><legend>Elige tu habitación disponible</legend>
              {options.map((o:RoomOption)=><label key={o.tipo} className={option?.tipo===o.tipo?"room-choice selected":"room-choice"}>
                <input type="radio" name="tipo-habitacion" value={o.tipo} checked={option?.tipo===o.tipo} onChange={()=>setOption(o)}/>
                <span><b>{o.nombre}</b><small>Hasta {o.capacidad} personas · ${Number(o.precio_noche).toLocaleString("es-MX")} MXN por noche</small></span><strong>Total: ${Number(o.total).toLocaleString("es-MX")} MXN</strong>
              </label>)}
              </fieldset>
              <StepTitle
                n="02"
                title="¿Quién se hospedará?"
                text="Usaremos estos datos para identificar tu reserva y enviarte el código de verificación."
              />
              <div className="form-stack">
                <label>
                  Nombre completo
                  <input
                    value={name}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Escribe tu nombre y apellidos"
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={phone}
                    autoComplete="tel"
                    inputMode="tel"
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 55 0000 0000"
                  />
                </label>
                <label>
                  Correo electrónico
                  <input
                    value={email}
                    type="email"
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@correo.com"
                  />
                </label>
              </div>
              <Captcha onToken={setCaptcha} />
              <FormError text={formError} />
              <div className="button-row">
                <button className="ghost" onClick={() => setStep(1)}>
                  Atrás
                </button>
                <button className="primary" onClick={validateIdentity}>
                  Enviar código <Icon name="mail" />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <StepTitle
                n="03"
                title="Revisa tu correo"
                text={`Enviamos un código de 6 dígitos a ${email || "tu correo"}. Revisa también spam. Vence en 10 minutos.`}
              />
              <div className="info-callout">
                Verificar tu correo no aparta la habitación. La reserva se crea únicamente al
                confirmar el paso final.
              </div>
              <button className="primary wide" onClick={() => setStep(4)}>
                Introducir código <Icon name="arrow" />
              </button>
            </>
          )}
          {step === 4 && (
            <>
              <StepTitle
                n="04"
                title="Verifica el código"
                text="Escribe los 6 dígitos enviados a tu correo."
              />
              <label className="code-label">
                Código de verificación
                <input
                  className="code-input"
                  maxLength={6}
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setFormError("");
                  }}
                  placeholder="000000"
                />
              </label>
              {verifyState === "expired" ? (
                <FormError text="El código venció. Solicita uno nuevo para continuar." />
              ) : (
                <FormError text={formError} />
              )}
              <div className="resend">
                <button disabled={busy || resendSeconds>0} onClick={resend}>Reenviar código</button>
                <span>{resendSeconds ? `Disponible en ${resendSeconds} s` : "Puedes solicitar otro código"}</span>
              </div>
              <button className="primary wide" disabled={code.length !== 6} onClick={verify}>
                Verificar correo
              </button>

            </>
          )}
          {step === 5 && (
            <>
              <StepTitle
                n="05"
                title="Revisa antes de confirmar"
                text="Tu correo está verificado. Confirma que los datos sean correctos."
              />
              <div className="verified">
                <Icon name="check" />
                <span>
                  <b>Correo verificado</b>
                  <small>{email}</small>
                </span>
              </div>
              <ReceiptSummary
                arrival={arrival}
                departure={departure}
                nights={nights}
                total={total}
                name={name}
                room={option?.nombre} capacity={option?.capacidad}
              />
              <div className="info-callout">
                <b>Importante:</b> esta confirmación crea una reserva, no registra un pago.
              </div>
              <Captcha onToken={setCaptcha} />
              <FormError text={formError} />
              <div className="button-row">
                <button className="ghost" onClick={() => setStep(2)}>
                  Editar datos
                </button>
                <button
                  className="primary"
                  disabled={verifyState !== "verified"}
                  onClick={confirm}
                >
                  Confirmar reserva
                </button>
              </div>
            </>
          )}
          {step === 6 && (
            <div className="receipt">
              <div className="success-seal">
                <Icon name="check" size={28} />
              </div>
              <p className="success-kicker">RESERVA REGISTRADA</p>
              <h3>Te esperamos, {name.split(" ")[0] || "huésped"}.</h3>
              <p>Guarda este comprobante. El estado de pago debe consultarse por separado.</p>
              <div className="reservation-code">
                <small>CÓDIGO DE RESERVA</small>
                <strong>{receipt?.codigo}</strong>
                <button onClick={copy}>
                  <Icon name="copy" size={17} /> {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <ReceiptSummary
                arrival={receipt?.fecha_entrada}
                departure={receipt?.fecha_salida}
                nights={receipt?.noches}
                total={Number(receipt?.total ?? 0)}
                name={name}
                room={receipt?.tipo_nombre} capacity={null}
                status={receipt?.estado} 
              />
              <EncuestaReserva key={receipt?.codigo} token={receipt?.encuesta_token} />
              <div className="receipt-actions">
                <button className="secondary" onClick={() => window.print()}>
                  <Icon name="download" /> Guardar comprobante en PDF
                </button>
                <button className="ghost" onClick={close}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
          </fieldset>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="step-title">
      <span>{n}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
function FormError({ text }: { text: string }) {
  return text ? (
    <div className="error" role="alert">
      {text}
    </div>
  ) : null;
}
function RoomSummary({ nights, total, price, room, capacity }: { nights: number; total: number; price: number; room:string; capacity:number }) {
  return (
    <div className="mini-room">
      <img src={ROOM} alt="" />
      <div>
        <b>Habitación {room}</b>
        <small>Hasta {capacity} personas · ${Number(price).toLocaleString("es-MX")} MXN / noche</small>
      </div>
      <div className="mini-total">
        <b>
          {nights || 0} {nights === 1 ? "noche" : "noches"}
        </b>
        <strong>${total.toLocaleString("es-MX")} MXN</strong>
      </div>
    </div>
  );
}
function ReceiptSummary({ arrival, departure, nights, total, name, status, room, capacity }: any) {
  return (
    <div className="receipt-summary">
      {status && (
        <div>
          <span>Estado</span>
          <b className="status-pill">{status}</b>
        </div>
      )}
      <div>
        <span>Huésped</span>
        <b>{name}</b>
      </div>
      <div>
        <span>Habitación</span>
        <b>{room || "Habitación"}{capacity ? ` · hasta ${capacity} personas` : ""}</b>
      </div>
      <div>
        <span>Llegada</span>
        <b>{formatDate(arrival)}</b>
      </div>
      <div>
        <span>Salida</span>
        <b>{formatDate(departure)}</b>
      </div>
      <div>
        <span>Estancia</span>
        <b>
          {nights} {nights === 1 ? "noche" : "noches"}
        </b>
      </div>
      <div className="total-line">
        <span>Total de la reserva</span>
        <strong>${total.toLocaleString("es-MX")} MXN</strong>
      </div>
      <p>Pago: no registrado en este comprobante</p>
    </div>
  );
}


function LlaveDigital({ codigo, csrf }: { codigo: string; csrf: string }) {
  const [llave, setLlave] = useState<{token:string;vence_en:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ahora, setAhora] = useState(Date.now());
  const canvas = useRef<HTMLCanvasElement>(null);
  const bloqueo = useRef(false);
  const vigente = Boolean(llave && Date.parse(llave.vence_en) > ahora);

  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!llave || !vigente || !canvas.current) return;
    let cancelado = false;
    QRCode.toCanvas(canvas.current, llave.token, {
      width: 240, margin: 4, errorCorrectionLevel: "M",
    }).catch(() => {
      if (!cancelado) setError("No pudimos dibujar el QR. Genera otra llave.");
    });
    return () => { cancelado = true; };
  }, [llave, vigente]);

  const emitir = async () => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setBusy(true); setError(""); setMensaje(""); setLlave(null);
    try {
      const r = await api("estancia/llave", { codigo }, { csrf });
      setAhora(Date.now());
      setLlave({ token: r.token, vence_en: r.vence_en });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la llave.");
    } finally {
      bloqueo.current = false; setBusy(false);
    }
  };

  const probar = async () => {
    if (!llave || bloqueo.current) return;
    bloqueo.current = true;
    setBusy(true); setError(""); setMensaje("");
    try {
      const r = await api("estancia/llave/probar", {
        codigo, token: llave.token,
      }, { csrf });
      setMensaje(r.mensaje);
    } catch (e) {
      setLlave(null);
      setError(e instanceof Error ? e.message : "No se pudo validar la llave.");
    } finally {
      bloqueo.current = false; setBusy(false);
    }
  };

  return <section className="profile-card">
    <p className="eyebrow">LLAVE VIRTUAL · {codigo}</p>
    <h3>Acceso de demostración</h3>
    <p>La llave dura 5 minutos. Generar otra reemplaza la anterior.
      Su validez se comprueba en el servidor al probarla.</p>
    {vigente && llave ? <>
      <canvas ref={canvas} role="img" aria-label="QR de la llave virtual de demostración" />
      <p>Tiempo restante: {Math.max(0, Math.ceil((Date.parse(llave.vence_en)-ahora)/1000))} segundos.</p>
      <p>No compartas este QR. No abre una cerradura física.</p>
      <button type="button" className="secondary" disabled={busy} onClick={probar}>
        Probar acceso simulado
      </button>
    </> : llave ? <p role="status">La llave venció. Genera una nueva.</p> : null}
    <button type="button" className="primary" disabled={busy} onClick={emitir}>
      {busy ? "Procesando…" : llave ? "Renovar llave" : "Generar llave QR"}
    </button>
    {error && <p role="alert">{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
  </section>;
}

function StayArea() {
  const [data,setData]=useState<any>(null), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false);
  const [phase,setPhase]=useState<"email"|"code">("email"),[email,setEmail]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState("");
  const [error,setError]=useState(""),[note,setNote]=useState(""),[captcha,setCaptcha]=useState("");
  const [resendAt,setResendAt]=useState(0),[now,setNow]=useState(Date.now());
  const [tab,setTab]=useState<"reservas"|"datos">("reservas"),[nombre,setNombre]=useState(""),[telefono,setTelefono]=useState("");
  const [receipt,setReceipt]=useState<any>(null),[lookup,setLookup]=useState(false);
  const alive=useRef(true),lock=useRef(false);
  const setSession=(value:any)=>{setData(value);setNombre(value?.perfil?.nombre??"");setTelefono(value?.perfil?.telefono??"");setEmail(value?.email??"");};
  useEffect(()=>{alive.current=true;api("estancia/me").then(r=>{if(alive.current)setSession(r)}).catch(e=>{if(alive.current&&e.status!==401)setError(e.message)}).finally(()=>{if(alive.current)setLoading(false)});return()=>{alive.current=false}},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(data&&now>=data.vence){setSession(null);setReceipt(null);setNote("Tu sesión venció. Solicita otro código para entrar.");setPhase("email");setCode("");setChallenge("")}},[now,data]);
  const work=async(fn:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError("");setNote("");try{await fn()}catch(e){const x=e as any;if(x.status===401){setSession(null);setReceipt(null);setPhase("email");setNote("Tu sesión venció. Ingresa de nuevo.")}else setError(x.message)}finally{lock.current=false;setBusy(false)}};
  const send=()=>void work(async()=>{
    if(Date.now()<resendAt)throw new Error("Espera antes de solicitar otro código.");
    if(!/^\S+@\S+\.\S+$/.test(email.trim()))throw new Error("Escribe un correo válido.");
    if(window.HS_CONFIG?.turnstileSiteKey&&!captcha)throw new Error("Completa la verificación de seguridad.");
    const r=await api("estancia/solicitar",{email:email.trim().toLowerCase(),sitio_web:"",turnstile:captcha});
    setChallenge(r.acceso_id);setCode("");setPhase("code");setResendAt(Date.now()+r.reenviar_en*1000);setNote("Revisa tu correo y spam. El código vence en 10 minutos.");
  });
  const verify=()=>void work(async()=>{
    if(!/^\d{6}$/.test(code))throw new Error("Escribe los 6 dígitos del correo.");
    await api("estancia/confirmar",{email:email.trim().toLowerCase(),acceso_id:challenge,codigo:code});
    const r=await api("estancia/me");setSession(r);setTab("reservas");setCode("");setChallenge("");setReceipt(null);
  });
  const logout=()=>void work(async()=>{await api("estancia/salir",{}, {csrf:data.csrf});setSession(null);setReceipt(null);setPhase("email");setCode("");setChallenge("");setNote("Cerraste tu sesión.")});
  const save=()=>void work(async()=>{
    const r=await api("estancia/perfil",{nombre:nombre.trim(),telefono:telefono.trim()},{method:"PATCH",csrf:data.csrf});
    setData({...data,perfil:r.perfil,reservas:data.reservas.map((x:any)=>({...x,huesped:r.perfil.nombre}))});setNombre(r.perfil.nombre);setTelefono(r.perfil.telefono);setNote("Tus datos se guardaron.");
  });
  if(loading)return <div className="center-page"><p role="status">Cargando Mi estancia…</p></div>;
  if(lookup&&!data)return <><button className="secondary lookup-back" onClick={()=>setLookup(false)}>Volver al acceso privado</button><ReservationLookup/></>;
  if(!data)return <div className="center-page stay-login"><div className="auth-card"><span className="auth-icon"><Icon name="mail"/></span><p className="eyebrow">ACCESO PRIVADO</p><h1>Mi estancia</h1><p>Entra con el correo de tu reserva para consultar tus datos y todas tus reservas.</p>
    <form onSubmit={e=>{e.preventDefault();phase==="email"?send():verify()}}><fieldset disabled={busy} className="booking-fields form-stack">
    {phase==="email"?<label>Correo de tus reservas<input type="email" value={email} maxLength={150} autoComplete="email" onChange={e=>setEmail(e.target.value)} required/></label>:<><p>Enviamos un código a <b>{email}</b>.</p><label>Código de acceso<input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="000000" required/></label></>}
    <Captcha key={phase} onToken={setCaptcha}/><FormError text={error}/>{note&&<p role="status">{note}</p>}
    <button className="primary wide" disabled={busy}>{busy?"Procesando…":phase==="email"?"Enviar código de acceso":"Entrar a Mi estancia"}</button>
    {phase==="code"&&<><button type="button" className="secondary" disabled={busy||now<resendAt} onClick={send}>{now<resendAt?`Reenviar en ${Math.ceil((resendAt-now)/1000)} s`:"Reenviar código"}</button><button type="button" className="text-link" onClick={()=>{setPhase("email");setCode("");setError("");setNote("")}}>Usar otro correo</button></>}
    </fieldset></form><small>Acceso de 30 minutos. Nunca compartas tu código.</small><button className="text-link centered" onClick={()=>setLookup(true)}>Consultar solo con código de reserva</button></div></div>;
  const today=new Intl.DateTimeFormat("en-CA").format(new Date());
  const upcoming=data.reservas.filter((r:any)=>r.fecha_salida>=today&&!/cancel/i.test(r.estado));
  const previous=data.reservas.filter((r:any)=>r.fecha_salida<today||/cancel/i.test(r.estado));
  const list=(rows:any[])=>rows.length?rows.map(r=><article className="stay-reservation" key={r.codigo}><div><p className="eyebrow">{r.codigo} · {r.estado}</p><h3>{r.tipo_nombre}</h3><p>{formatDate(r.fecha_entrada)} — {formatDate(r.fecha_salida)}</p><p>{r.noches} noches · ${Number(r.total).toLocaleString("es-MX")} MXN</p></div><button className="secondary" onClick={()=>{setReceipt(r);setNote("")}}>Ver comprobante</button></article>):<p className="empty-reservations">No tienes reservas en esta sección.</p>;
  return <div className="page dashboard"><section className="dashboard-head"><div><p className="eyebrow light">MI ESTANCIA · ACCESO PRIVADO</p><h1>Hola, {data.perfil?.nombre||"huésped"}</h1><p>{data.email} · Sesión con vencimiento automático</p></div><button disabled={busy} className="cream-button" onClick={logout}><Icon name="logout"/>Cerrar sesión</button></section>
    <div className="dashboard-grid"><aside><button className={tab==="reservas"?"selected":""} onClick={()=>setTab("reservas")}>Mis reservas</button><button className={tab==="datos"?"selected":""} onClick={()=>setTab("datos")}>Mis datos</button></aside><div className="dashboard-main"><FormError text={error}/>{note&&<p role="status" className="info-callout">{note}</p>}
    {data.reservas.filter((r:any)=>r.estado==="en_estancia").map((r:any)=>(
      <LlaveDigital key={r.codigo} codigo={r.codigo} csrf={data.csrf}/>
    ))}
    {!data.perfil&&<p className="info-callout">Tu correo está verificado para esta sesión. Aún no hay un huésped registrado con este correo. Usa el mismo correo al reservar.</p>}
    {tab==="reservas"?<><h2>Próximas reservas</h2>{list(upcoming)}<h2>Historial y canceladas</h2>{list(previous)}{receipt&&<article className="stay-receipt stay-print"><p className="eyebrow">HOTEL 5 LETRAS · COMPROBANTE</p><h2>{receipt.codigo}</h2><ReceiptSummary arrival={receipt.fecha_entrada} departure={receipt.fecha_salida} nights={receipt.noches} total={Number(receipt.total)} name={receipt.huesped} status={receipt.estado} room={receipt.tipo_nombre}/><div className="receipt-actions"><button className="secondary" onClick={()=>window.print()}>Guardar comprobante en PDF</button><button className="ghost" onClick={()=>setReceipt(null)}>Cerrar comprobante</button></div></article>}</>:<><h2>Mis datos</h2>{data.perfil&&<form className="profile-card" onSubmit={e=>{e.preventDefault();save()}}><fieldset disabled={busy} className="booking-fields form-stack"><label>Nombre completo<input value={nombre} onChange={e=>setNombre(e.target.value)} minLength={2} maxLength={100} autoComplete="name" required/></label><label>Teléfono<input type="tel" value={telefono} onChange={e=>setTelefono(e.target.value)} minLength={7} maxLength={20} autoComplete="tel" required/></label><label>Correo verificado para este acceso<input value={data.email} readOnly/></label><p>El cambio de correo no está habilitado. Para recibir ayuda, contacta con recepción.</p><button className="primary" disabled={busy}>{busy?"Guardando…":"Guardar mis datos"}</button></fieldset></form>}</>}
    </div></div></div>;
}

function ReservationLookup() {
  const [codigo,setCodigo]=useState(""); const [email,setEmail]=useState("");
  const [reserva,setReserva]=useState<any>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function buscar(e:React.FormEvent){e.preventDefault();if(busy)return;setError("");setReserva(null);
    if(!/^[A-F0-9]{8}$/.test(codigo.trim().toUpperCase()) || !/^\S+@\S+\.\S+$/.test(email)){setError("Escribe tu código de 8 caracteres y el correo de la reserva.");return;}
    setBusy(true);try{setReserva(await api(`reservas/${encodeURIComponent(codigo.trim().toUpperCase())}?${new URLSearchParams({email:email.trim().toLowerCase()})}`))}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <div className="page"><section className="page-heading"><p className="eyebrow">MI ESTANCIA</p><h1>Consulta tu reserva</h1><p>Usa el código que recibiste al reservar y el mismo correo.</p></section>
    <section className="section stay-real"><form onSubmit={buscar} className="auth-card"><fieldset disabled={busy} className="booking-fields form-stack">
    <label>Código de reserva<input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" required /></label>
    <label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></label>
    <FormError text={error}/><button className="primary wide" type="submit">{busy?"Buscando…":"Buscar reserva"}</button></fieldset>
    <p>Esta consulta muestra una reserva por código y correo. Para ver tu historial y tus datos, entra al acceso privado de Mi estancia.</p></form>
    {reserva && <article className="auth-card" aria-live="polite"><h2>Tu reserva</h2><ReceiptSummary arrival={reserva.fecha_entrada} departure={reserva.fecha_salida} nights={daysBetween(reserva.fecha_entrada,reserva.fecha_salida)} total={Number(reserva.total)} name={reserva.huesped} status={reserva.estado} room={reserva.tipo_nombre}/></article>}
    </section></div>;
}

function HotelAssistant(){
 const [question,setQuestion]=useState("");const [answer,setAnswer]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function ask(e:React.FormEvent){e.preventDefault();if(busy)return;setError("");if(question.trim().length<3){setError("Escribe una pregunta de al menos 3 caracteres.");return;}setBusy(true);setAnswer("");try{const r=await api("asistente",{pregunta:question.trim()});setAnswer(r.respuesta)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <aside className="assistant-card"><p className="eyebrow light">ASISTENTE DEL HOTEL</p><h2>¿En qué podemos ayudarte?</h2><p>Consulta horarios, políticas o servicios. Confirma con recepción cualquier dato de demostración.</p><form onSubmit={ask} className="form-stack"><label>Tu pregunta<input required minLength={3} maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/></label><button className="cream-button" disabled={busy}>{busy?"Consultando…":"Preguntar"}</button></form><FormError text={error}/>{answer&&<p aria-live="polite" className="assistant-answer">{answer}</p>}</aside>;
}

function Help({ open, setOpen }: any) {
  const faqs = [
    "¿Cuáles son los horarios de entrada y salida?",
    "¿Qué servicios ofrece el hotel?",
    "¿Cuál es la política de cambios y cancelaciones?",
    "¿Cómo puedo consultar mi reserva?",
  ];
  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">ESTAMOS PARA ORIENTARTE</p>
        <h1>Ayuda</h1>
        <p>
          Información clara, sin suposiciones. Los datos del hotel se agregarán una vez confirmados.
        </p>
      </section>
      <div className="help-grid section">
        <section>
          <h2>Preguntas frecuentes</h2>
          <div className="faqs">
            {faqs.map((q, i) => (
              <div className="faq" key={q}>
                <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{q}</span>
                  <Icon name="chevron" />
                </button>
                {open === i && (
                  <p>
                    {i === 3
                      ? "En Mi estancia puedes consultar una reserva con su código de 8 caracteres y el correo utilizado. También puedes entrar al acceso privado verificando tu correo para ver tu historial y datos."
                      : "Información pendiente de confirmar por el hotel. Este campo será editable cuando se conecte la fuente de contenido."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <HotelAssistant />
      </div>
      <section className="pending-fields section">
        <div>
          <Icon name="phone" />
          <span>
            <b>Horario de atención</b>
            <p>Pendiente de confirmar</p>
          </span>
        </div>
        <div>
          <Icon name="check" />
          <span>
            <b>Servicios</b>
            <p>Pendientes de confirmar</p>
          </span>
        </div>
        <div>
          <Icon name="copy" />
          <span>
            <b>Políticas</b>
            <p>Pendientes de confirmar</p>
          </span>
        </div>
      </section>
    </div>
  );
}

function Location() {
  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">ENCUÉNTRANOS</p>
        <h1>Ubicación</h1>
        <p>La dirección y los datos de llegada se publicarán después de ser confirmados.</p>
      </section>
      <section className="location-layout section">
        <div className="map-placeholder">
          <Icon name="pin" size={38} />
          <b>Mapa pendiente de integración</b>
          <span>Aquí se mostrará la ubicación real del HOTEL 5 LETRAS.</span>
        </div>
        <div className="location-copy">
          <p className="eyebrow">INFORMACIÓN DEL HOTEL</p>
          <h2>Tu punto de llegada</h2>
          <div className="contact-row">
            <Icon name="pin" />
            <span>
              <b>Dirección</b>
              <p>Pendiente de confirmar</p>
            </span>
          </div>
          <div className="contact-row">
            <Icon name="phone" />
            <span>
              <b>Teléfono</b>
              <p>Pendiente de confirmar</p>
            </span>
          </div>
          <div className="contact-row">
            <Icon name="mail" />
            <span>
              <b>Correo</b>
              <p>Pendiente de confirmar</p>
            </span>
          </div>
          <p className="pending-copy">
            Las indicaciones de acceso, referencias y opciones de transporte serán editables al
            conectar la información oficial.
          </p>
        </div>
      </section>
    </div>
  );
}

function ContactStrip() {
  return (
    <section className="contact-strip">
      <div>
        <Icon name="phone" />
        <span>
          <b>Teléfono</b>
          <small>Pendiente de confirmar</small>
        </span>
      </div>
      <div>
        <Icon name="mail" />
        <span>
          <b>Correo</b>
          <small>Pendiente de confirmar</small>
        </span>
      </div>
      <div>
        <Icon name="pin" />
        <span>
          <b>Ubicación</b>
          <small>Pendiente de confirmar</small>
        </span>
      </div>
    </section>
  );
}
function Footer({ go }: { go: (p: Page) => void }) {
  return (
    <footer>
      <div className="footer-brand">
        <span className="brand-mark">H5L</span>
        <div>
          <b>HOTEL 5 LETRAS</b>
          <p>Un descanso sencillo, cálido y personal.</p>
        </div>
      </div>
      <div className="footer-nav">
        {nav.map((n) => (
          <button key={n.id} onClick={() => go(n.id)}>
            {n.label}
          </button>
        ))}
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} HOTEL 5 LETRAS</span>
        <span>Información del hotel pendiente de confirmar.</span>
      </div>
    </footer>
  );
}

export default App;
