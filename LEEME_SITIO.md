# Sitio público para huéspedes (Fase 2)

Qué hace: página en español para ver disponibilidad, reservar directo, consultar una reserva (código + correo) y preguntar al asistente.
Usa solo `publico-service` (puerto interno 3010). No toca los demás servicios.

## Instalar (desde ~/HospedaSmartAI)
1. Descomprime este zip en esa carpeta (crea `frontend/sitio-publico/servidor/` y `compose.sitio.yaml`).
2. (Opcional) En `publico.env` agrega el nombre de tu hotel:  HOTEL_NOMBRE=Nombre de tu hotel
3. Levanta:

docker compose -f compose.estancias.yaml -f compose.ia.yaml -f compose.frontend.yaml -f compose.publico.yaml -f compose.sitio.yaml --env-file stack.env --env-file seguridad.env --env-file publico.env up -d --build sitio-publico

4. Abre http://127.0.0.1:8081

## Probar
- Elige fechas > "Ver disponibilidad" > Reservar > llena datos. Te da un código de 8 caracteres.
- La reserva aparece en el panel del hotel (:8080).
- "Consulta tu reserva": código + el mismo correo.

## Importante
- Solo se abre en tu computadora (127.0.0.1). A internet sale en la Fase 4 con HTTPS.
- Turnstile (anti-bots): cuando tengas la llave, pon TURNSTILE_SITE_KEY en publico.env (sitio) y TURNSTILE_SECRET (publico-service).
