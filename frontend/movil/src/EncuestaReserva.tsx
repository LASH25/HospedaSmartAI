import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { Boton, C, u } from "./PaginasPublicas";

const preguntas = [
  ["facilidad", "¿Qué tan fácil fue reservar?"],
  ["claridad", "¿Qué tan clara fue la información?"],
  ["satisfaccion", "¿Qué tan satisfecho quedaste con el proceso?"],
] as const;

type Campo = typeof preguntas[number][0];

export default function EncuestaReserva({ token }: { token?: string }) {
  const [notas, setNotas] = useState<Record<Campo, number>>({
    facilidad: 0, claridad: 0, satisfaccion: 0,
  });
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState("");
  const bloqueo = useRef(false);

  async function enviar() {
    if (bloqueo.current || !token) return;
    if (Object.values(notas).some(n => n < 1 || n > 5)) {
      setError("Selecciona una calificación para cada pregunta.");
      return;
    }
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      await api("encuestas/reserva", {
        token, ...notas, comentario: comentario.trim(),
      });
      setEnviada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  if (!token) {
    return <Text style={u.nota}>La encuesta no está disponible para este comprobante.</Text>;
  }
  if (enviada) {
    return (
      <View style={{ marginTop: 24 }}>
        <Text style={u.etiqueta}>¡Gracias por compartir tu opinión!</Text>
        <Text style={u.texto}>Tu respuesta quedó registrada.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={u.titulo}>¿Cómo fue tu experiencia al reservar?</Text>
      <Text style={u.texto}>
        Encuesta opcional. 1 es la calificación más baja y 5 la más alta.
      </Text>
      {preguntas.map(([campo, pregunta]) => (
        <View key={campo} style={{ marginTop: 22 }}>
          <Text style={u.etiqueta}>{pregunta}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} disabled={ocupado}
                accessibilityRole="radio"
                accessibilityLabel={`${pregunta}: ${n}`}
                accessibilityState={{ checked: notas[campo] === n }}
                onPress={() => setNotas(v => ({ ...v, [campo]: n }))}
                style={{
                  minWidth: 44, minHeight: 44, borderWidth: 1,
                  borderColor: C.verde, borderRadius: 5,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: notas[campo] === n ? C.verde : "#FFFFFF",
                }}>
                <Text style={{
                  color: notas[campo] === n ? "#FFFFFF" : C.verde,
                }}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Text style={[u.etiqueta, { marginTop: 22 }]}>Comentarios opcionales</Text>
      <TextInput
        accessibilityLabel="Comentarios de la encuesta"
        style={[u.input, { minHeight: 90, textAlignVertical: "top" }]}
        multiline maxLength={1000} editable={!ocupado}
        value={comentario} onChangeText={setComentario}
      />
      {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}
      <Boton texto={ocupado ? "Enviando…" : "Enviar opinión"}
        accion={() => void enviar()} ocupado={ocupado} />
      <Text style={u.nota}>
        Puedes salir sin responder. Tu reserva ya está registrada.
      </Text>
    </View>
  );
}
