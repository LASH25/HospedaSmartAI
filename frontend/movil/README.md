# Hotel 5 Letras — App móvil

Aplicación nativa en React Native y Expo SDK 58, conectada al backend
de HospedaSmartAI.

## Funciones

- Inicio, habitaciones, disponibilidad y reservas.
- Verificación del correo mediante código.
- Mi estancia: reservas, comprobante y edición de perfil.
- Llave QR de acceso simulado durante la estancia.
- Solicitudes de toallas, limpieza y mantenimiento.
- Encuestas del proceso de reserva y de estancia.
- Ayuda con asistente y sección de ubicación.

Las fotografías y tarifas están identificadas como demostración.
La ubicación real del hotel está pendiente de confirmar.
El QR no abre una cerradura física.

## Configuración

Crear localmente .env a partir de .env.example y configurar:

EXPO_PUBLIC_API_URL=https://TU-DOMINIO-PUBLICO

Esta URL es pública. Nunca colocar contraseñas, tokens de servicios,
credenciales de Mercado Pago ni claves de Facturapi en variables EXPO_PUBLIC.

## Ejecutar

Desde frontend/movil:

```bash
npm ci
npx expo start --tunnel ngrok --port 8082
```

Abrir el QR con Expo Go compatible con SDK 58.
Mantener activos el backend y el túnel HTTPS del hotel.
El túnel de Expo y el túnel del hotel cumplen funciones diferentes.

## Comprobaciones realizadas

```bash
npx eslint .
npx tsc --noEmit
npx expo-doctor
npm audit --omit=dev
```

Expo Doctor: 20 de 20 controles correctos.
ESLint y TypeScript: sin errores.
Auditoría sin dependencias de desarrollo: cero vulnerabilidades
en la revisión realizada el 18 de noviembre de 2026.

Se comprobó la exportación del bundle Android:

```bash
npx expo export --platform android --output-dir dist
```

Esta exportación no genera un APK instalable.

## Dependencias

Se fijó minimatch 11.0.1 mediante un override limitado a
@expo/fingerprint. Se verificaron la generación de fingerprint,
TypeScript y la exportación Android.

La auditoría completa conserva dos avisos moderados asociados a
uuid y @expo/ngrok, utilizados por el túnel de desarrollo.
No se aplicó npm audit fix --force.

## Pruebas funcionales

Se verificaron en Android el acceso, la creación de una reserva,
el QR simulado, las solicitudes con actualización de estados y
la encuesta de una estancia finalizada.

Los pagos y la facturación TEST se gestionan actualmente desde
el panel administrativo web. La app no muestra todavía el saldo de cobros.

## Entrega

El proyecto se ha probado mediante Expo Go.
La generación y prueba de un APK independiente quedan pendientes.
