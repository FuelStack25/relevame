/* ==========================================================
   whatsapp.js — Pedir relevos por WhatsApp
   ----------------------------------------------------------
   Hoy los relevos se arreglan por chat. Aquí se arma el
   mensaje listo para enviar, usando los enlaces oficiales
   "wa.me" (no necesita ninguna librería ni conexión especial).
   - Con número: abre el chat de esa persona.
   - Sin número: WhatsApp pide elegir a quién enviarlo.
   ========================================================== */

const CODIGO_PAIS = "57"; // Colombia

/** Deja solo los dígitos y agrega el código del país a celulares de 10 dígitos. */
function numeroWhatsApp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length === 10 ? CODIGO_PAIS + digitos : digitos;
}

/** Enlace de WhatsApp con el texto ya escrito. */
function enlaceWhatsApp(telefono, texto) {
  const numero = numeroWhatsApp(telefono);
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Datos del relevo en una frase: «Despierta Onda», jueves 3 de diciembre, de 7:00 a 8:00 a. m. */
function fraseRelevo(r) {
  const fecha = aFecha(r.fecha);
  return `«${nombrePrograma(datos, r.programaId)}» el ${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}, de ${horario(r.inicio, r.fin)}`;
}

/** Mensaje para pedirle el relevo a UNA persona. */
function mensajePedirRelevo(persona, r) {
  const primerNombre = persona.nombre.split(" ")[0];
  const motivo = r.motivo ? ` (${r.motivo.toLowerCase()})` : "";
  return `Hola ${primerNombre}, ¿puedes cubrir ${fraseRelevo(r)}? ` +
    `Falta ${nombrePersona(datos, r.titularId)}${motivo}. ` +
    `Respóndeme para dejarlo registrado en la bitácora. Gracias.\n— Coordinación Onda Viva`;
}

/** Mensaje para el grupo del equipo: "se busca relevo". */
function mensajeAvisarEquipo(r) {
  const frase = fraseRelevo(r); // termina en "a. m." o "p. m.": no se le agrega otro punto
  return `Se busca relevo: ${frase}${frase.endsWith(".") ? "" : "."} ` +
    `Falta ${nombrePersona(datos, r.titularId)}. ¿Quién puede cubrir?\n— Coordinación Onda Viva`;
}
