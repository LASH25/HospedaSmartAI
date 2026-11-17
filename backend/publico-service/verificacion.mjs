import { randomBytes, randomInt, createHmac, timingSafeEqual } from 'node:crypto';
export class VerificacionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function identidad(b) {
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim().replace(/\s+/g, ' ') : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const telefono = typeof b.telefono === 'string' ? b.telefono.trim() : '';
  if (nombre.length < 2 || nombre.length > 100 || !/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(nombre) ||
      email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
      telefono.length < 7 || telefono.length > 20 || !/^[0-9+() .-]+$/.test(telefono))
    throw new VerificacionError(400, 'Revisa tu nombre, correo y teléfono.');
  return { nombre, email, telefono };
}
export function crearVerificacion({ enviar, limitar, ahora = Date.now }) {
  const retos = new Map(), pases = new Map(), clave = randomBytes(32);
  const hash = (s) => createHmac('sha256', clave).update(s).digest();
  const firma = (b) => hash(JSON.stringify(identidad(b))).toString('hex');
  const limpiar = () => {
    for (const mapa of [retos, pases]) for (const [k,v] of mapa) if (v.vence <= ahora()) mapa.delete(k);
  };
  async function solicitar(b, ip) {
    const datos = identidad(b);
    if (b.sitio_web) throw new VerificacionError(400, 'Solicitud no válida.');
    limitar(`correo-ip:${ip}`, 10, 3600000);
    limitar(`correo-email:${datos.email}`, 5, 3600000);
    limitar(`correo-espera:${datos.email}`, 1, 60000);
    limitar('correo-global', 200, 3600000);
    limpiar();
    if (retos.size >= 2000) throw new VerificacionError(503, 'Intenta más tarde.');
    const id = randomBytes(24).toString('hex'), codigo = String(randomInt(1000000)).padStart(6, '0');
    // Invalida códigos previos para el mismo correo, incluso si el envío anterior sigue pendiente.
    for (const [k,v] of retos) if (v.email === datos.email) retos.delete(k);
    retos.set(id, { email: datos.email, firma: firma(datos), hash: hash(id + codigo), intentos: 0, vence: ahora()+600000, listo: false });
    try { await enviar(datos.email, codigo); }
    catch { retos.delete(id); throw new VerificacionError(503, 'No pudimos enviar el código. Espera un minuto e intenta de nuevo.'); }
    const reto = retos.get(id);
    if (!reto) throw new VerificacionError(400, 'Solicita un nuevo código.');
    reto.listo = true;
    return { verificacion_id: id, vence_en: 600, reenviar_en: 60 };
  }
  function confirmar(b, ip) {
    limitar(`verificar-ip:${ip}`, 30, 3600000);
    limpiar();
    const r = retos.get(b.verificacion_id);
    if (!r || !r.listo || r.intentos >= 5) throw new VerificacionError(400, 'Código inválido o vencido. Solicita uno nuevo.');
    r.intentos++;
    if (typeof b.codigo !== 'string' || !/^\d{6}$/.test(b.codigo) || r.firma !== firma(b) ||
        !timingSafeEqual(r.hash, hash(b.verificacion_id + b.codigo))) {
      if (r.intentos >= 5) retos.delete(b.verificacion_id);
      throw new VerificacionError(400, 'Código inválido o vencido.');
    }
    retos.delete(b.verificacion_id);
    const token = randomBytes(32).toString('hex');
    pases.set(hash(token).toString('hex'), { firma: r.firma, vence: ahora()+900000, ocupado:false });
    return { verificacion_token: token, vence_en: 900 };
  }
  function autorizar(b) {
    limpiar();
    if (typeof b.verificacion_token !== 'string' || !/^[a-f0-9]{64}$/.test(b.verificacion_token))
      throw new VerificacionError(403, 'Verifica tu correo antes de reservar.');
    const k = hash(b.verificacion_token).toString('hex'), p = pases.get(k);
    if (!p || p.ocupado || p.firma !== firma(b)) throw new VerificacionError(403, 'Verifica nuevamente tu correo y tus datos antes de reservar.');
    p.ocupado = true;
    return (exito) => { if (exito) pases.delete(k); else p.ocupado = false; };
  }
  return { solicitar, confirmar, autorizar };
}
export function crearEnvioGmail(cfg) {
  let transporte;
  return async (email, codigo, proposito = "reserva") => {
    if (!cfg.gmailUsuario || !cfg.gmailClave) throw new Error('Correo no configurado');
    if (!transporte) {
      const { default: nodemailer } = await import('nodemailer');
      transporte = nodemailer.createTransport({ host:'smtp.gmail.com', port:465, secure:true,
        auth:{ user:cfg.gmailUsuario, pass:cfg.gmailClave },
        connectionTimeout:10000, greetingTimeout:10000, socketTimeout:15000, logger:false, debug:false });
    }
    const r = await transporte.sendMail({ from: {name:'Hotel 5 Letras', address:cfg.gmailUsuario}, to:email,
      subject:proposito === 'acceso' ? 'Accede a Mi estancia · Hotel 5 Letras' : 'Confirma tu correo · Hotel 5 Letras',
      text:`${proposito === "acceso" ? "Tu código para acceder a Mi estancia" : "Tu código para verificar tu correo"} es: ${codigo}\n\nVence en 10 minutos. No lo compartas. Si no lo solicitaste, ignora este mensaje.\n${proposito === "acceso" ? "Este código permite consultar tus datos y reservas. No lo compartas con nadie." : "Verificar tu correo no aparta una habitación ni crea una reserva."}` });
    if (!r.accepted?.length) throw new Error('Envío rechazado');
  };
}
