import SolicitudesEstancia from "./SolicitudesEstancia";
import { LlaveDigital, EncuestaEstancia } from "./ServiciosEstancia";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
  KeyboardAvoidingView,
} from "react-native";
import {
  SafeAreaProvider, SafeAreaView,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { api, ErrorApi } from "./api";
import type { Reserva, Sesion } from "./api";

const VERDE = "#173F35";
const CREMA = "#F7F4EC";
const ORO = "#B18A50";

function Boton({
  titulo, onPress, disabled = false, secundario = false,
}: {
  titulo: string;
  onPress: () => void;
  disabled?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.boton,
        secundario && s.secundario,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.botonTexto, secundario && { color: VERDE }]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

function Campo({
  titulo, valor, cambiar, tipo = "default", maxLength = 100,
}: {
  titulo: string;
  valor: string;
  cambiar: (v: string) => void;
  tipo?: "default" | "email-address" | "number-pad" | "phone-pad";
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.etiqueta}>{titulo}</Text>
      <TextInput
        accessibilityLabel={titulo}
        style={s.input}
        value={valor}
        onChangeText={cambiar}
        keyboardType={tipo}
        autoCapitalize={tipo === "email-address" ? "none" : "sentences"}
        autoCorrect={tipo === "default"}
        maxLength={maxLength}
        placeholderTextColor="#87938B"
      />
    </View>
  );
}

const dinero = (valor: number) =>
  `$${valor.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;

function fecha(valor: string) {
  const [a, m, d] = valor.split("-");
  return `${d}/${m}/${a}`;
}

function MiEstancia() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [reto, setReto] = useState("");
  const [reenviar, setReenviar] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [tab, setTab] = useState<"reservas" | "perfil">("reservas");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const bloqueo = useRef(false);

  function recibir(datos: Sesion) {
    setSesion(datos);
    setEmail(datos.email);
    setNombre(datos.perfil?.nombre ?? "");
    setTelefono(datos.perfil?.telefono ?? "");
  }

  useEffect(() => {
    let activo = true;
    api<Sesion>("estancia/me")
      .then(datos => { if (activo) recibir(datos); })
      .catch(e => {
        if (activo && !(e instanceof ErrorApi && e.status === 401)) {
          setError(e.message);
        }
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sesion) return;
    const timer = setInterval(() => {
      if (Date.now() >= sesion.vence) {
        setSesion(null);
        setReto("");
        setCodigo("");
        setNota("Tu sesión venció. Solicita otro código para entrar.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sesion]);

  async function trabajar(tarea: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    setNota("");
    try {
      await tarea();
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) {
        setSesion(null);
        setReto("");
        setCodigo("");
      }
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  const solicitar = () => void trabajar(async () => {
    if (Date.now() < reenviar) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      throw new Error("Escribe un correo válido.");
    }
    const r = await api<{ acceso_id: string; reenviar_en: number }>(
      "estancia/solicitar",
      { email: email.trim().toLowerCase(), sitio_web: "", turnstile: "" },
    );
    setReto(r.acceso_id);
    setCodigo("");
    setReenviar(Date.now() + r.reenviar_en * 1000);
    setNota("Revisa tu correo y spam. El código vence en 10 minutos.");
  });

  const entrar = () => void trabajar(async () => {
    if (!/^\d{6}$/.test(codigo)) {
      throw new Error("Escribe los seis dígitos del correo.");
    }
    await api("estancia/confirmar", {
      email: email.trim().toLowerCase(),
      acceso_id: reto,
      codigo,
    });
    recibir(await api<Sesion>("estancia/me"));
    setCodigo("");
    setReto("");
    setTab("reservas");
  });

  const salir = () => void trabajar(async () => {
    if (!sesion) return;
    await api("estancia/salir", {}, { csrf: sesion.csrf });
    setSesion(null);
    setReto("");
    setCodigo("");
    setNota("Cerraste tu sesión.");
  });

  const actualizar = () => void trabajar(async () => {
    recibir(await api<Sesion>("estancia/me"));
    setNota("Información actualizada.");
  });

  const guardar = () => void trabajar(async () => {
    if (!sesion) return;
    if (nombre.trim().length < 2 || telefono.trim().length < 7) {
      throw new Error("Revisa tu nombre y teléfono.");
    }
    await api("estancia/perfil", {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
    }, { method: "PATCH", csrf: sesion.csrf });
    recibir(await api<Sesion>("estancia/me"));
    setNota("Tus datos se guardaron.");
  });

  function comprobante(r: Reserva) {
    Alert.alert(
      `Comprobante ${r.codigo}`,
      `${r.huesped}\n${r.tipo_nombre}\n` +
      `${fecha(r.fecha_entrada)} — ${fecha(r.fecha_salida)}\n` +
      `${r.noches} noche(s)\n${dinero(r.total)}\nEstado: ${r.estado}`,
    );
  }

  const actuales = sesion?.reservas.filter(
    r => ["confirmada", "en_estancia"].includes(r.estado),
  ) ?? [];
  const historial = sesion?.reservas.filter(
    r => !["confirmada", "en_estancia"].includes(r.estado),
  ) ?? [];

  const lista = (reservas: Reserva[]) => reservas.length ? reservas.map(r => (
    <View style={s.tarjeta} key={r.codigo}>
      <Text style={s.ceja}>{r.codigo} · {r.estado.replace(/_/g, " ")}</Text>
      <Text style={s.subtitulo}>{r.tipo_nombre}</Text>
      <Text style={s.texto}>
        {fecha(r.fecha_entrada)} — {fecha(r.fecha_salida)}
      </Text>
      <Text style={[s.texto, { marginBottom: 16 }]}>
        {r.noches} noche(s) · {dinero(r.total)}
      </Text>
      <Boton titulo="Ver comprobante" secundario onPress={() => comprobante(r)} />
      {sesion && r.estado === "en_estancia" && (
        <View style={{ marginTop: 22 }}>
          <LlaveDigital codigo={r.codigo} csrf={sesion.csrf} />
          <SolicitudesEstancia codigo={r.codigo} csrf={sesion.csrf} />
        </View>
      )}
      {sesion && r.estado === "finalizada" && (
        <View style={{ marginTop: 22 }}>
          <EncuestaEstancia codigo={r.codigo} csrf={sesion.csrf} />
        </View>
      )}

    </View>
  )) : <Text style={s.vacio}>No tienes reservas en esta sección.</Text>;

  if (cargando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator color={VERDE} />
        <Text style={s.texto}>Cargando Mi estancia…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.fondo}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.marca}>
            <Text style={s.logo}>H5L</Text>
            <View>
              <Text style={s.hotel}>HOTEL 5 LETRAS</Text>
              <Text style={s.lema}>HOSPITALIDAD LOCAL</Text>
            </View>
          </View>

          {sesion ? (
            <View style={s.cabecera}>
              <Text style={[s.ceja, { color: "#D6BE92" }]}>
                MI ESTANCIA · ACCESO PRIVADO
              </Text>
              <Text style={s.saludo}>Hola, {sesion.perfil?.nombre || "huésped"}</Text>
              <Text style={{ color: "#C5D3CB", marginBottom: 20 }}>
                {sesion.email}
              </Text>
              <Boton titulo="Cerrar sesión" secundario
                disabled={ocupado} onPress={salir} />
            </View>
          ) : null}

          <View style={s.contenido}>
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            {!!nota && <Text style={s.aviso}>{nota}</Text>}

            {!sesion ? (
              <View style={s.tarjeta}>
                <Text style={s.ceja}>ACCESO PRIVADO</Text>
                <Text style={s.titulo}>Mi estancia</Text>
                <Text style={[s.texto, { marginBottom: 24 }]}>
                  Entra con el correo de tu reserva para consultar tu estancia.
                </Text>
                {!reto ? (
                  <Campo titulo="Correo de tus reservas" valor={email}
                    cambiar={setEmail} tipo="email-address" maxLength={150} />
                ) : (
                  <>
                    <Text style={[s.texto, { marginBottom: 16 }]}>
                      Enviamos un código a {email}.
                    </Text>
                    <Campo titulo="Código de acceso" valor={codigo}
                      cambiar={v => setCodigo(v.replace(/\D/g, ""))}
                      tipo="number-pad" maxLength={6} />
                  </>
                )}
                <Boton
                  titulo={ocupado ? "Procesando…" : reto ? "Entrar a Mi estancia" : "Enviar código"}
                  disabled={ocupado}
                  onPress={reto ? entrar : solicitar}
                />
                {!!reto && (
                  <>
                    <Boton secundario disabled={ocupado || ahora < reenviar}
                      titulo={ahora < reenviar
                        ? `Reenviar en ${Math.ceil((reenviar - ahora) / 1000)} s`
                        : "Reenviar código"}
                      onPress={solicitar} />
                    <Boton titulo="Usar otro correo" secundario disabled={ocupado}
                      onPress={() => { setReto(""); setCodigo(""); setError(""); }} />
                  </>
                )}
                <Text style={s.pie}>Acceso de 30 minutos. No compartas tu código.</Text>
              </View>
            ) : (
              <>
                <View style={s.tabs}>
                  <Boton titulo="Mis reservas" secundario={tab !== "reservas"}
                    onPress={() => setTab("reservas")} />
                  <Boton titulo="Mis datos" secundario={tab !== "perfil"}
                    onPress={() => setTab("perfil")} />
                </View>
                {tab === "reservas" ? (
                  <>
                    <Boton titulo="Actualizar reservas" secundario
                      disabled={ocupado} onPress={actualizar} />
                    <Text style={s.titulo}>Mis reservas</Text>
                    {lista(actuales)}
                    <Text style={s.titulo}>Historial y canceladas</Text>
                    {lista(historial)}
                  </>
                ) : (
                  <View style={s.tarjeta}>
                    <Text style={s.titulo}>Mis datos</Text>
                    {sesion.perfil ? (
                      <>
                        <Campo titulo="Nombre completo" valor={nombre} cambiar={setNombre} />
                        <Campo titulo="Teléfono" valor={telefono}
                          cambiar={setTelefono} tipo="phone-pad" maxLength={20} />
                        <Text style={[s.texto, { marginBottom: 20 }]}>{sesion.email}</Text>
                        <Boton titulo="Guardar mis datos"
                          disabled={ocupado} onPress={guardar} />
                      </>
                    ) : (
                      <Text style={s.texto}>
                        Tu correo está verificado, pero todavía no tiene un huésped
                        registrado. Usa el mismo correo al reservar.
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><MiEstancia /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: CREMA },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: CREMA, gap: 16 },
  marca: { flexDirection: "row", alignItems: "center", gap: 14, padding: 22, borderBottomWidth: 1, borderColor: "#E1DACB" },
  logo: { color: ORO, fontFamily: "serif", fontSize: 25, borderWidth: 1, borderColor: ORO, padding: 9 },
  hotel: { color: VERDE, fontSize: 15, letterSpacing: 2, fontWeight: "600" },
  lema: { color: ORO, fontSize: 9, letterSpacing: 2, marginTop: 5 },
  cabecera: { backgroundColor: VERDE, padding: 24 },
  saludo: { fontFamily: "serif", color: CREMA, fontSize: 34, marginVertical: 14 },
  contenido: { padding: 20 },
  tarjeta: { backgroundColor: "#FFFEFA", padding: 22, borderWidth: 1, borderColor: "#DED7C8", borderRadius: 12, marginBottom: 18 },
  ceja: { color: ORO, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 },
  titulo: { color: VERDE, fontFamily: "serif", fontSize: 29, marginTop: 16, marginBottom: 18 },
  subtitulo: { color: VERDE, fontFamily: "serif", fontSize: 25, marginBottom: 10 },
  texto: { color: "#626F67", fontSize: 15, lineHeight: 23 },
  etiqueta: { color: VERDE, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: "#D8D0BF", borderRadius: 5, paddingHorizontal: 14, backgroundColor: "#FFFFFF", color: VERDE, fontSize: 16 },
  boton: { backgroundColor: VERDE, minHeight: 49, padding: 14, borderRadius: 5, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  secundario: { backgroundColor: "#FFFEFA", borderWidth: 1, borderColor: VERDE },
  botonTexto: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
  pie: { color: "#7C857F", fontSize: 12, textAlign: "center", marginTop: 14, lineHeight: 19 },
  error: { color: "#9A302C", backgroundColor: "#F9E9E5", padding: 14, marginBottom: 16, borderRadius: 5 },
  aviso: { color: VERDE, backgroundColor: "#E8EFE8", padding: 14, marginBottom: 16, borderRadius: 5 },
  vacio: { color: "#788078", padding: 20, backgroundColor: "#FFFEFA", marginBottom: 18 },
  tabs: { marginBottom: 16 },
});