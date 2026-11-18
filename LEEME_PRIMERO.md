# HospedaSmart AI

Sistema académico de gestión hotelera con microservicios, panel administrativo,
portal de huéspedes y automatizaciones.

Repositorio: https://github.com/LASH25/HospedaSmartAI

Actualizado: 18 de noviembre de 2026.

## Funciones implementadas

- Reservas, cancelación y control transaccional de disponibilidad.
- Check-in y check-out coordinados entre reservas, habitaciones y cobros.
- Huéspedes, consumos, pagos, saldo y cierre de cuentas.
- Autenticación y permisos para administración, recepción y limpieza.
- Portal privado Mi estancia mediante verificación por correo.
- Llave QR de demostración con vigencia de cinco minutos.
- Solicitudes de toallas, limpieza y mantenimiento.
- Encuestas de reserva y estancia.
- Correos de bienvenida e invitación a encuesta después del check-out.
- Asistente con búsqueda FULLTEXT en MySQL y generación con Ollama.
- Atención por Telegram mediante n8n.
- Mercado Pago Checkout Pro con cuentas de prueba, consulta y webhook firmado.

La llave QR simula el acceso: no abre una cerradura física.
La integración de Mercado Pago está limitada a vendedores de prueba.
Los comprobantes actuales no son facturas fiscales CFDI.

## Componentes

| Componente | Ubicación |
|---|---|
| Microservicios | backend/*-service |
| Panel administrativo | frontend |
| Portal de huéspedes: código fuente | Hotel_Mi_Estancia/fuente |
| Servidor del sitio público | backend/sitio-publico |
| Infraestructura y pruebas | backend/infra |
| Esquema inicial | backend/infra/mysql/001-inicializar.sql |
| Tablas auxiliares | backend/infra/mysql/002-estancias-servicios-pagos.sql |

MySQL aloja seis bases lógicas: hs_reservas, hs_habitaciones,
hs_huespedes, hs_cobros, hs_usuarios y hs_asistente.

## Configuración local

Requisitos: Docker con Compose, Python 3 y conexión a internet para descargar
imágenes y dependencias. ngrok permite publicar el sitio desde el equipo local.
Ollama ejecuta el modelo llama3.2:3b.

Los archivos locales de configuración no se incluyen en Git:

| Archivo | Contenido |
|---|---|
| stack.env | Contraseña de MySQL y secreto JWT |
| seguridad.env | Credenciales internas entre servicios |
| publico.env | Cuenta del portal, origen público y protección del formulario |
| correo.env | Remitente Gmail y contraseña de aplicación |
| pagos.env | Credencial de prueba, origen público y secreto del webhook |

Los archivos *.env.example contienen únicamente los nombres de las variables.
Deben completarse localmente con valores propios. Las claves internas deben
ser aleatorias y distintas. PORTAL_EMAIL y PORTAL_PASSWORD deben corresponder
a una cuenta activa de recepción registrada en el sistema.

Una instalación nueva también requiere crear el administrador, configurar
la cuenta de recepción y preparar los flujos y credenciales de n8n.
Los ejemplos de entorno no crean estas cuentas ni esos flujos.

## Arranque de una instalación configurada

Desde la raíz del repositorio:

```bash
docker compose --env-file stack.env --env-file seguridad.env --env-file publico.env \
  -f compose.estancias.yaml -f compose.ia.yaml -f compose.frontend.yaml \
  -f compose.publico.yaml -f compose.sitio.yaml up -d --build
```

Para consultar el estado, utiliza el mismo comando sustituyendo
`up -d --build` por `ps`.

Los SQL se ejecutan en orden al inicializar un volumen MySQL vacío.
Agregar 002 no lo ejecuta automáticamente en un volumen existente.
Para instalaciones anteriores debe aplicarse como actualización controlada,
con respaldo previo. No borres el volumen del hotel para aplicar cambios.

El esquema de 001 es para inicialización; no está diseñado para repetirse.
002 usa CREATE TABLE IF NOT EXISTS: puede repetirse, pero no modifica
estructuras de tablas que ya existan.

## Acceso local

| Componente | Dirección |
|---|---|
| Panel administrativo | http://localhost:8080 |
| Sitio público | http://localhost:8081 |
| n8n | http://localhost:5678 |
| Reservas | http://localhost:3001/salud |
| Habitaciones | http://localhost:3002/salud |
| Huéspedes | http://localhost:3003/salud |
| Usuarios | http://localhost:3004/salud |
| Asistente | http://localhost:3005/salud |
| Cobros | http://localhost:3006/salud |

n8n utiliza su despliegue separado de compose.n8n.yaml.
Ollama debe estar disponible desde asistente-service.

## Publicación temporal

```bash
ngrok http 8081
```

Configura PUBLIC_ORIGIN y MERCADOPAGO_PUBLIC_URL con el origen HTTPS asignado.
Si cambia el dominio, actualiza también las URLs de n8n y Mercado Pago que
dependan de él y recrea los servicios afectados.

La laptop, Docker y ngrok deben permanecer activos para mantener el acceso
público. Ollama debe permanecer activo para generar respuestas del asistente.

## Mercado Pago de prueba

- La credencial del vendedor permanece únicamente en cobros-service.
- El backend calcula el importe a partir del saldo pendiente.
- El comprador utiliza una cuenta y medios de pago de prueba.
- El regreso del navegador no acredita por sí solo un pago.
- Consultar pago verifica la operación directamente con Mercado Pago.
- El webhook público es POST /api/pagos/webhook.
- Las notificaciones se validan mediante firma HMAC.
- Se comprueban vendedor de prueba, referencia, importe, moneda y reembolsos.
- Los reintentos utilizan una clave idempotente para evitar abonos duplicados.

En las pruebas realizadas, Checkout Pro devolvió live_mode=true para
operaciones de cuentas ficticias. La restricción de prueba comprueba
la etiqueta test_user del vendedor.

La URL de notificación debe configurarse en el ambiente que corresponda a
la operación. La verificación realizada requirió configurar también la
URL de producción, manteniendo las cuentas ficticias.

## Pruebas verificadas

| Prueba | Resultado |
|---|---|
| Doce reservas simultáneas para el mismo periodo y habitación | Una aceptada y once conflictos |
| Llave aún vigente asociada a una estancia finalizada | Validación y nueva emisión rechazadas |
| Permisos directos de limpieza | Accesos permitidos y bloqueos 403 verificados |
| Acceso sin sesión a habitaciones | Rechazado con 401 |
| Instalación SQL aislada | 19 tablas creadas en seis bases |
| Segunda ejecución de 002 | Correcta |
| Mercado Pago de prueba | Pago y confirmación automática comprobados |
| Consulta y reenvío de pago | Sin duplicar el abono |

Pruebas automatizadas incluidas:

- backend/reservas-service/test/concurrencia-reservas.mjs
- backend/reservas-service/test/llave-finalizada.mjs
- backend/usuarios-service/test/permisos-limpieza.mjs
- backend/infra/test-esquema.py

La prueba de concurrencia conserva un huésped ficticio y reservas canceladas
como evidencia. La prueba de llave revierte su transacción. La prueba de
permisos elimina el usuario temporal. La prueba SQL elimina su contenedor
aislado y no utiliza el volumen del hotel.

Ejecutar la prueba SQL:

```bash
python3 backend/infra/test-esquema.py
```

## Pendientes y alcance

- Aplicación móvil en React Native.
- Facturación fiscal CFDI.
- Integración con cerraduras físicas.
- Completar las instrucciones de instalación nueva y el empaquetado de
  los flujos n8n sin credenciales ni datos personales.
- Actualizar el documento académico con el estado final.

El despliegue actual corresponde a una demostración académica.


## Preparación de una instalación nueva

Desde la raíz del proyecto, genera los secretos locales:

```bash
python3 backend/infra/preparar-entorno.py
python3 backend/infra/preparar-seguridad.py
```

Los scripts crean stack.env y seguridad.env en la raíz y conservan los
archivos si ya existen. No copies encima los ejemplos vacíos.

Copia los otros ejemplos únicamente si todavía no existen sus archivos:

```bash
python3 -c 'from pathlib import Path; import shutil; [(shutil.copyfile(str(p)+".example",p)) for p in map(Path,["publico.env","correo.env","pagos.env"]) if not p.exists()]'
```

Completa localmente esos archivos antes del arranque:

- PORTAL_EMAIL y PORTAL_PASSWORD: credenciales previstas para la cuenta
  de recepción que crearás en el panel.
- GMAIL_USUARIO y GMAIL_APP_PASSWORD: cuenta remitente y contraseña de aplicación.
- PUBLIC_ORIGIN y MERCADOPAGO_PUBLIC_URL: origen público HTTPS.
- MERCADOPAGO_ACCESS_TOKEN: credencial del vendedor de prueba.
- MERCADOPAGO_WEBHOOK_SECRET: secreto correspondiente al webhook configurado.
- TRUST_PROXY: revisa su valor según el proxy utilizado; Compose usa 0 por defecto.
- TURNSTILE_SECRET: configuración opcional de protección del formulario.

No confirmes estos archivos privados en Git. Los archivos de ejemplo no
contienen valores funcionales.

Después ejecuta el comando de arranque indicado anteriormente y comprueba
la salud de los servicios.

### Crear el administrador

El siguiente comando solicita la contraseña sin mostrarla y la transmite
al proceso del contenedor sin incluirla en los argumentos del comando:

```bash
python3 -c '
import getpass
import os
import subprocess
p = getpass.getpass("Contraseña del administrador (12 a 128 caracteres): ")
if not 12 <= len(p) <= 128:
    raise SystemExit("Longitud inválida.")
entorno = os.environ.copy()
entorno["ADMIN_PASSWORD"] = p
subprocess.run(
    ["docker", "exec", "-e", "ADMIN_PASSWORD",
     "hospedasmart-stack-usuarios-service-1",
     "node", "dist/crear-admin.js"],
    env=entorno, check=True
)
'
```

El correo del administrador es admin@hospedasmart.local.
Si ya existe, el comando conserva la cuenta y su contraseña.

Inicia sesión en el panel administrativo y crea una cuenta con rol
recepcionista cuyos datos coincidan con PORTAL_EMAIL y PORTAL_PASSWORD.
El portal utiliza esa cuenta para comunicarse con los servicios.

### Preparar n8n

Con la pila principal en funcionamiento, crea el volumen externo si aún
no existe y levanta n8n:

```bash
docker volume create hospedasmart_n8n_data
docker compose -p hospedasmart-n8n -f compose.n8n.yaml up -d
```

La red externa hospedasmart-stack_default debe existir previamente.
En una instalación nueva, abre http://localhost:5678 y configura la cuenta
propietaria de n8n.

Configura las credenciales de correo y Telegram dentro de n8n e importa
los flujos disponibles. Las credenciales no se transfieren mediante los
archivos de ejemplo.

Comprueba que las rutas de los webhooks coincidan con:

- N8N_WEBHOOK_URL de publico-service: bienvenida.
- N8N_ENCUESTA_WEBHOOK_URL de reservas-service: encuesta después del check-out.
- La ruta permitida en backend/sitio-publico/nginx.conf: bot de Telegram.

Ajusta WEBHOOK_URL de compose.n8n.yaml al dominio HTTPS propio.
Publica los flujos después de configurar sus credenciales.
