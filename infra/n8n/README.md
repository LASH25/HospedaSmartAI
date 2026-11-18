# Flujos de n8n

Estas plantillas se importan inactivas y no contienen credenciales,
datos fijados de ejecuciones ni el destinatario personal de recepción.

## Configuración después de importar

1. Asignar las credenciales SMTP y Telegram en cada nodo correspondiente.
2. Reemplazar remitente@example.com por el correo autorizado de SMTP.
3. En bienvenida, configurar CONFIGURAR_CHAT_ID_RECEPCION.
4. Revisar las expresiones del destinatario del huésped y del chat del bot.
5. Conservar o ajustar las rutas de webhook para que coincidan con Compose
   y con backend/sitio-publico/nginx.conf.
6. Revisar las URLs internas si cambian los nombres de servicios.
7. Guardar, publicar y probar cada flujo.

## Archivos

- bienvenida.json: aviso por correo al huésped y Telegram a recepción.
- concierge.json: Telegram, consulta al asistente y respuesta al mismo chat.
- encuesta-checkout.json: invitación por correo después del check-out.

Los identificadores de webhook son rutas de integración, no contraseñas.
No publicar exportaciones de credenciales ni respaldos originales.
