# HospedaSmart AI: revisión y primer paquete de arranque

Revisión: 2 de noviembre de 2026. Este paquete complementa el proyecto original; no es el PMS terminado.

## Lo que encontré en tu ZIP

| Componente | Evidencia en el código | Pendiente |
|---|---|---|
| Reservas | Alta, listado, consulta, cancelación; valida fechas, huésped y habitación; bloqueo transaccional para evitar reservas cruzadas | Verificar consultas y concurrencia contra MySQL real; check-in/check-out |
| Habitaciones | Alta, listado, consulta y cambio de estado | Verificar persistencia e integración |
| Huéspedes | Alta, listado y consulta | Edición y otras funciones administrativas |
| Cobros | Apertura y consulta de cuentas; reutiliza cuenta por reserva | Registro de consumos, pagos, saldos y cierre; no hay endpoints para estas operaciones |
| Usuarios | Login, JWT, consulta de perfil, hash scrypt, limitación de intentos y comando para crear administrador | Administración de usuarios y autorización por roles en los demás servicios |
| Asistente | Búsqueda FULLTEXT y registro de preguntas/respuestas | Modelo de IA, contexto hotelero, Telegram y vectores |
| n8n y aplicación móvil | Sin implementación localizada en el ZIP | Desarrollar |

Los cinco AppModule usan MySQL. El Compose principal solo define tres bases PostgreSQL. El Compose MySQL solo define el motor; no define las aplicaciones. Los SQL incluidos usan UUID, TIMESTAMPTZ y otras construcciones de PostgreSQL. No se localizaron esquemas MySQL para reproducir las bases desde cero.

Por ello, que `docker compose ps` no muestre microservicios se explica por la configuración: el archivo principal no los define. La revisión del ZIP no permite saber por qué una base de habitaciones de tu equipo estaba detenida; para eso hacen falta sus logs.

## Qué incorpora este paquete

- `compose.stack.yaml`: cinco aplicaciones y un MySQL con seis bases lógicas. No son seis servidores separados.
- `infra/Dockerfile`: compilación y ejecución de cada servicio con Node 24.
- `infra/mysql/001-inicializar.sql`: esquema MySQL compatible con las consultas encontradas, índices, tabla de bloqueos, búsqueda FULLTEXT y ejemplos identificados como demostración.
- `infra/preparar-entorno.py`: genera claves locales nuevas sin cambiar tus `.env` anteriores.
- `infra/probar-integracion.py`: prueba HTTP secuencial con registros nuevos y comprobaciones de comportamiento. Deja esos registros para inspeccionarlos.

Se usa un proyecto Compose y volumen nuevos (`hospedasmart-stack`). Tus volúmenes anteriores no se migran ni se modifican. Los archivos CSV no se importan automáticamente. Esta configuración es para desarrollo local: utiliza root en MySQL y todavía hay rutas de negocio sin autenticación; antes de desplegar deben implementarse permisos y usuarios de base de datos con privilegios limitados.

## 1. Colocar los archivos

Haz una copia de tu carpeta original, por ejemplo `~/HospedaSmartAI_pruebas`. Descomprime este paquete y copia **el contenido** de `HospedaSmartAI_Arranque` dentro de esa copia, junto a las cinco carpetas de servicios y sus archivos package-lock.json.

La estructura debe quedar así:

```text
HospedaSmartAI_pruebas/
  compose.stack.yaml
  LEEME_PRIMERO.md
  infra/
  reservas-service/
  habitaciones-service/
  huespedes-cobros-service/
  usuarios-service/
  asistente-service/
```

No reemplaces los Compose antiguos ni copies este paquete dentro de un solo microservicio.

## 2. Preparar y levantar

En Ubuntu/WSL, con Docker funcionando e integración con WSL habilitada:

```bash
cd ~/HospedaSmartAI_pruebas
python3 infra/preparar-entorno.py
docker compose --env-file stack.env -f compose.stack.yaml config --quiet
docker compose --env-file stack.env -f compose.stack.yaml up -d --build
docker compose --env-file stack.env -f compose.stack.yaml ps
```

La primera ejecución descarga imágenes e instala dependencias; necesita internet. Si ya hay aplicaciones usando los puertos 3001–3005, detén esas instancias antes de levantar esta copia. No hace falta detener tus PostgreSQL de los puertos 5433–5435.

Espera a que las seis filas aparezcan saludables. Si falla alguna:

```bash
docker compose --env-file stack.env -f compose.stack.yaml logs --tail=100 mysql-stack reservas-service habitaciones-service huespedes-cobros-service usuarios-service asistente-service
```

El SQL de inicialización solo corre al crear el volumen nuevo. Si falla la inicialización, conserva los logs y revisa el problema antes de volver a intentar. No borres volúmenes para corregir errores.

## 3. Ejecutar la prueba de integración

```bash
python3 infra/probar-integracion.py
```

Comprueba salud de los cinco servicios, crea huésped/habitación, reserva dos noches por $1,600, exige HTTP 409 ante cruce de fechas, rechaza fechas invertidas, acepta periodos contiguos, rechaza mantenimiento, abre una cuenta sin duplicarla, cancela una reserva y consulta la fuente documental. Si una comprobación falla, termina mostrando el endpoint y la respuesta recibida. No comprueba pagos reales ni concurrencia de peticiones simultáneas.

## 4. Crear tu administrador

El script original ya incluye la creación del administrador. Introduce una contraseña propia de entre 12 y 128 caracteres sin guardarla en el historial:

```bash
read -rsp 'Contraseña del administrador: ' ADMIN_PASSWORD
printf '\n'
export ADMIN_PASSWORD
docker compose --env-file stack.env -f compose.stack.yaml exec -e ADMIN_PASSWORD usuarios-service node dist/crear-admin.js
unset ADMIN_PASSWORD
```

El correo será `admin@hospedasmart.local`. Si ya existe, el comando conserva la cuenta anterior.

Puedes probar `POST http://localhost:3004/auth/login` en Postman con este JSON, sustituyendo la contraseña:

```json
{"email":"admin@hospedasmart.local","password":"TU_CONTRASEÑA"}
```

Después consulta `GET http://localhost:3004/auth/me` con `Authorization: Bearer TU_ACCESS_TOKEN`. No compartas el token.

## Direcciones

| Servicio | Puerto | Comprobación |
|---|---|---|
| Reservas | 3001 | http://localhost:3001/salud |
| Habitaciones | 3002 | http://localhost:3002/salud |
| Huéspedes y cobros | 3003 | http://localhost:3003/salud |
| Usuarios | 3004 | http://localhost:3004/salud |
| Asistente | 3005 | http://localhost:3005/salud |

## Verificación realizada aquí

- Los cinco servicios compilaron sin errores con TypeScript y las dependencias del ZIP. No se ejecutaron scripts de instalación de esas dependencias.
- Pasaron siete pruebas aisladas de reglas existentes: total por noches, fechas invertidas, fecha inexistente, mantenimiento, huésped inexistente, reutilización de cuenta y respuesta documental sin fuentes. Estas pruebas usan sustitutos de repositorios y no acceden a una base real.
- Se revisó la estructura YAML y la sintaxis Python de este paquete.
- **No hay Docker ni MySQL disponibles en este entorno. No se ha ejecutado el build de las imágenes, validado el SQL en MySQL ni pasado la prueba HTTP de integración.** La configuración queda preparada para comprobarla en tu equipo.

El estado correcto por ahora es «código compilable y paquete de arranque preparado; integración pendiente de ejecución», no «sistema completo funcionando».

## Orden para continuar

1. Ejecutar este arranque y la prueba HTTP; corregir cualquier error real de MySQL o Docker.
2. Verificar persistencia tras reiniciar y hacer una prueba concurrente de reservas para la misma habitación.
3. Completar administración de usuarios y permisos en todos los servicios.
4. Implementar consumos, pagos idempotentes, saldo y cierre de cuentas, con pruebas de importes.
5. Implementar check-in/check-out e impedir cambios incompatibles en reservas y cuentas.
6. Añadir IA y Telegram; después automatizaciones con n8n y aplicación móvil.

El ZIP original contenía archivos `.env`. No se incluyen en este paquete. Si las claves originales se reutilizan en servicios reales, cámbialas y evita compartirlas en próximas entregas.

Para continuar con evidencia, comparte la salida de `ps` y de `python3 infra/probar-integracion.py`; si falla el arranque, comparte los logs eliminando claves y datos personales.
