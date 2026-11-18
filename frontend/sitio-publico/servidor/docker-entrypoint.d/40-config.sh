#!/bin/sh
# Genera config.js al arrancar el contenedor con el nombre del hotel y la llave pública de Turnstile.
set -eu
limpiar() { printf '%s' "$1" | tr -d '\r\n"\\<>`$' | cut -c1-80; }
HOTEL="$(limpiar "${HOTEL_NOMBRE:-HospedaSmart}")"
SITIO="$(limpiar "${TURNSTILE_SITE_KEY:-}")"
cat > /usr/share/nginx/html/config.js <<JS
window.HS_CONFIG = { hotel: "${HOTEL}", turnstileSiteKey: "${SITIO}" };
JS
