import { useEffect, useRef, useState } from "react";
import {
  AppState, Pressable, Text, TextInput, View, useWindowDimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { api } from "./api";
import { Boton, C, u } from "./PaginasPublicas";

type Props = { codigo: string; csrf: string };
type Llave = { token: string; vence_en: string };

export function LlaveDigital({ codigo, csrf }: Props) {
  const [llave, setLlave] = useState<Llave | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());
  const bloqueo = useRef(false);
  const { width } = useWindowDimensions();
  const vigente = Boolean(
    llave && Number.isFinite(Date.parse(llave.vence_en)) &&
    Date.parse(llave.vence_en) > ahora,
  );

  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    const evento = AppState.addEventListener("change", estado => {
      // No conservamos el QR al dejar la app en segundo plano.
      if (estado !== "active") setLlave(null);
      setAhora(Date.now());
    });
    return () => { clearInterval(timer); evento.remove(); };
  }, []);

  async function emitir() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    setLlave(null);
    try {
      const r = await api<Llave>("estancia/llave", { codigo }, { csrf });
      if (
        !/^[a-f0-9]{64}$/.test(r.token) ||
        !Number.isFinite(Date.parse(r.vence_en))
      ) throw new Error("El hotel no devolvió una llave válida.");
      setAhora(Date.now());
      setLlave(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  async function probar() {
    if (!llave || !vigente || bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const r = await api<{ mensaje: string }>(
        "estancia/llave/probar",
        { codigo, token: llave.token },
        { csrf },
      );
      setMensaje(r.mensaje);
    } catch (e) {
      setLlave(null);
      setError(e instanceof Error ? e.message : "No se pudo validar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  return (
    <View style={u.tarjeta}>
      <Text style={u.ceja}>LLAVE VIRTUAL · {codigo}</Text>
      <Text style={u.titulo}>Acceso de demostración</Text>
      <Text style={u.texto}>
        La llave dura cinco minutos. Generar otra reemplaza la anterior.
      </Text>

      {vigente && llave && (
        <>
          <View
            accessible
            accessibilityLabel="QR de la llave virtual de demostración"
            style={{
              alignSelf: "center", backgroundColor: "#FFFFFF",
              padding: 20, marginVertical: 22,
            }}
          >
            <QRCode
              value={llave.token}
              size={Math.max(120, Math.min(220, width - 140))}
              ecl="M"
            />
          </View>
          <Text style={u.texto}>
            Tiempo restante: {Math.max(
              0, Math.ceil((Date.parse(llave.vence_en) - ahora) / 1000),
            )} segundos.
          </Text>
          <Text style={u.nota}>
            No compartas este QR. No abre una cerradura física.
          </Text>
          <Boton texto="Probar acceso simulado"
            accion={() => void probar()} ocupado={ocupado} />
        </>
      )}

      {llave && !vigente && (
        <Text style={u.nota}>La llave venció. Genera una nueva.</Text>
      )}
      <Boton
        texto={ocupado ? "Procesando…" : llave ? "Renovar llave" : "Generar llave QR"}
        accion={() => void emitir()}
        ocupado={ocupado}
      />
      {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}
      {!!mensaje && <Text style={u.texto}>{mensaje}</Text>}
    </View>
  );
}

const preguntas = [
  ["atencion", "Atención recibida"],
  ["limpieza", "Limpieza durante la estancia"],
  ["satisfaccion", "Satisfacción general"],
] as const;

type Campo = typeof preguntas[number][0];

export function EncuestaEstancia({ codigo, csrf }: Props) {
  const [estado, setEstado] = useState<{
    disponible: boolean; respondida: boolean;
  } | null>(null);
  const [notas, setNotas] = useState<Record<Campo, number>>({
    atencion: 0, limpieza: 0, satisfaccion: 0,
  });
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const bloqueo = useRef(false);

  async function consultar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      setEstado(await api(
        "estancia/encuesta/estado", { codigo }, { csrf },
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  async function enviar() {
    if (bloqueo.current) return;
    if (Object.values(notas).some(n => n < 1 || n > 5)) {
      setError("Selecciona una calificación para cada pregunta.");
      return;
    }
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      await api("estancia/encuesta/guardar", {
        codigo, ...notas, comentario: comentario.trim(),
      }, { csrf });
      setEstado({ disponible: false, respondida: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  return (
    <View style={u.tarjeta}>
      <Text style={u.ceja}>ENCUESTA DE ESTANCIA · {codigo}</Text>
      <Text style={u.titulo}>¿Cómo fue tu estancia?</Text>

      {estado?.respondida ? (
        <Text style={u.texto}>
          ¡Gracias! Tu evaluación de esta estancia quedó registrada.
        </Text>
      ) : !estado ? (
        <>
          <Text style={u.texto}>
            Comparte tu opinión sobre atención, limpieza y experiencia general.
          </Text>
          <Boton texto={ocupado ? "Consultando…" : "Evaluar mi estancia"}
            accion={() => void consultar()} ocupado={ocupado} />
        </>
      ) : estado.disponible ? (
        <>
          <Text style={u.nota}>
            Encuesta opcional. 1 es la calificación más baja y 5 la más alta.
          </Text>
          {preguntas.map(([campo, titulo]) => (
            <View key={campo} style={{ marginTop: 20 }}>
              <Text style={u.etiqueta}>{titulo}</Text>
              <View style={{
                flexDirection: "row", flexWrap: "wrap", gap: 8,
              }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Pressable key={n}
                    disabled={ocupado}
                    accessibilityRole="radio"
                    accessibilityLabel={`${titulo}: ${n}`}
                    accessibilityState={{ checked: notas[campo] === n }}
                    onPress={() => setNotas(v => ({ ...v, [campo]: n }))}
                    style={{
                      minWidth: 44, minHeight: 44,
                      borderWidth: 1, borderColor: C.verde,
                      borderRadius: 5, alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: notas[campo] === n
                        ? C.verde : "#FFFFFF",
                    }}
                  >
                    <Text style={{
                      color: notas[campo] === n ? "#FFFFFF" : C.verde,
                    }}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Text style={[u.etiqueta, { marginTop: 22 }]}>
            Comentarios opcionales
          </Text>
          <TextInput
            accessibilityLabel="Comentarios sobre la estancia"
            style={[u.input, { minHeight: 90, textAlignVertical: "top" }]}
            multiline maxLength={1000}
            value={comentario} onChangeText={setComentario}
            editable={!ocupado}
          />
          <Boton texto={ocupado ? "Guardando…" : "Enviar evaluación"}
            accion={() => void enviar()} ocupado={ocupado} />
          <Text style={u.nota}>
            Solo se registra una evaluación por estancia.
          </Text>
        </>
      ) : (
        <>
          <Text style={u.texto}>
            La encuesta estará disponible cuando el check-out esté completo.
          </Text>
          <Boton texto="Actualizar disponibilidad"
            accion={() => void consultar()} ocupado={ocupado} />
        </>
      )}

      {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}
    </View>
  );
}
