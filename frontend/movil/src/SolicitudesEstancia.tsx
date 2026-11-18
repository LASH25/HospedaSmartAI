import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "./api";
import { Boton, C, u } from "./PaginasPublicas";

type Tipo = "toallas" | "limpieza" | "mantenimiento";
type Envio = { id: string; tipo: Tipo; detalle: string };
type Solicitud = {
  id: string; tipo: string; detalle: string; estado: string;
};

const etiquetas: Record<string, string> = {
  toallas: "Toallas",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
  pendiente: "Pendiente",
  en_atencion: "En atención",
  completada: "Completada",
};

export default function SolicitudesEstancia({
  codigo, csrf,
}: { codigo: string; csrf: string }) {
  const [tipo, setTipo] = useState<Tipo>("toallas");
  const [detalle, setDetalle] = useState("");
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [ocupado, setOcupado] = useState(true);
  const [pendiente, setPendiente] = useState<Envio | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const bloqueo = useRef(false);
  const envioRef = useRef<Envio | null>(null);

  useEffect(() => {
    let activo = true;
    bloqueo.current = true;
    api<{ solicitudes: Solicitud[] }>(
      "estancia/solicitudes/listar", { codigo }, { csrf },
    )
      .then(r => { if (activo) setLista(r.solicitudes); })
      .catch(e => { if (activo) setError(e.message); })
      .finally(() => {
        if (activo) {
          bloqueo.current = false;
          setOcupado(false);
        }
      });
    return () => { activo = false; };
  }, [codigo, csrf]);

  function confirmarSolicitud(solicitud: Solicitud) {
    setLista(anteriores => [
      solicitud, ...anteriores.filter(x => x.id !== solicitud.id),
    ]);
    envioRef.current = null;
    setPendiente(null);
    setDetalle("");
    setMensaje("Solicitud registrada.");
  }

  async function actualizar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    try {
      const r = await api<{ solicitudes: Solicitud[] }>(
        "estancia/solicitudes/listar", { codigo }, { csrf },
      );
      setLista(r.solicitudes);
      const previa = envioRef.current;
      const confirmada = previa
        ? r.solicitudes.find(x => x.id === previa.id)
        : undefined;
      if (confirmada) confirmarSolicitud(confirmada);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  async function enviar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const envio = envioRef.current ?? {
        id: Crypto.randomUUID(), tipo, detalle: detalle.trim(),
      };
      envioRef.current = envio;
      setPendiente(envio);

      const r = await api<{ solicitud: Solicitud }>(
        "estancia/solicitudes/crear",
        { codigo, ...envio },
        { csrf },
      );
      confirmarSolicitud(r.solicitud);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  return (
    <View style={u.tarjeta}>
      <Text style={u.ceja}>SERVICIOS A HABITACIÓN · {codigo}</Text>
      <Text style={u.titulo}>¿Qué necesitas?</Text>
      <Text style={u.texto}>
        Recepción y el personal del hotel podrán consultar tu solicitud.
      </Text>

      <View style={{ marginVertical: 18, gap: 10 }}>
        {(["toallas", "limpieza", "mantenimiento"] as const).map(valor => (
          <Pressable key={valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: tipo === valor }}
            disabled={ocupado || Boolean(pendiente)}
            onPress={() => setTipo(valor)}
            style={{
              borderWidth: 1, borderColor: C.verde, borderRadius: 5,
              padding: 14,
              backgroundColor: tipo === valor ? C.verde : "#FFFFFF",
              opacity: ocupado || pendiente ? 0.6 : 1,
            }}>
            <Text style={{ color: tipo === valor ? "#FFFFFF" : C.verde }}>
              {etiquetas[valor]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={u.etiqueta}>Detalle opcional</Text>
      <TextInput
        accessibilityLabel="Detalle de la solicitud"
        style={[u.input, { minHeight: 90, textAlignVertical: "top" }]}
        multiline maxLength={1000}
        value={detalle} onChangeText={setDetalle}
        editable={!ocupado && !pendiente}
        placeholder="Por ejemplo: necesito dos toallas."
        placeholderTextColor="#87938B"
      />
      <Boton
        texto={ocupado ? "Procesando…" : pendiente
          ? "Reintentar la misma solicitud" : "Enviar solicitud"}
        accion={() => void enviar()} ocupado={ocupado}
      />
      {pendiente && (
        <Text style={u.nota}>
          Conservamos la solicitud para reintentar sin duplicarla.
          No cierres ni recargues la app hasta confirmar su resultado.
        </Text>
      )}
      {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}
      {!!mensaje && <Text style={u.texto}>{mensaje}</Text>}

      <Text style={[u.titulo, { marginTop: 24 }]}>Mis solicitudes</Text>
      <Boton texto="Actualizar estados"
        accion={() => void actualizar()} ocupado={ocupado} />
      {!ocupado && !lista.length && !error && (
        <Text style={u.nota}>Todavía no tienes solicitudes.</Text>
      )}
      {lista.map(x => (
        <View key={x.id} style={{
          marginTop: 18, paddingTop: 14,
          borderTopWidth: 1, borderColor: C.borde,
        }}>
          <Text style={u.etiqueta}>{etiquetas[x.tipo] ?? x.tipo}</Text>
          <Text style={u.texto}>Estado: {etiquetas[x.estado] ?? x.estado}</Text>
          {!!x.detalle && <Text style={u.texto}>{x.detalle}</Text>}
        </View>
      ))}
      <Text style={u.nota}>
        Para una urgencia, contacta directamente con recepción.
      </Text>
    </View>
  );
}
