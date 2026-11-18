import { useEffect, useState } from "react";
import {
  BackHandler, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MiEstancia from "./src/MiEstancia";
import Reservar from "./src/Reservar";
import {
  Inicio, Habitaciones, Ayuda, Ubicacion, C,
} from "./src/PaginasPublicas";

type Pantalla =
  | "inicio" | "habitaciones" | "reservar"
  | "estancia" | "ayuda" | "ubicacion";

const menu: { id: Pantalla; nombre: string }[] = [
  { id: "inicio", nombre: "Inicio" },
  { id: "habitaciones", nombre: "Habitaciones" },
  { id: "reservar", nombre: "Reservar" },
  { id: "estancia", nombre: "Mi estancia" },
  { id: "ayuda", nombre: "Ayuda" },
  { id: "ubicacion", nombre: "Ubicación" },
];

function HotelApp() {
  const [pantalla, setPantalla] = useState<Pantalla>("inicio");
  const [visitarEstancia, setVisitarEstancia] = useState(false);
  const [visitarReserva, setVisitarReserva] = useState(false);

  function ir(destino: Pantalla) {
    if (destino === "estancia") setVisitarEstancia(true);
    if (destino === "reservar") setVisitarReserva(true);
    setPantalla(destino);
  }

  useEffect(() => {
    const evento = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pantalla === "inicio") return false;
      setPantalla("inicio");
      return true;
    });
    return () => evento.remove();
  }, [pantalla]);

  return (
    <SafeAreaView style={s.fondo}>
      <StatusBar style="dark" />

      {pantalla !== "estancia" && (
        <View style={s.marca}>
          <Text style={s.logo}>H5L</Text>
          <View>
            <Text style={s.nombre}>HOTEL 5 LETRAS</Text>
            <Text style={s.lema}>HOSPITALIDAD LOCAL</Text>
          </View>
        </View>
      )}

      <View style={s.aviso}>
        <Text style={s.avisoTexto}>
          Proyecto académico · Inventario de demostración
        </Text>
      </View>

      <View style={s.contenido}>
        {pantalla === "inicio" && (
          <Inicio
            reservar={() => ir("reservar")}
            estancia={() => ir("estancia")}
            habitaciones={() => ir("habitaciones")}
          />
        )}
        {pantalla === "habitaciones" && (
          <Habitaciones reservar={() => ir("reservar")} />
        )}
        {pantalla === "ayuda" && <Ayuda />}
        {pantalla === "ubicacion" && <Ubicacion />}

        {visitarReserva && (
          <View style={[
            s.panel,
            pantalla !== "reservar" && { display: "none" },
          ]}>
            <Reservar estancia={() => ir("estancia")} />
          </View>
        )}

        {visitarEstancia && (
          <View style={[
            s.panel,
            pantalla !== "estancia" && { display: "none" },
          ]}>
            <MiEstancia />
          </View>
        )}
      </View>

      <View style={s.navegacion}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.menu}>
          {menu.map(item => {
            const seleccionada = pantalla === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: seleccionada }}
                onPress={() => ir(item.id)}
                style={[s.tab, seleccionada && s.tabActiva]}
              >
                <Text style={[s.tabTexto, seleccionada && s.textoActivo]}>
                  {item.nombre}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><HotelApp /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: C.crema },
  contenido: { flex: 1 },
  panel: { flex: 1 },
  marca: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 22, paddingVertical: 16,
    borderBottomWidth: 1, borderColor: C.borde,
  },
  logo: {
    fontFamily: "serif", color: C.oro, fontSize: 24,
    borderWidth: 1, borderColor: C.oro, padding: 8,
  },
  nombre: {
    color: C.verde, fontSize: 14, letterSpacing: 2, fontWeight: "600",
  },
  lema: { color: C.oro, fontSize: 9, letterSpacing: 2, marginTop: 5 },
  aviso: { backgroundColor: "#E8DFCC", padding: 8 },
  avisoTexto: { color: C.verde, fontSize: 10, textAlign: "center" },
  navegacion: {
    borderTopWidth: 1, borderColor: C.borde,
    backgroundColor: "#FFFEFA",
  },
  menu: { padding: 10, gap: 6 },
  tab: {
    minHeight: 46, paddingHorizontal: 16, paddingVertical: 14,
    justifyContent: "center", borderRadius: 6,
  },
  tabActiva: { backgroundColor: C.verde },
  tabTexto: { color: C.verde, fontSize: 13, fontWeight: "500" },
  textoActivo: { color: "#FFFFFF" },
});