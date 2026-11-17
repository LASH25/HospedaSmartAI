// Sitio público de reservas. Sin dependencias. Todo el texto dinámico se inserta con textContent.
(() => {
  "use strict";
  const cfg = window.HS_CONFIG || {};
  const hotel = cfg.hotel || "Hotel 5 Letras";
  const $ = (sel) => document.querySelector(sel);

  const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const aFecha = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const mas = (s, n) => {
    const d = aFecha(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  };
  const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
  const larga = (s) => aFecha(s).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const mayus1 = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

  document.title = `Reserva en línea · ${hotel}`;
  $("#hotel-nombre").textContent = hotel;
  $("#pie-hotel").textContent = hotel;

  const mostrar = (el, texto) => {
    el.textContent = texto;
    el.hidden = false;
  };
  const ocultar = (el) => {
    el.textContent = "";
    el.hidden = true;
  };
  const el = (etiqueta, clase, texto) => {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  };

  async function api(ruta, { method = "GET", cuerpo } = {}) {
    let r;
    try {
      r = await fetch(`/api/publico/${ruta}`, {
        method,
        headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw new Error("No hay conexión. Revisa tu internet e intenta de nuevo.");
    }
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      /* sin cuerpo */
    }
    if (!r.ok) throw new Error((datos && datos.error) || "No pudimos completar la solicitud. Intenta de nuevo.");
    return datos;
  }

  // ---------- fechas y noches ----------
  const entrada = $("#entrada");
  const salida = $("#salida");
  const personas = $("#personas");
  const hoy = iso(new Date());
  entrada.min = hoy;
  entrada.value = mas(hoy, 1);
  salida.value = mas(hoy, 3);

  function actualizarNoches() {
    if (entrada.value && (!salida.value || salida.value <= entrada.value)) salida.value = mas(entrada.value, 1);
    if (entrada.value) salida.min = mas(entrada.value, 1);
    const n = entrada.value && salida.value ? diasEntre(entrada.value, salida.value) : 0;
    $("#noches-n").textContent = n > 0 ? String(n) : "–";
    $("#noches-t").textContent = n === 1 ? "noche" : "noches";
  }
  entrada.addEventListener("change", actualizarNoches);
  salida.addEventListener("change", actualizarNoches);
  actualizarNoches();

  // ---------- disponibilidad ----------
  let busqueda = null;
  const resultados = $("#resultados");

  $("#form-fechas").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#error-fechas");
    ocultar(err);
    const n = entrada.value && salida.value ? diasEntre(entrada.value, salida.value) : 0;
    const p = Number(personas.value);
    if (!entrada.value || entrada.value < hoy) return mostrar(err, "Elige una fecha de llegada desde hoy.");
    if (n < 1) return mostrar(err, "La salida debe ser después de la llegada.");
    if (!Number.isInteger(p) || p < 1 || p > 20) return mostrar(err, "Indica cuántas personas se hospedan (de 1 a 20).");

    const boton = $("#btn-buscar");
    boton.disabled = true;
    boton.textContent = "Buscando…";
    try {
      const q = new URLSearchParams({ fecha_entrada: entrada.value, fecha_salida: salida.value, personas: String(p) });
      const datos = await api(`disponibilidad?${q}`);
      busqueda = { entrada: entrada.value, salida: salida.value, personas: p, noches: datos.noches };
      pintarOpciones(datos.opciones);
    } catch (ex) {
      mostrar(err, ex.message);
    } finally {
      boton.disabled = false;
      boton.textContent = "Ver disponibilidad";
    }
  });

  function pintarOpciones(opciones) {
    resultados.replaceChildren();
    resultados.hidden = false;
    if (!opciones.length) {
      resultados.append(el("p", "vacio", "No hay habitaciones disponibles en esas fechas. Prueba con otras fechas."));
      return;
    }
    resultados.append(el("h2", "resultados-titulo", "Habitaciones disponibles"));
    for (const o of opciones) {
      const fila = el("article", "opcion");
      const izq = el("div");
      izq.append(el("h3", "", o.nombre), el("p", "detalle", `Hasta ${plural(o.capacidad, "persona", "personas")}`));
      const precio = el("div", "precio");
      precio.append(el("span", "precio-label", `Total por ${plural(busqueda.noches, "noche", "noches")}`), el("strong", "", `${MXN.format(o.total)} MXN`), el("span", "", `${MXN.format(o.precio_noche)} MXN por noche`));
      const boton = el("button", "boton", "Reservar");
      boton.type = "button";
      boton.setAttribute("aria-label", `Reservar habitación ${o.nombre}`);
      boton.addEventListener("click", () => abrirReserva(o));
      const visual = el("div", "room-art");
      visual.setAttribute("aria-hidden", "true");
      visual.append(el("span", "room-monogram", "H"), el("span", "room-art-note", "Ilustración"));
      izq.prepend(el("p", "eyebrow", "TU ESTANCIA"));
      fila.append(visual, izq, precio, boton);
      resultados.append(fila);
    }
    resultados.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ---------- reserva ----------
  const dialogo = $("#dialogo");
  const formReserva = $("#form-reserva");
  let opcionElegida = null;
  let turnstileToken = "";
  let turnstileId = null;
  let disparador = null;
  let correoId = "", correoToken = "", correoHasta = 0, correoOcupado = false, reenviarHasta = 0;
  let temporizadorCorreo;
  function etiquetaReserva() {
    return correoToken ? "Confirmar reserva" : correoId ? "Verificar código" : "Enviar código a mi correo";
  }
  function reiniciarCorreo() {
    correoId = ""; correoToken = ""; correoHasta = 0; reenviarHasta = 0;
    clearInterval(temporizadorCorreo);
    $("#paso-correo").hidden = true;
    $("#codigo-correo").value = "";
    $("#estado-correo").textContent = "Primero verificaremos tu correo. Este paso no aparta la habitación.";
    $("#btn-reservar").textContent = etiquetaReserva();
  }
  for (const id of ["#nombre", "#email", "#telefono"]) $(id).addEventListener("input", reiniciarCorreo);
  function refrescarReenvio() {
    const segundos = Math.max(0, Math.ceil((reenviarHasta - Date.now())/1000));
    $("#reenviar-correo").disabled = correoOcupado || segundos > 0;
    $("#reenviar-correo").textContent = segundos ? `Reenviar en ${segundos} s` : "Reenviar código";
  }
  $("#reenviar-correo").addEventListener("click", () => {
    if (correoOcupado || Date.now() < reenviarHasta) return;
    correoId = ""; correoToken = "";
    formReserva.requestSubmit();
  });

  function cargarTurnstile() {
    return new Promise((ok, fallo) => {
      if (window.turnstile) return ok();
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => fallo(new Error("No se pudo cargar la verificación. Recarga la página."));
      document.head.append(s);
    });
  }

  async function prepararTurnstile() {
    if (!cfg.turnstileSiteKey) return;
    try {
      await cargarTurnstile();
      if (turnstileId === null) {
        turnstileId = window.turnstile.render("#turnstile", {
          sitekey: cfg.turnstileSiteKey,
          callback: (t) => (turnstileToken = t),
          "expired-callback": () => (turnstileToken = ""),
          "error-callback": () => (turnstileToken = ""),
        });
      } else {
        window.turnstile.reset(turnstileId);
      }
      turnstileToken = "";
    } catch (ex) {
      mostrar($("#error-reserva"), ex.message);
    }
  }

  function abrirReserva(opcion) {
    opcionElegida = opcion;
    disparador = document.activeElement;
    formReserva.reset();
    reiniciarCorreo();
    for (const i of formReserva.querySelectorAll("input")) i.removeAttribute("aria-invalid");
    ocultar($("#error-reserva"));
    $("#dialogo-reserva").hidden = false;
    $("#dialogo-exito").hidden = true;
    $("#dialogo-titulo").textContent = `Reservar habitación ${opcion.nombre}`;
    $("#resumen").textContent = `${larga(busqueda.entrada)} al ${larga(busqueda.salida)}, ${plural(busqueda.noches, "noche", "noches")}. Total ${MXN.format(opcion.total)}.`;
    dialogo.showModal();
    $("#nombre").focus();
    prepararTurnstile();
  }

  dialogo.addEventListener("cancel", (e) => { if (correoOcupado) e.preventDefault(); });
  function cerrarDialogo() {
    if (correoOcupado) return;
    dialogo.close();
  }
  dialogo.addEventListener("close", () => {
    if (disparador && document.contains(disparador)) disparador.focus();
  });
  $("#cerrar-dialogo").addEventListener("click", cerrarDialogo);
  $("#cerrar-exito").addEventListener("click", cerrarDialogo);
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) cerrarDialogo();
  });

  function invalido(input, mensaje) {
    input.setAttribute("aria-invalid", "true");
    mostrar($("#error-reserva"), mensaje);
    input.focus();
  }

  formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (correoOcupado) return;
    const err = $("#error-reserva");
    ocultar(err);
    for (const i of formReserva.querySelectorAll("input")) i.removeAttribute("aria-invalid");
    const nombre = $("#nombre").value.trim().replace(/\s+/g, " ");
    const email = $("#email").value.trim().toLowerCase();
    const telefono = $("#telefono").value.trim();
    if (nombre.length < 2) return invalido($("#nombre"), "Escribe tu nombre completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalido($("#email"), "Escribe un correo válido, por ejemplo nombre@correo.com.");
    if (telefono.length < 7 || !/^[0-9+() .-]+$/.test(telefono)) return invalido($("#telefono"), "Escribe un teléfono válido, solo con números.");
    if (!correoId && !correoToken && cfg.turnstileSiteKey && !turnstileToken) return mostrar(err, "Completa la verificación de seguridad.");
    if (correoToken && Date.now() >= correoHasta) { reiniciarCorreo(); return mostrar(err, "La verificación venció. Solicita otro código."); }
    if (correoToken && cfg.turnstileSiteKey && !turnstileToken) return mostrar(err, "Completa la verificación de seguridad antes de reservar.");

    const boton = $("#btn-reservar");
    boton.disabled = true;
    correoOcupado = true;
    for (const id of ["#nombre", "#email", "#telefono"]) $(id).readOnly = true;
    refrescarReenvio();
    boton.textContent = "Procesando…";
    try {
      if (!correoToken) {
        const datos = { nombre, email, telefono, sitio_web: $("#sitio_web").value, turnstile: turnstileToken };
        if (!correoId) {
          const r = await api("correo/solicitar", { method:"POST", cuerpo:datos });
          correoId = r.verificacion_id;
          reenviarHasta = Date.now() + r.reenviar_en * 1000;
          $("#paso-correo").hidden = false;
          $("#codigo-correo").value = "";
          $("#estado-correo").textContent = `Enviamos un código a ${email}. Vence en 10 minutos. Revisa también spam.`;
          clearInterval(temporizadorCorreo);
          temporizadorCorreo = setInterval(refrescarReenvio, 1000);
          $("#codigo-correo").focus();
          if (cfg.turnstileSiteKey && window.turnstile && turnstileId !== null) window.turnstile.reset(turnstileId);
          turnstileToken = "";
        } else {
          const codigo = $("#codigo-correo").value.trim();
          if (!/^\d{6}$/.test(codigo)) return mostrar(err, "Escribe los 6 dígitos del correo.");
          const r = await api("correo/confirmar", { method:"POST", cuerpo:{...datos, verificacion_id:correoId, codigo} });
          correoToken = r.verificacion_token;
          correoHasta = Date.now() + r.vence_en * 1000;
          $("#paso-correo").hidden = true;
          clearInterval(temporizadorCorreo);
          $("#estado-correo").textContent = `Correo verificado: ${email}. Revisa el resumen y confirma tu reserva. Cambiar tus datos requiere verificar otra vez.`;
        }
        return;
      }
      const r = await api("reservas", {
        method: "POST",
        cuerpo: {
          verificacion_token: correoToken,
          nombre,
          email,
          telefono,
          tipo: opcionElegida.tipo,
          fecha_entrada: busqueda.entrada,
          fecha_salida: busqueda.salida,
          personas: busqueda.personas,
          sitio_web: $("#sitio_web").value,
          turnstile: turnstileToken,
        },
      });
      reiniciarCorreo();
      $("#exito-codigo").textContent = r.codigo;
      $("#exito-resumen").textContent = `Habitación ${r.tipo_nombre}, del ${larga(r.fecha_entrada)} al ${larga(r.fecha_salida)} (${plural(r.noches, "noche", "noches")}). Total ${MXN.format(r.total)}.`;
      $("#dialogo-reserva").hidden = true;
      $("#dialogo-exito").hidden = false;
      $("#copiar").textContent = "Copiar código";
      $("#copiar").focus();
    } catch (ex) {
      mostrar(err, ex.message);
      if (cfg.turnstileSiteKey && window.turnstile && turnstileId !== null) {
        window.turnstile.reset(turnstileId);
        turnstileToken = "";
      }
    } finally {
      boton.disabled = false;
      correoOcupado = false;
      for (const id of ["#nombre", "#email", "#telefono"]) $(id).readOnly = false;
      refrescarReenvio();
      boton.textContent = etiquetaReserva();
    }
  });

  $("#copiar").addEventListener("click", async () => {
    const boton = $("#copiar");
    try {
      await navigator.clipboard.writeText($("#exito-codigo").textContent);
      boton.textContent = "Código copiado";
    } catch {
      boton.textContent = "Selecciona y copia el código";
    }
  });
  $("#imprimir").addEventListener("click", () => window.print());
  $("#otra").addEventListener("click", () => {
    cerrarDialogo();
    $("#inicio").scrollIntoView({ behavior: "smooth" });
    entrada.focus();
  });

  // ---------- consulta de reserva ----------
  $("#form-consulta").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#error-consulta");
    const ficha = $("#ficha");
    ocultar(err);
    ficha.hidden = true;
    const codigo = $("#c-codigo").value.trim().toUpperCase();
    const email = $("#c-email").value.trim().toLowerCase();
    if (!/^[A-F0-9]{8}$/.test(codigo)) return mostrar(err, "El código tiene 8 caracteres, con números y letras de la A a la F.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostrar(err, "Escribe el correo que usaste al reservar.");
    const boton = $("#btn-consulta");
    boton.disabled = true;
    boton.textContent = "Buscando…";
    try {
      const r = await api(`reservas/${encodeURIComponent(codigo)}?${new URLSearchParams({ email })}`);
      ficha.replaceChildren();
      const datos = [
        ["Estado", mayus1(r.estado)],
        ["A nombre de", r.huesped],
        ["Habitación", r.tipo_nombre || "—"],
        ["Llegada", larga(r.fecha_entrada)],
        ["Salida", larga(r.fecha_salida)],
        ["Total", MXN.format(r.total)],
      ];
      for (const [k, v] of datos) {
        const bloque = el("div");
        bloque.append(el("dt", "", k), el("dd", "", v));
        ficha.append(bloque);
      }
      ficha.hidden = false;
    } catch (ex) {
      mostrar(err, ex.message);
    } finally {
      boton.disabled = false;
      boton.textContent = "Buscar reserva";
    }
  });

  // ---------- asistente ----------
  const conversacion = $("#conversacion");
  const campoPregunta = $("#pregunta");
  const formAsistente = $("#form-asistente");

  async function preguntar(texto) {
    const err = $("#error-asistente");
    ocultar(err);
    const t = texto.trim();
    if (t.length < 3) return mostrar(err, "Escribe una pregunta de al menos 3 caracteres.");
    const boton = $("#btn-pregunta");
    boton.disabled = true;
    campoPregunta.value = "";
    const item = el("li");
    const resp = el("p", "respuesta-texto pensando", "Buscando la respuesta…");
    item.append(el("p", "pregunta-texto", t), resp);
    conversacion.append(item);
    item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    try {
      const r = await api("asistente", { method: "POST", cuerpo: { pregunta: t } });
      resp.className = "respuesta-texto";
      resp.textContent = r.respuesta;
    } catch (ex) {
      resp.className = "respuesta-texto fallo";
      resp.textContent = ex.message;
    } finally {
      boton.disabled = false;
    }
  }
  formAsistente.addEventListener("submit", (e) => {
    e.preventDefault();
    preguntar(campoPregunta.value);
  });
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => preguntar(chip.textContent));
  }
})();
