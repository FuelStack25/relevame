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

/**
 * Resumen de los relevos de una semana (lunes a sábado) para el grupo del equipo:
 *   *Relevos de la semana · 30 nov – 5 dic*
 *   *Lun 30 nov*
 *   • 07:00 Despierta Onda — cubre Paula Rojas (por Andrés Pinto)
 */
function mensajeResumenSemana(lunes) {
  const sabado = sumarDias(lunes, 5);
  const relevos = datos.relevos
    .filter(r => r.fecha >= lunes && r.fecha <= sabado)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio));
  const titulo = `*Relevos de la semana · ${rangoCorto(lunes, sabado)}*`;
  const firma = "— Coordinación Onda Viva";
  if (!relevos.length) return `${titulo}\nEsta semana no hay relevos registrados: todo el equipo al aire. 🎙️\n${firma}`;

  const linea = r => {
    const programa = nombrePrograma(datos, r.programaId);
    const falta = nombrePersona(datos, r.titularId);
    if (r.estado === "cubierto") return `• ${r.inicio} ${programa} — cubre ${nombrePersona(datos, r.relevoId)} (por ${falta})`;
    if (r.estado === "pendiente") return `• ${r.inicio} ${programa} — ⚠️ se busca relevo (falta ${falta})`;
    return `• ${r.inicio} ${programa} — ❌ no salió al aire (faltó ${falta})`;
  };

  const partes = [titulo];
  let dia = "";
  for (const r of relevos) {
    if (r.fecha !== dia) {
      dia = r.fecha;
      const corta = fechaCorta(dia);
      partes.push(`\n*${corta[0].toUpperCase() + corta.slice(1)}*`);
    }
    partes.push(linea(r));
  }
  const pendientes = relevos.filter(r => r.estado === "pendiente").length;
  partes.push("");
  partes.push(pendientes
    ? `Faltan ${pendientes === 1 ? "1 relevo" : `${pendientes} relevos`} por cubrir. ¿Quién puede ayudar? Respondan aquí. 🙏`
    : "Todo cubierto esta semana. ¡Gracias, equipo! 🙌");
  partes.push(firma);
  return partes.join("\n");
}

/** Mensaje para el grupo del equipo: "se busca relevo". */
function mensajeAvisarEquipo(r) {
  const frase = fraseRelevo(r); // termina en "a. m." o "p. m.": no se le agrega otro punto
  return `Se busca relevo: ${frase}${frase.endsWith(".") ? "" : "."} ` +
    `Falta ${nombrePersona(datos, r.titularId)}. ¿Quién puede cubrir?\n— Coordinación Onda Viva`;
}
