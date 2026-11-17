# Mi estancia — acceso privado para huéspedes

## Incluye

- Acceso sin contraseña: correo y código real de seis dígitos.
- Sesión de 30 minutos, cookie HttpOnly, SameSite=Strict y Secure cuando
  PUBLIC_ORIGIN comienza con https:// o SESSION_SECURE=1.
- Mis reservas: próximas, historial/canceladas, detalle y comprobante imprimible.
- Mis datos: nombre y teléfono editables; correo solo de lectura.
- Cerrar sesión, errores y vencimiento automático.
- Se conserva la reserva con correo obligatorio, las tres categorías y Telegram.

El cambio de dirección de correo NO se implementa en esta entrega. Se requiere
verificar la dirección nueva y resolver la vinculación de reservas en un cambio
posterior. No se muestran botones que simulen esta operación.

## Instalar en tu proyecto

Extrae este ZIP dentro de /home/lash/HospedaSmartAI. Debe quedar:

    /home/lash/HospedaSmartAI/Hotel_Mi_Estancia/instalar.py

Ejecuta:

    python3 /home/lash/HospedaSmartAI/Hotel_Mi_Estancia/instalar.py

Comprueba las pruebas del servicio público:

    cd /home/lash/HospedaSmartAI/backend/publico-service
    node --check server.mjs
    node --test test/*.test.mjs

Deben pasar 31 pruebas. Si falla el instalador o alguna prueba, no reconstruyas.
El instalador se detiene antes de modificar si encuentra una versión inesperada
de archivos del backend. No repitas instaladores antiguos sobre este cambio.

Si las pruebas pasan, reconstruye tres servicios:

    cd /home/lash/HospedaSmartAI
    docker compose --project-name hospedasmart-stack --env-file stack.env --env-file seguridad.env --env-file publico.env -f compose.estancias.yaml -f compose.ia.yaml -f compose.frontend.yaml -f compose.publico.yaml -f compose.sitio.yaml up -d --build --no-deps huespedes-service publico-service sitio-publico

Abre http://127.0.0.1:8081, recarga con Ctrl+Shift+R y entra a Mi estancia.
Usa EL CORREO DEL HUÉSPED con el que hiciste una reserva. La cuenta Gmail de
correo.env solo envía mensajes; no otorga acceso a todos los huéspedes.

No se necesitan nuevas contraseñas ni cambios en correo.env. El instalador no
modifica secretos, tablas, reservas ni volúmenes. La edición de contacto persiste
en la tabla de huéspedes existente al guardar desde la sesión del dueño del correo.

## Prueba real en tu equipo

1. En Mi estancia solicita código con el correo usado en una reserva.
2. Prueba un código incorrecto: no debe dar acceso.
3. Introduce el código correcto y comprueba que solo salgan tus reservas.
4. Abre un comprobante; revisa habitación, fechas, estado y total.
5. En Mis datos cambia nombre y teléfono. Guarda y comprueba también en admin.
6. Cierra sesión. No debe seguir visible el perfil; volver a entrar pide código.
7. En ventana privada prueba OTRO correo para confirmar separación de datos.
8. Realiza una reserva normal y comprueba email, precio, panel y Telegram.

No compartas códigos, cookies ni contraseñas en capturas o registros.

## Alcance y controles

El backend deriva al huésped del correo verificado; no acepta id ni email en la
edición. Proyecta solo sus reservas y no devuelve IDs de otros huéspedes. No usa
el número de teléfono ni el código de reserva como sesión privada.

Código: 10 minutos, cinco intentos, un uso; reenvío tras 60 segundos, cinco/hora/
correo, diez/hora/IP y límite global compartido de 200 envíos/hora. Las respuestas
antes de verificar no informan si el correo tiene un huésped registrado. Si el
correo verificado aún no tiene huésped, muestra perfil e historial vacíos, sin
crear registros automáticamente.

Token de sesión solo en cookie HttpOnly; no se guarda en localStorage ni se envía
en JSON. Las mutaciones exigen token CSRF y verifican Origin/Sec-Fetch-Site cuando
están presentes. La cookie no tiene Domain y solo aplica a /api/publico/estancia.

Sesiones y retos están en memoria de UNA instancia: reiniciar publico-service
cierra sesiones e invalida códigos pendientes. Se puede entrar otra vez con un
nuevo código. No escalar a varias réplicas sin un almacén compartido.

Para internet configura PUBLIC_ORIGIN con el origen HTTPS exacto. La configuración
local usa HTTP y cookie sin Secure para localhost. No publiques los servicios
internos directamente. El proxy conserva el puerto en Host para validar Origin.

Se añade PATCH /huespedes/:id/contacto al microservicio de huéspedes, permitido
para personal administrador y recepcionista autenticado. Solo cambia nombre y
teléfono, con validación y SQL parametrizado. La puerta pública invoca esa ruta
con su cuenta de servicio, seleccionando el ID en el servidor desde la sesión.

La consulta antigua por código y correo se conserva como alternativa. No se
confunde con una sesión privada. Fotografías/servicios/inventario de prueba del
sitio siguen pendientes de reemplazar por datos reales antes de publicar.

## Validación realizada

- 31 pruebas Node del backend público pasan, incluidas sesión, aislamiento,
  rechazo sin CSRF, rechazo de origen ajeno, id/email no permitidos, persistencia
  simulada de contacto, código incorrecto/vencido/reutilizado, logout y expiry.
- Microservicio huéspedes: compilación Nest correcta y 3 pruebas unitarias del
  contacto pasan (normalización, validación y huésped inexistente).
- Frontend: TypeScript y compilación Vite correctos.
- DOM con React y API simulada: login correcto/incorrecto, edición con CSRF,
  comprobante propio y logout; regresión de reserva Suite también pasa.
- Instalador probado sobre copia del proyecto y pruebas backend después del
  parche. SQL y correo reales pendientes de validar en tu máquina.
- Falta verificación visual con navegador real y pruebas contra tu stack local.

## Restaurar si hace falta

El instalador imprime respaldos/antes_mi_estancia_FECHA. Ejecuta:

    python3 /home/lash/HospedaSmartAI/Hotel_Mi_Estancia/restaurar.py /home/lash/HospedaSmartAI/respaldos/antes_mi_estancia_FECHA

Usa la ruta EXACTA que te indicó. Se detendrá si detecta cambios posteriores.
Luego reconstruye los mismos tres servicios con el comando de arriba. Restaurar
el código no revierte cambios de contacto que un huésped ya haya guardado, ni
borra reservas ni bases de datos.

## Código fuente

fuente/ contiene React/Vite editable. El sitio compilado está incluido: no necesitas
instalar dependencias del frontend para aplicarlo. Para futuros cambios:

    cd fuente
    npm ci
    npx tsc --noEmit
    npm run build

Copia fuente/dist a backend/sitio-publico/dist y reconstruye sitio-publico.
