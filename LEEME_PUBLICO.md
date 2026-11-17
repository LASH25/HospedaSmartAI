# publico-service (fase 1)

Puerta de entrada pública de HospedaSmart. Es lo ÚNICO que se expondrá a internet; los 6 microservicios,
MySQL y Ollama siguen privados. Node 22 sin dependencias externas.

## Qué ofrece
| Ruta | Para qué |
|---|---|
| `GET  /api/publico/disponibilidad?fecha_entrada=AAAA-MM-DD&fecha_salida=AAAA-MM-DD&personas=2` | Tipos de habitación libres, con precio y total (nunca números de habitación) |
| `POST /api/publico/reservas` | Reserva directa: asigna sola una habitación libre del tipo elegido |
| `GET  /api/publico/reservas/CODIGO?email=...` | Consulta con código + correo (si no coinciden: 404 genérico) |
| `POST /api/publico/asistente` | Pregunta al asistente de IA (solo devuelve `{respuesta}`) |
| `GET  /salud` | Estado |

Cuerpo de `POST /api/publico/reservas`:
`{ "nombre", "email", "telefono", "tipo": "individual|doble|suite", "fecha_entrada", "fecha_salida", "personas", "turnstile", "sitio_web": "" }`
(`sitio_web` es un campo trampa para bots: debe ir vacío; `turnstile` solo se exige si configuras el secreto).

## Protecciones incluidas
- Límites por IP (reservas, consultas, asistente, disponibilidad) y tope diario de reservas en línea.
- Máximo de reservas próximas por correo, máximo de noches y de anticipación.
- Validación estricta de nombre, correo, teléfono y fechas. Cuerpos de máx. 10 KB, solo JSON.
- Anti-bots opcional (Cloudflare Turnstile) y campo trampa.
- Asistente: límite de consultas simultáneas, para que nadie sature a Ollama.
- Reservas procesadas de una en una: no se reserva dos veces la misma habitación.
- Errores genéricos hacia afuera; no se reenvía ninguna ruta interna.
- La cuenta de servicio renueva su sesión sola.

Ajustables con variables de entorno: `MAX_NOCHES` (14), `MAX_ANTICIPACION_DIAS` (365),
`MAX_RESERVAS_POR_CORREO` (2), `MAX_RESERVAS_DIA` (100), `LIMITE_RESERVAS_HORA_IP` (5), `LIMITE_ASISTENTE_HORA_IP` (20).

## Instalación (en este orden)
1. Descomprime en tu proyecto:
   `unzip -o ~/Descargas/publico-fase1.zip -d ~/HospedaSmartAI`
2. Crea la **cuenta de servicio** desde tu sistema: *Usuarios → Nuevo usuario*, nombre "Portal público",
   un correo como `portal@tu-hotel.mx`, rol **Recepcionista** y una contraseña larga. Para generarla:
   `openssl rand -base64 24`
3. Crea `publico.env`:
   ```
   cd ~/HospedaSmartAI
   cp publico.env.example publico.env
   chmod 600 publico.env
   ```
   y escribe dentro el correo y la contraseña del paso 2 (ábrelo en VS Code).
4. Levántalo:
   ```
   docker compose -f compose.estancias.yaml -f compose.ia.yaml -f compose.frontend.yaml -f compose.publico.yaml --env-file stack.env --env-file seguridad.env --env-file publico.env up -d --build publico-service
   ```
5. Pruébalo:
   ```
   curl -s http://127.0.0.1:3010/salud
   curl -s "http://127.0.0.1:3010/api/publico/disponibilidad?fecha_entrada=2026-12-20&fecha_salida=2026-12-22&personas=2"
   ```

## Pruebas automáticas (opcional)
`cd backend/publico-service && node --test --test-force-exit test/*.test.mjs` (18 pruebas con servicios simulados).

## Importante
- Nunca publiques el puerto 3010 en internet; en la fase 4 entra solo por el proxy HTTPS.
- `publico.env` tiene la contraseña de la cuenta de servicio: no lo compartas ni lo subas a un repositorio.
- Una reserva creada desde aquí es una reserva real: para probar, usa un nombre obvio ("Prueba Portal")
  y cancélala desde el sistema del hotel.
