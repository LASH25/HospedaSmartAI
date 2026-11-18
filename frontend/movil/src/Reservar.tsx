import EncuestaReserva from "./EncuestaReserva";
import { useEffect, useRef, useState } from "react";
import {
  Platform, Pressable, ScrollView, Share,
  Text, TextInput, View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api, ErrorApi } from "./api";
import { Boton, C, u } from "./PaginasPublicas";

type Opcion = {
  tipo: string;
  nombre: string;
  capacidad: number;
  precio_noche: number;
  total: number;
};

type Comprobante = {
  codigo: string;
  estado: string;
  fecha_entrada: string;
  fecha_salida: string;
  noches: number;
  total: number;
  tipo_nombre: string;
  encuesta_token?: string;
};

function dia(fecha: Date) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

function Campo({
  titulo, valor, cambiar, numerico = false, email = false, max = 100,
}: {
  titulo: string; valor: string; cambiar: (v: string) => void;
  numerico?: boolean; email?: boolean; max?: number;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={u.etiqueta}>{titulo}</Text>
      <TextInput
        accessibilityLabel={titulo}
        style={u.input}
        value={valor}
        onChangeText={cambiar}
        maxLength={max}
        keyboardType={email ? "email-address" : numerico ? "phone-pad" : "default"}
        autoCapitalize={email || numerico ? "none" : "words"}
        autoCorrect={!email && !numerico}
      />
    </View>
  );
}

export default function Reservar({ estancia }: { estancia: () => void }) {
  const [paso, setPaso] = useState(1);
  const [llegada, setLlegada] = useState<Date | null>(null);
  const [salida, setSalida] = useState<Date | null>(null);
  const [calendario, setCalendario] = useState<"llegada" | "salida" | null>(null);
  const [personas, setPersonas] = useState(2);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [opcion, setOpcion] = useState<Opcion | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [reto, setReto] = useState("");
  const [prueba, setPrueba] = useState("");
  const [vence, setVence] = useState(0);
  const [reenviar, setReenviar] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [incierta, setIncierta] = useState(false);
  const [recibo, setRecibo] = useState<Comprobante | null>(null);
  const bloqueo = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function ejecutar(tarea: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      await tarea();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  const identidad = () => ({
    nombre: nombre.trim().replace(/\s+/g, " "),
    email: correo.trim().toLowerCase(),
    telefono: telefono.trim(),
  });

  const buscar = () => void ejecutar(async () => {
    if (
      !llegada || !salida ||
      dia(llegada) < dia(new Date()) ||
      dia(salida) <= dia(llegada)
    ) throw new Error("Elige llegada desde hoy y salida posterior.");

    setOpciones([]);
    setOpcion(null);
    const q = new URLSearchParams({
      fecha_entrada: dia(llegada),
      fecha_salida: dia(salida),
      personas: String(personas),
    });
    const r = await api<{ opciones: Opcion[] }>(`disponibilidad?${q}`);
    const disponibles = (r.opciones ?? [])
      .filter(o => ["individual", "doble", "suite"].includes(o.tipo))
      .sort((a, b) => Number(a.precio_noche) - Number(b.precio_noche));
    if (!disponibles.length) {
      throw new Error("No hay opciones disponibles. Prueba otras fechas.");
    }
    setOpciones(disponibles);
  });

  const enviar = () => void ejecutar(async () => {
    if (Date.now() < reenviar) {
      throw new Error("Espera antes de solicitar otro código.");
    }
    const datos = identidad();
    if (
      datos.nombre.length < 2 ||
      datos.telefono.length < 7 ||
      !/^\S+@\S+\.\S+$/.test(datos.email)
    ) throw new Error("Completa nombre, teléfono y un correo válido.");

    const r = await api<{ verificacion_id: string; reenviar_en: number }>(
      "correo/solicitar",
      { ...datos, sitio_web: "", turnstile: "" },
    );
    setReto(r.verificacion_id);
    setPrueba("");
    setCodigo("");
    setReenviar(Date.now() + r.reenviar_en * 1000);
    setPaso(3);
  });

  const verificar = () => void ejecutar(async () => {
    if (!/^\d{6}$/.test(codigo)) {
      throw new Error("Escribe los seis dígitos del correo.");
    }
    const r = await api<{ verificacion_token: string; vence_en: number }>(
      "correo/confirmar",
      { ...identidad(), verificacion_id: reto, codigo },
    );
    setPrueba(r.verificacion_token);
    setVence(Date.now() + r.vence_en * 1000);
    setPaso(4);
  });

  const confirmar = () => void ejecutar(async () => {
    if (!opcion || !llegada || !salida || incierta) return;
    if (!prueba || Date.now() >= vence) {
      setPrueba("");
      setPaso(2);
      throw new Error("La verificación venció. Solicita otro código.");
    }
    try {
      const r = await api<Comprobante>("reservas", {
        ...identidad(),
        tipo: opcion.tipo,
        fecha_entrada: dia(llegada),
        fecha_salida: dia(salida),
        personas,
        verificacion_token: prueba,
        sitio_web: "",
        turnstile: "",
      });
      setRecibo(r);
      setPrueba("");
      setPaso(5);
    } catch (e) {
      if (!(e instanceof ErrorApi) || e.status >= 500) {
        setIncierta(true);
        throw new Error(
          "No recibimos la confirmación. Revisa Mi estancia y tu correo antes de intentar otra reserva.",
        );
      }
      throw e;
    }
  });

  const resumen = [
    opcion?.nombre,
    llegada && salida ? `${dia(llegada)} — ${dia(salida)}` : "",
    `${personas} persona(s)`,
    opcion ? `Total: $${Number(opcion.total).toFixed(2)} MXN` : "",
  ].filter(Boolean).join("\n");

  function cambiarFecha(tipo: "llegada" | "salida", fecha: Date) {
    if (tipo === "llegada") setLlegada(fecha);
    else setSalida(fecha);
    setOpciones([]);
    setOpcion(null);
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled"
      contentContainerStyle={u.pagina}>
      <Text style={u.ceja}>TU PRÓXIMA ESTANCIA</Text>
      <Text style={u.titulo}>{paso === 5 ? "Reserva registrada" : "Reservar"}</Text>
      <Text style={[u.texto, { marginBottom: 20 }]}>
        Inventario de demostración. Reservar no registra un pago.
      </Text>
      {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}

      {paso === 1 && (
        <View style={u.tarjeta}>
          <Text style={u.etiqueta}>1 · Fechas y personas</Text>
          <Boton texto={llegada ? `Llegada: ${dia(llegada)}` : "Elegir llegada"}
            accion={() => setCalendario("llegada")} ocupado={ocupado} />
          <Boton texto={salida ? `Salida: ${dia(salida)}` : "Elegir salida"}
            accion={() => setCalendario("salida")} ocupado={ocupado} />

          {calendario && (
            <>
              <DateTimePicker
                value={(calendario === "llegada" ? llegada : salida) ?? new Date()}
                mode="date"
                minimumDate={calendario === "salida" && llegada ? llegada : new Date()}
                onChange={(evento, fecha) => {
                  if (Platform.OS === "android") setCalendario(null);
                  if (evento.type !== "dismissed" && fecha) {
                    cambiarFecha(calendario, fecha);
                  }
                }}
              />
              {Platform.OS === "ios" && (
                <Boton texto="Listo" accion={() => setCalendario(null)} />
              )}
            </>
          )}

          <Text style={[u.etiqueta, { marginTop: 20 }]}>Personas</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[1, 2, 3, 4].map(n => (
              <Pressable key={n} disabled={ocupado}
                accessibilityRole="button"
                accessibilityState={{ selected: personas === n }}
                onPress={() => {
                  setPersonas(n); setOpciones([]); setOpcion(null);
                }}
                style={{
                  padding: 15, borderWidth: 1, borderRadius: 5,
                  borderColor: C.verde,
                  backgroundColor: personas === n ? C.verde : "#FFFFFF",
                }}>
                <Text style={{ color: personas === n ? "#FFFFFF" : C.verde }}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Boton texto={ocupado ? "Buscando…" : "Ver disponibilidad"}
            accion={buscar} ocupado={ocupado} />
          {opciones.map(o => (
            <View key={o.tipo} style={{ marginTop: 24 }}>
              <Text style={u.titulo}>{o.nombre}</Text>
              <Text style={u.texto}>
                Hasta {o.capacidad} persona(s){"\n"}
                ${Number(o.precio_noche).toFixed(2)} MXN por noche{"\n"}
                Total: ${Number(o.total).toFixed(2)} MXN
              </Text>
              <Boton texto="Elegir esta habitación" ocupado={ocupado}
                accion={() => { setOpcion(o); setError(""); setPaso(2); }} />
            </View>
          ))}
        </View>
      )}

      {paso === 2 && (
        <View style={u.tarjeta}>
          <Text style={u.etiqueta}>2 · Tus datos</Text>
          <Text style={[u.texto, { marginBottom: 20 }]}>{resumen}</Text>
          <Campo titulo="Nombre completo" valor={nombre} cambiar={setNombre} />
          <Campo titulo="Teléfono" valor={telefono}
            cambiar={setTelefono} numerico max={20} />
          <Campo titulo="Correo" valor={correo} cambiar={setCorreo} email max={150} />
          <Boton texto={ocupado ? "Enviando…" : "Enviar código al correo"}
            accion={enviar} ocupado={ocupado || ahora < reenviar} />
          {ahora < reenviar && (
            <Text style={u.nota}>Puedes reenviar en {Math.ceil((reenviar - ahora) / 1000)} s.</Text>
          )}
          <Boton texto="Cambiar fechas"
            accion={() => { setPaso(1); setPrueba(""); }}
            ocupado={ocupado} />
        </View>
      )}

      {paso === 3 && (
        <View style={u.tarjeta}>
          <Text style={u.etiqueta}>3 · Verifica tu correo</Text>
          <Text style={u.texto}>Revisa el correo y spam de {correo}. No compartas tu código.</Text>
          <Campo titulo="Código de seis dígitos" valor={codigo}
            cambiar={v => setCodigo(v.replace(/\D/g, ""))} numerico max={6} />
          <Boton texto="Verificar correo" accion={verificar} ocupado={ocupado} />
          <Boton texto={ahora < reenviar
            ? `Reenviar en ${Math.ceil((reenviar - ahora) / 1000)} s`
            : "Reenviar código"}
            accion={enviar} ocupado={ocupado || ahora < reenviar} />
          <Boton texto="Editar datos" ocupado={ocupado}
            accion={() => { setPaso(2); setPrueba(""); }} />
        </View>
      )}

      {paso === 4 && (
        <View style={u.tarjeta}>
          <Text style={u.etiqueta}>4 · Revisa antes de confirmar</Text>
          <Text style={u.texto}>
            {nombre}{"\n"}{correo}{"\n"}{telefono}{"\n\n"}{resumen}
          </Text>
          <Text style={u.nota}>Esta confirmación crea una reserva, no un pago.</Text>
          <Boton texto={ocupado ? "Confirmando…" : "Confirmar reserva"}
            accion={confirmar} ocupado={ocupado || incierta} />
          <Boton texto="Ir a Mi estancia" accion={estancia} ocupado={ocupado} />
          {!incierta && (
            <Boton texto="Editar datos" ocupado={ocupado}
              accion={() => { setPrueba(""); setPaso(2); }} />
          )}
        </View>
      )}

      {paso === 5 && recibo && (
        <View style={u.tarjeta}>
          <Text style={u.ceja}>RESERVA REGISTRADA</Text>
          <Text selectable style={u.titulo}>{recibo.codigo}</Text>
          <Text style={u.texto}>
            {nombre}{"\n"}{recibo.tipo_nombre}{"\n"}
            {recibo.fecha_entrada} — {recibo.fecha_salida}{"\n"}
            {recibo.noches} noche(s){"\n"}
            Total: ${Number(recibo.total).toFixed(2)} MXN{"\n"}
            Estado: {recibo.estado}
          </Text>
          <Text style={u.nota}>Guarda el código. El estado del pago se consulta por separado.</Text>
          <Boton texto="Compartir comprobante"
            accion={() => {
              void Share.share({
                message: `Hotel 5 Letras · Reserva ${recibo.codigo}\n` +
                  `${recibo.tipo_nombre}\n${recibo.fecha_entrada} — ${recibo.fecha_salida}\n` +
                  `Total: $${Number(recibo.total).toFixed(2)} MXN\n` +
                  `Estado: ${recibo.estado}. Este comprobante no acredita un pago.`,
              }).catch(() => setError("No se pudo compartir el comprobante."));
            }} />
          <EncuestaReserva token={recibo.encuesta_token} />
          <Boton texto="Ir a Mi estancia" accion={estancia} />
        </View>
      )}
    </ScrollView>
  );
}
