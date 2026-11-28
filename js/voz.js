/* ==========================================================
   voz.js — Registrar un relevo dictándolo
   ----------------------------------------------------------
   «Laura Gómez no viene mañana a Despierta Onda, cita médica.
    La cubre Andrés Pinto.»  →  se llena el formulario solo.
   Se puede escribir o dictar. Si el servidor tiene IA
   (servidor-ia/), la usa; si no, o si falla, entiende en
   "modo básico" con entenderDictado(). Nunca guarda por su
   cuenta: la coordinadora revisa y toca Guardar.
   entenderDictado() no toca la pantalla: recibe el texto y
   devuelve lo que entendió, así se puede probar por separado.
   ========================================================== */

const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
const Voz = { reconocedor: null, escuchando: false };

function vozDisponible() {
  return Boolean(Reconocimiento);
}

/* ---------- Entender el texto ---------- */

/** "Mañana, Gómez!" → "manana gomez" (sin tildes, sin signos, en minúscula). */
function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const PALABRAS_VACIAS = new Set(["la", "el", "los", "las", "en", "de", "del", "al", "y", "con"]);
const MESES_NORM = MESES.map(normalizar);
const DIAS_NORM = DIAS_LARGOS.map(normalizar);

const MOTIVOS_DICHOS = [
  [/enferm|gripa|gripe|fiebre|incapacid|indispuest/, "Enfermedad"],
  [/cita|medic|doctor|odontolog|examen/, "Cita médica"],
  [/calamidad|fallec|murio|accidente|emergencia|funeral/, "Calamidad"],
  [/permiso|vacacion|viaje|diligencia|tramite/, "Permiso"],
];
const DICE_TITULAR = /no viene|no vino|no puede|no va a venir|no llega|no asiste|no va a estar|falta|falto|faltara|enferm|incapacit|tiene cita|tiene permiso|de vacaciones/g;
const DICE_RELEVO = /cubre|cubrira|cubriria|va a cubrir|puede cubrir|reemplaza|remplaza|reemplazo|remplazo|releva|en su lugar/g;

/** Posiciones donde aparece una expresión regular (para medir cercanías). */
function posiciones(regex, texto) {
  return [...texto.matchAll(regex)].map(m => m.index);
}

/** Personas nombradas en el texto: [{ persona, inicio, fin }], primero por nombre completo. */
function buscarPersonasDichas(datos, texto) {
  const activos = datos.presentadores.filter(p => p.activo);
  const encontradas = [];
  const ocupado = (a, b) => encontradas.some(e => a < e.fin && e.inicio < b);

  // 1) Nombre completo
  for (const persona of activos) {
    const nombre = normalizar(persona.nombre);
    for (const m of texto.matchAll(new RegExp(`\\b${nombre}\\b`, "g"))) {
      encontradas.push({ persona, inicio: m.index, fin: m.index + nombre.length });
    }
  }
  // 2) Solo el primer nombre, si nadie más del equipo se llama igual
  const primeros = {};
  activos.forEach(p => { const n = normalizar(p.nombre).split(" ")[0]; (primeros[n] ||= []).push(p); });
  for (const [nombre, personas] of Object.entries(primeros)) {
    if (personas.length !== 1 || nombre.length < 3) continue;
    for (const m of texto.matchAll(new RegExp(`\\b${nombre}\\b`, "g"))) {
      if (!ocupado(m.index, m.index + nombre.length)) {
        encontradas.push({ persona: personas[0], inicio: m.index, fin: m.index + nombre.length });
      }
    }
  }
  // Una persona cuenta una sola vez (su primera mención)
  const vistas = new Set();
  return encontradas.sort((a, b) => a.inicio - b.inicio).filter(e => !vistas.has(e.persona.id) && vistas.add(e.persona.id));
}

/** Programa nombrado: primero el nombre exacto más largo; si no, todas sus palabras importantes. */
function buscarProgramaDicho(datos, texto) {
  const programas = datos.programas.filter(programaActivo);
  let mejor = null;
  for (const programa of programas) {
    const nombre = normalizar(programa.nombre);
    const i = texto.indexOf(nombre);
    if (i >= 0 && (!mejor || nombre.length > mejor.largo)) mejor = { programa, inicio: i, fin: i + nombre.length, largo: nombre.length };
  }
  if (mejor) return mejor;
  for (const programa of programas) {
    const claves = normalizar(programa.nombre).split(" ").filter(w => !PALABRAS_VACIAS.has(w));
    if (claves.length && claves.every(w => new RegExp(`\\b${w}\\b`).test(texto)) && (!mejor || claves.length > mejor.largo)) {
      mejor = { programa, inicio: -1, fin: -1, largo: claves.length };
    }
  }
  return mejor;
}

/** Fecha dicha: "3 de diciembre", "el viernes", "pasado mañana", "mañana", "hoy", "ayer". */
function buscarFechaDicha(texto, hoy) {
  const base = aFecha(hoy);
  const t = texto.replace(/\bprimero\b/g, "1");

  const conMes = t.match(new RegExp(`\\b(\\d{1,2}) de (${MESES_NORM.join("|")})\\b`));
  if (conMes) {
    const dia = Number(conMes[1]);
    const mes = MESES_NORM.indexOf(conMes[2]);
    let fecha = new Date(base.getFullYear(), mes, dia);
    if (fecha < new Date(base.getFullYear(), base.getMonth() - 2, 1)) fecha = new Date(base.getFullYear() + 1, mes, dia);
    return aISO(fecha);
  }
  if (/\bpasado manana\b/.test(t)) return sumarDias(hoy, 2);
  const dia = t.match(new RegExp(`\\b(${DIAS_NORM.join("|")})\\b`));
  if (dia) {
    const objetivo = DIAS_NORM.indexOf(dia[1]);
    return sumarDias(hoy, ((objetivo - base.getDay() + 7) % 7) || 7); // el próximo con ese nombre
  }
  // "mañana" = día siguiente, pero no "en la mañana" / "por la mañana" / "esta mañana"
  if (/\bmanana\b/.test(t.replace(/\b(la|esta) manana\b/g, " "))) return sumarDias(hoy, 1);
  if (/\bayer\b/.test(t)) return sumarDias(hoy, -1);
  if (/\bhoy\b/.test(t)) return hoy;
  const soloDia = t.match(/\bel (\d{1,2})\b/);
  if (soloDia) {
    let fecha = new Date(base.getFullYear(), base.getMonth(), Number(soloDia[1]));
    if (fecha < base) fecha = new Date(base.getFullYear(), base.getMonth() + 1, Number(soloDia[1]));
    return aISO(fecha);
  }
  return null;
}

/**
 * Convierte lo dictado en datos del formulario.
 * Devuelve { programaId, fecha, fechaDicha, titularId, relevoId, motivo, estado }.
 * Lo que no entienda queda vacío para que la coordinadora lo elija.
 */
function entenderDictado(datos, textoDicho, hoy = hoyISO()) {
  const texto = normalizar(textoDicho);
  const programaDicho = buscarProgramaDicho(datos, texto);
  // Se quita el nombre del programa antes de buscar fechas y personas
  // ("La Mañana en Casa" no es "mañana")
  const resto = programaDicho && programaDicho.inicio >= 0
    ? texto.slice(0, programaDicho.inicio) + " ".repeat(programaDicho.fin - programaDicho.inicio) + texto.slice(programaDicho.fin)
    : texto;

  const fechaDicha = buscarFechaDicha(resto, hoy);
  const fecha = fechaDicha || hoy;

  // ¿Quién falta y quién cubre? Por cercanía a frases como "no viene" o "la cubre"
  const personas = buscarPersonasDichas(datos, resto);
  const cerca = (persona, marcas) => marcas.length ? Math.min(...marcas.map(i => Math.abs(i - persona.inicio))) : Infinity;
  const marcasTitular = posiciones(DICE_TITULAR, resto);
  const marcasRelevo = posiciones(DICE_RELEVO, resto);

  let titular = null;
  let relevo = null;
  if (personas.length === 1) {
    const unica = personas[0];
    if (marcasRelevo.length && cerca(unica, marcasRelevo) < cerca(unica, marcasTitular)) relevo = unica;
    else titular = unica;
  } else if (personas.length > 1) {
    titular = marcasTitular.length
      ? [...personas].sort((a, b) => cerca(a, marcasTitular) - cerca(b, marcasTitular))[0]
      : personas[0];
    const otras = personas.filter(p => p !== titular);
    relevo = marcasRelevo.length ? [...otras].sort((a, b) => cerca(a, marcasRelevo) - cerca(b, marcasRelevo))[0] : otras[0];
  }

  // Sin programa: si quien falta presenta un solo programa ese día, es ese
  let programa = programaDicho ? programaDicho.programa : null;
  if (!programa && titular) {
    const suyos = programasDelDia(datos, fecha).filter(p => p.titularId === titular.persona.id);
    if (suyos.length === 1) programa = suyos[0];
  }

  const motivo = (MOTIVOS_DICHOS.find(([regex]) => regex.test(resto)) || [])[1] || "";
  let estado = "pendiente";
  if (relevo) estado = "cubierto";
  else if (/no salio al aire|nadie (lo |la )?cubrio|quedo sin cubrir|no se cubrio/.test(resto)) estado = "sin-cubrir";

  return {
    programaId: programa ? programa.id : "",
    fecha,
    fechaDicha: Boolean(fechaDicha),
    titularId: titular ? titular.persona.id : (programa ? programa.titularId : ""),
    relevoId: relevo ? relevo.persona.id : "",
    motivo,
    estado,
  };
}

/* ---------- IA (a través del intermediario del servidor) ---------- */

// null = aún no se sabe · true / false = el servidor dijo si tiene la IA activa
const IA = { activa: null };

/** Pregunta al servidor si la IA está configurada. Sin servidor (doble clic en index.html) queda en false. */
async function consultarEstadoIA() {
  if (!location.protocol.startsWith("http")) { IA.activa = false; return; }
  try {
    const respuesta = await fetch("api/ia/estado", { signal: AbortSignal.timeout(4000) });
    IA.activa = respuesta.ok && (await respuesta.json()).activa === true;
  } catch (e) {
    IA.activa = false;
  }
  pintarAvisoDictado();
  document.dispatchEvent(new Event("ia-estado")); // avisa al asistente (asistente.js)
}

/**
 * Le pide a la IA que entienda el texto. Le manda la lista de programas y del
 * equipo (con sus ids) para que responda con datos que la app conoce.
 * El servidor revisa la respuesta; aquí se vuelve a revisar al llenar el formulario.
 */
async function entenderConIA(texto) {
  const hoy = hoyISO();
  const respuesta = await fetch("api/ia/entender", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      texto,
      hoy,
      diaSemana: DIAS_LARGOS[diaSemana(hoy)],
      programas: datos.programas.filter(programaActivo).map(p => ({
        id: p.id, nombre: p.nombre, dias: textoDias(p.dias), inicio: p.inicio, fin: p.fin,
        titular: nombrePersona(datos, p.titularId),
      })),
      personas: datos.presentadores.filter(p => p.activo).map(p => ({ id: p.id, nombre: p.nombre })),
    }),
  });
  const json = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(json.error || `Error ${respuesta.status}`);
  return {
    programaId: json.programaId || "",
    fecha: json.fecha || hoy,
    fechaDicha: Boolean(json.fecha),
    titularId: json.titularId || "",
    relevoId: json.relevoId || "",
    motivo: json.motivo || "",
    estado: json.estado || "pendiente",
    dudas: json.dudas || "",
  };
}

/* ---------- Micrófono y formulario ---------- */

function prepararVoz() {
  const texto = document.getElementById("dictado-texto");
  document.getElementById("boton-entender").addEventListener("click", () => entenderTexto(texto.value));
  // Ctrl + Enter (o Cmd + Enter) en el cuadro también llena el formulario
  texto.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) { evento.preventDefault(); entenderTexto(texto.value); }
  });
  if (vozDisponible()) {
    document.getElementById("boton-dictar").addEventListener("click", () => {
      if (Voz.escuchando) Voz.reconocedor?.stop();
      else empezarDictado();
    });
    document.getElementById("dialogo-relevo").addEventListener("close", () => Voz.reconocedor?.abort());
  }
  consultarEstadoIA();
}

/** Muestra el cuadro solo en relevos nuevos. El micrófono, solo si el navegador lo permite. */
function mostrarDictado(visible) {
  document.getElementById("dictado").hidden = !visible;
  document.getElementById("boton-dictar").hidden = !vozDisponible();
  document.getElementById("dictado-resultado").hidden = true;
  pintarBotonDictar(false);
  pintarAvisoDictado();
}

/** Aviso bajo el cuadro: si se usa IA (y a dónde va el texto) o el modo básico. */
function pintarAvisoDictado() {
  const aviso = document.getElementById("dictado-aviso");
  if (!aviso) return;
  aviso.textContent = IA.activa
    ? "Se entiende con IA (Google Gemini): el texto y los nombres del equipo se envían a ese servicio. Siempre puedes revisar antes de guardar."
    : "Modo básico: entiende frases como «Laura Gómez no viene mañana a Despierta Onda, la cubre Andrés Pinto».";
}

function pintarBotonDictar(escuchando) {
  const boton = document.getElementById("boton-dictar");
  boton.classList.toggle("boton--escuchando", escuchando);
  boton.setAttribute("aria-pressed", String(escuchando));
  boton.querySelector("span").textContent = escuchando ? "Escuchando… toca para terminar" : "Dictar";
}

function mostrarResultadoDictado(html) {
  const caja = document.getElementById("dictado-resultado");
  caja.innerHTML = html;
  caja.hidden = false;
}

function empezarDictado() {
  if (!vozDisponible() || Voz.escuchando) return;
  const reconocedor = new Reconocimiento();
  reconocedor.lang = "es-CO";
  reconocedor.interimResults = true;
  reconocedor.continuous = false;
  const cuadro = document.getElementById("dictado-texto");
  let dicho = "";

  reconocedor.onresult = evento => {
    dicho = [...evento.results].map(r => r[0].transcript).join(" ");
    cuadro.value = dicho; // se ve lo que se va entendiendo
  };
  reconocedor.onerror = evento => {
    const mensajes = {
      "not-allowed": "El navegador no tiene permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones.",
      "service-not-allowed": "El navegador no tiene permiso para usar el micrófono.",
      "no-speech": "No te escuché. Toca de nuevo y habla cerca del micrófono.",
      "audio-capture": "No se encontró un micrófono.",
      "network": "El dictado necesita conexión a internet.",
    };
    if (evento.error !== "aborted") {
      mostrarResultadoDictado(`<p class="error">${icono("i-alerta")}<span>${mensajes[evento.error] || "No se pudo usar el dictado. Escríbelo en el cuadro."}</span></p>`);
    }
  };
  reconocedor.onend = () => {
    Voz.escuchando = false;
    pintarBotonDictar(false);
    if (dicho.trim()) entenderTexto(dicho);
  };

  Voz.reconocedor = reconocedor;
  Voz.escuchando = true;
  pintarBotonDictar(true);
  mostrarResultadoDictado(`<p class="ayuda">Habla ahora. Di quién falta, el programa, el día y, si ya lo sabes, quién cubre.</p>`);
  try { reconocedor.start(); } catch (e) { Voz.escuchando = false; pintarBotonDictar(false); }
}

/** Entiende el texto (con IA si se puede; si no, en modo básico) y llena el formulario. */
async function entenderTexto(texto) {
  const dicho = String(texto || "").trim();
  if (!dicho) {
    mostrarResultadoDictado(`<p class="ayuda">Escribe o dicta primero qué pasó.</p>`);
    document.getElementById("dictado-texto").focus();
    return;
  }
  const boton = document.getElementById("boton-entender");
  let resultado = null;
  let origen = "basico";
  let fallaIA = "";

  if (IA.activa) {
    boton.disabled = true;
    mostrarResultadoDictado(`<p class="ayuda">Entendiendo con IA…</p>`);
    try {
      resultado = await entenderConIA(dicho);
      origen = "ia";
    } catch (e) {
      fallaIA = e.name === "TimeoutError" ? "La IA tardó demasiado" : e.message;
    }
    boton.disabled = false;
  }
  if (!document.getElementById("dialogo-relevo").open) return; // se cerró mientras tanto
  if (!resultado) resultado = entenderDictado(datos, dicho);
  aplicarDictado(dicho, resultado, origen, fallaIA);
}

/** Llena el formulario con lo entendido y muestra qué se llenó y qué falta. */
function aplicarDictado(dicho, r, origen, fallaIA = "") {
  if (r.programaId) { $("f-programa").value = r.programaId; alCambiarPrograma(); }
  $("f-fecha").value = r.fecha;
  if (r.titularId) $("f-titular").value = r.titularId;
  if (r.motivo) $("f-motivo").value = r.motivo;
  marcarEstado(r.estado);
  actualizarDependientes();               // rehace la lista de relevos con el nuevo estado
  if (r.relevoId) $("f-relevo").value = r.relevoId;
  actualizarDependientes();
  ["programaId", "fecha", "titularId", "estado"].forEach(c => Formulario.tocados.add(c));
  if (r.relevoId) Formulario.tocados.add("relevoId");
  const errores = validarRelevo(datos, leerFormulario(), Formulario.editandoId);
  if (r.estado === "pendiente" || errores.relevoId) mostrarSugerencias(true);
  revisarFormulario();

  const programa = buscarPrograma(datos, r.programaId);
  const fila = (ok, etiqueta, valor) =>
    `<li class="${ok ? "dictado__ok" : "dictado__falta"}">${icono(ok ? "i-check" : "i-alerta")}<span><strong>${etiqueta}:</strong> ${valor}</span></li>`;
  const cabecera = origen === "ia"
    ? `<p class="dictado__origen">${icono("i-chispa")} Entendido con IA</p>`
    : `<p class="dictado__origen">Entendido en modo básico${fallaIA ? `<span class="dictado__motivo">· ${esc(fallaIA.replace(/\.$/, ""))}</span>` : ""}</p>`;
  mostrarResultadoDictado(`
    ${cabecera}
    <ul class="dictado__lista">
      ${fila(Boolean(programa), "Programa", programa ? esc(programa.nombre) : "no lo entendí, elígelo abajo")}
      ${fila(true, "Fecha", esc(fechaCorta(r.fecha)) + (r.fechaDicha ? "" : " (no la dijiste: puse hoy)"))}
      ${fila(Boolean(r.titularId), "Falta", r.titularId ? esc(nombrePersona(datos, r.titularId)) : "no lo entendí")}
      ${r.relevoId ? fila(true, "Cubre", esc(nombrePersona(datos, r.relevoId))) : ""}
      ${r.motivo ? fila(true, "Motivo", esc(r.motivo)) : ""}
    </ul>
    ${r.dudas ? `<p class="dictado__duda">${icono("i-alerta")}<span>${esc(r.dudas)}</span></p>` : ""}
    <p class="ayuda">Revisa los datos y toca <strong>Guardar relevo</strong>.</p>`);
}
