import { useRef, useState } from "react";
import {
  Image, ImageBackground, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { api } from "./api";

export const C = {
  verde: "#173F35", crema: "#F7F4EC",
  oro: "#B18A50", borde: "#DED7C8", texto: "#626F67",
};

export function Boton({
  texto, accion, ocupado = false,
}: { texto: string; accion: () => void; ocupado?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={accion}
      disabled={ocupado}
      style={[u.boton, ocupado && { opacity: 0.5 }]}>
      <Text style={u.botonTexto}>{texto}</Text>
    </Pressable>
  );
}

export function Inicio({
  reservar, estancia, habitaciones,
}: {
  reservar: () => void;
  estancia: () => void;
  habitaciones: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={u.pagina}>
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1739520081275-f893dc11fbd6?auto=format&fit=crop&w=1000&q=80" }}
        style={u.hero}
        imageStyle={{ borderRadius: 12 }}
      >
        <View style={u.sombra}>
          <Text style={[u.ceja, { color: "#DBC397" }]}>UNA PAUSA EN EL CAMINO</Text>
          <Text style={u.heroTitulo}>Descansa como{"\n"}si estuvieras en casa.</Text>
          <Text style={{ color: "#FFFFFF", lineHeight: 23 }}>
            Una estancia sencilla, cálida y personal.
          </Text>
        </View>
      </ImageBackground>
      <Text style={u.nota}>Fotografía de referencia.</Text>

      <View style={u.tarjeta}>
        <Text style={u.ceja}>ELIGE TUS FECHAS</Text>
        <Text style={u.titulo}>Tu próximo descanso</Text>
        <Text style={u.texto}>
          Consulta disponibilidad y precio para tus fechas antes de reservar.
        </Text>
        <Boton texto="Consultar fechas y reservar" accion={reservar} />
      </View>

      <Text style={u.ceja}>HOTEL 5 LETRAS</Text>
      <Text style={u.titulo}>Lo esencial,{"\n"}bien cuidado.</Text>
      <Text style={[u.texto, { marginBottom: 24 }]}>
        Un espacio de descanso con una propuesta honesta y acogedora.
        Los horarios, servicios y políticas definitivos están pendientes de confirmar.
      </Text>

      <Image
        source={{ uri: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=900&q=80" }}
        style={u.foto}
        accessibilityLabel="Habitación de referencia"
      />
      <Text style={u.nota}>Imagen de referencia, no fotografía del inventario.</Text>
      <View style={u.tarjeta}>
        <Text style={u.titulo}>Una habitación para cada estancia</Text>
        <Text style={u.texto}>Sencilla, Doble y Suite. Tres categorías de demostración.</Text>
        <Boton texto="Ver habitaciones" accion={habitaciones} />
      </View>

      <View style={[u.tarjeta, { backgroundColor: C.verde }]}>
        <Text style={[u.titulo, { color: C.crema }]}>¿Ya tienes una reserva?</Text>
        <Text style={[u.texto, { color: "#DAE3DC" }]}>
          Consulta tus reservas y solicita servicios desde Mi estancia.
        </Text>
        <Boton texto="Ir a Mi estancia" accion={estancia} />
      </View>
    </ScrollView>
  );
}

export function Habitaciones({ reservar }: { reservar: () => void }) {
  const categorias = [
    { nombre: "Sencilla", capacidad: 1, precio: 500,
      descripcion: "Una opción para viajar por tu cuenta." },
    { nombre: "Doble", capacidad: 2, precio: 800,
      descripcion: "Espacio para una estancia de una o dos personas." },
    { nombre: "Suite", capacidad: 4, precio: 1400,
      descripcion: "Una opción para grupos de hasta cuatro personas." },
  ];
  return (
    <ScrollView contentContainerStyle={u.pagina}>
      <Text style={u.ceja}>ELIGE TU ESTANCIA</Text>
      <Text style={u.titulo}>Nuestras habitaciones</Text>
      <Text style={[u.texto, { marginBottom: 20 }]}>
        Inventario de demostración. El precio final se consulta para tus fechas.
      </Text>
      {categorias.map(c => (
        <View style={u.tarjeta} key={c.nombre}>
          <View style={u.imagenPendiente}>
            <Text style={{ color: C.oro, fontSize: 30 }}>H5L</Text>
            <Text style={u.nota}>Fotografía pendiente</Text>
          </View>
          <Text style={u.titulo}>{c.nombre}</Text>
          <Text style={u.texto}>Hasta {c.capacidad} persona(s)</Text>
          <Text style={u.texto}>{c.descripcion}</Text>
          <Text style={u.nota}>Camas y servicios por confirmar.</Text>
          <Text style={u.precio}>${c.precio.toLocaleString("es-MX")} MXN</Text>
          <Text style={u.nota}>Tarifa de prueba por noche.</Text>
          <Boton texto="Consultar fechas" accion={reservar} />
        </View>
      ))}
    </ScrollView>
  );
}

export function Ayuda() {
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const bloqueo = useRef(false);

  async function preguntar() {
    if (bloqueo.current) return;
    setError("");
    if (pregunta.trim().length < 3) {
      setError("Escribe una pregunta de al menos tres caracteres.");
      return;
    }
    bloqueo.current = true;
    setOcupado(true);
    setRespuesta("");
    try {
      const r = await api<{ respuesta: string }>(
        "asistente", { pregunta: pregunta.trim() },
      );
      setRespuesta(r.respuesta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  const preguntas = [
    "¿Cuáles son los horarios de entrada y salida?",
    "¿Qué servicios ofrece el hotel?",
    "¿Cuál es la política de cambios y cancelaciones?",
    "¿Cómo puedo consultar mi reserva?",
  ];

  return (
    <ScrollView keyboardShouldPersistTaps="handled"
      contentContainerStyle={u.pagina}>
      <Text style={u.ceja}>ESTAMOS PARA ORIENTARTE</Text>
      <Text style={u.titulo}>Ayuda</Text>
      {preguntas.map((p, i) => (
        <Pressable key={p} style={u.tarjeta} accessibilityRole="button"
          accessibilityState={{ expanded: abierta === i }}
          onPress={() => setAbierta(abierta === i ? null : i)}>
          <Text style={u.etiqueta}>{p}</Text>
          {abierta === i && (
            <Text style={u.texto}>
              {i === 3
                ? "Entra a Mi estancia con el correo de tu reserva y verifica el código que recibirás para consultar tu historial y tus datos."
                : "Información pendiente de confirmar por el hotel."}
            </Text>
          )}
        </Pressable>
      ))}
      <View style={u.tarjeta}>
        <Text style={u.ceja}>ASISTENTE DEL HOTEL</Text>
        <Text style={u.titulo}>¿En qué podemos ayudarte?</Text>
        <Text style={u.texto}>
          Consulta horarios, políticas o servicios. Confirma con recepción
          cualquier dato de demostración.
        </Text>
        <TextInput
          accessibilityLabel="Tu pregunta"
          style={u.input}
          placeholder="Escribe tu pregunta"
          placeholderTextColor="#87938B"
          value={pregunta}
          onChangeText={setPregunta}
          maxLength={500}
          multiline
          editable={!ocupado}
        />
        <Boton texto={ocupado ? "Consultando…" : "Preguntar"}
          accion={() => void preguntar()} ocupado={ocupado} />
        {!!error && <Text accessibilityRole="alert" style={u.error}>{error}</Text>}
        {!!respuesta && <Text selectable style={u.texto}>{respuesta}</Text>}
      </View>
    </ScrollView>
  );
}

export function Ubicacion() {
  return (
    <ScrollView contentContainerStyle={u.pagina}>
      <Text style={u.ceja}>ENCUÉNTRANOS</Text>
      <Text style={u.titulo}>Ubicación</Text>
      <Text style={[u.texto, { marginBottom: 24 }]}>
        La dirección y los datos de llegada se publicarán después de ser confirmados.
      </Text>
      <View style={u.imagenPendiente}>
        <Text style={u.etiqueta}>Mapa pendiente de integración</Text>
        <Text style={u.nota}>Aquí se mostrará la ubicación real del hotel.</Text>
      </View>
      <View style={u.tarjeta}>
        <Text style={u.titulo}>Tu punto de llegada</Text>
        {["Dirección", "Teléfono", "Correo"].map(campo => (
          <View key={campo} style={{ marginBottom: 20 }}>
            <Text style={u.etiqueta}>{campo}</Text>
            <Text style={u.texto}>Pendiente de confirmar</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export const u = StyleSheet.create({
  pagina: { padding: 20, paddingBottom: 40, backgroundColor: C.crema },
  tarjeta: { backgroundColor: "#FFFEFA", borderWidth: 1, borderColor: C.borde, borderRadius: 12, padding: 22, marginBottom: 20 },
  ceja: { color: C.oro, fontSize: 10, letterSpacing: 2, marginBottom: 12 },
  titulo: { color: C.verde, fontFamily: "serif", fontSize: 29, marginBottom: 16 },
  texto: { color: C.texto, fontSize: 15, lineHeight: 24 },
  etiqueta: { color: C.verde, fontSize: 15, fontWeight: "600", marginBottom: 10 },
  boton: { backgroundColor: C.verde, borderColor: C.oro, borderWidth: 1, minHeight: 49, borderRadius: 5, padding: 14, alignItems: "center", justifyContent: "center", marginTop: 16 },
  botonTexto: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
  input: { minHeight: 52, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.borde, borderRadius: 5, padding: 14, color: C.verde, fontSize: 16, marginTop: 16 },
  nota: { fontSize: 12, color: C.texto, lineHeight: 19, marginVertical: 10 },
  precio: { fontFamily: "serif", fontSize: 27, color: C.verde, marginTop: 15 },
  hero: { minHeight: 360, justifyContent: "flex-end", overflow: "hidden", borderRadius: 12 },
  sombra: { backgroundColor: "rgba(10,35,25,0.60)", padding: 25, paddingTop: 70 },
  heroTitulo: { fontFamily: "serif", fontSize: 39, lineHeight: 45, color: "#FFFFFF", marginBottom: 20 },
  foto: { width: "100%", height: 220, borderRadius: 12 },
  imagenPendiente: { minHeight: 170, backgroundColor: "#EAE5D8", borderRadius: 8, padding: 20, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  error: { color: "#9A302C", paddingVertical: 14 },
});
