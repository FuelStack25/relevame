/* ==========================================================
   asistente.js — Chat de ayuda con IA
   ----------------------------------------------------------
   Responde dos tipos de preguntas:
   - "¿Cómo hago…?": el servidor le da a la IA un manual corto
     de la app (servidor-ia/servidor.js → MANUAL).
   - "¿Quién / cuántos / cuándo…?": la APP calcula los datos
     (contadores, pendientes, sugeridos con sus reglas) y los
     manda como referencia. La IA solo los explica: no inventa
     cifras ni puede cambiar nada.
   Solo aparece si el servidor tiene la IA activa.
   ========================================================== */

const Asistente = { mensajes: [], esperando: false };
const MAX_MENSAJES_CHAT = 12; // se envían los últimos (preguntas y respuestas)

const PREGUNTAS_SUGERIDAS = [
  "¿Qué falta por cubrir esta semana?",
  "¿Quién ha cubierto más relevos este mes?",
  "¿Cómo registro una ausencia de varios días?",
  "¿Quién podría cubrir el próximo pendiente?",
];

/* ---------- Datos de referencia (los calcula la app, no la IA) ---------- */

function contextoAsistente() {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const lunes = lunesDe(hoy);
  const lineas = [];
  const persona = id => nombrePersona(datos, id);

  lineas.push(`HOY: ${fechaLarga(hoy)} (${hoy}). Semana actual: ${fechaSinAnio(lunes)} al ${fechaSinAnio(sumarDias(lunes, 6))}.`);
  const aire = alAireAhora(datos);
  lineas.push(aire ? `AL AIRE AHORA: «${aire.programa.nombre}» (${aire.programa.inicio}-${aire.programa.fin}).` : "AL AIRE AHORA: nada.");

  lineas.push("\nPROGRAMAS AL AIRE:");
  datos.programas.filter(programaActivo).forEach(p =>
    lineas.push(`- «${p.nombre}»: ${textoDias(p.dias)}, ${p.inicio}-${p.fin}, titular ${persona(p.titularId)}`));

  const r = resumenDelMes(datos, mes);
  lineas.push(`\nRESUMEN DE ${MESES[Number(mes.slice(5)) - 1].toUpperCase()}: ${r.total} relevos registrados, ${r.cubiertos} cubiertos, ` +
    `${r.pendientes} pendientes, ${r.sinCubrir} sin cubrir, ${textoHoras(r.horas)} cubiertas.`);

  // Rankings YA calculados por la app (la IA no suma ni compara: solo lee estas líneas)
  const filasMes = contarPorPersona(datos, mes);
  const filasTotal = contarPorPersona(datos);
  const veces = n => (n === 1 ? "1 vez" : `${n} veces`);
  const ranking = (filas, campo, titulo, unidad) => {
    const maximo = Math.max(0, ...filas.map(f => f[campo]));
    if (maximo <= 0) return `- ${titulo}: nadie.`;
    const lideres = filas.filter(f => f[campo] === maximo).map(f => f.persona.nombre);
    const nombres = lideres.slice(0, 10).join(", ") + (lideres.length > 10 ? ` y ${lideres.length - 10} más` : "");
    return `- ${titulo}: ${unidad(maximo)}` + (lideres.length > 1 ? `, EMPATE entre ${lideres.length} personas: ${nombres}.` : `: ${nombres}.`);
  };
  lineas.push("\nRANKINGS (calculados por la app; úsalos tal cual):");
  lineas.push(ranking(filasMes, "hechos", "Quién CUBRIÓ más relevos este mes", n => `${n} ${n === 1 ? "relevo cubierto" : "relevos cubiertos"}`));
  lineas.push(ranking(filasMes, "horas", "Quién cubrió más horas este mes", n => textoHoras(n)));
  lineas.push(ranking(filasMes, "recibidos", "Quién FALTÓ más este mes (tuvo que ser relevado)", veces));
  lineas.push(ranking(filasTotal, "hechos", "Quién CUBRIÓ más relevos en todo el historial", n => `${n} ${n === 1 ? "relevo cubierto" : "relevos cubiertos"}`));
  lineas.push(ranking(filasTotal, "recibidos", "Quién FALTÓ más en todo el historial", veces));

  // Contador por persona: "cubrió" = reemplazó a otro; "faltó" = otro lo reemplazó a él (no confundir)
  const delMes = Object.fromEntries(filasMes.map(f => [f.persona.id, f]));
  lineas.push("\nCONTADOR POR PRESENTADOR (\"cubrió\" = reemplazó a otro; \"faltó\" = otro lo reemplazó):");
  filasTotal.forEach(f => {
    const m = delMes[f.persona.id] || { hechos: 0, recibidos: 0, horas: 0 };
    lineas.push(`- ${f.persona.nombre}${f.persona.activo ? "" : " (inactivo)"}: este mes cubrió ${m.hechos} (${textoHoras(m.horas)}) y faltó ${veces(m.recibidos)} | ` +
      `en total cubrió ${f.hechos} (${textoHoras(f.horas)}) y faltó ${veces(f.recibidos)}, saldo ${f.saldo > 0 ? "+" : ""}${f.saldo} | ` +
      `esta semana lleva ${f.semana}/${LIMITE_SEMANAL} relevos cubiertos`);
  });

  // Pendientes que aún se pueden cubrir, con los sugeridos que calcula la app con sus reglas
  const todosPorVenir = pendientesPorVenir(datos);
  lineas.push(`\nPENDIENTES POR CUBRIR (${todosPorVenir.length}, del más cercano):`);
  if (!todosPorVenir.length) lineas.push("- Ninguno.");
  todosPorVenir.slice(0, 15).forEach(p => {
    const sugeridos = sugerirRelevos(datos, { ...p, ignorarId: p.id }).filter(s => s.disponible).slice(0, 3)
      .map(s => `${s.persona.nombre} (${s.semana}/${LIMITE_SEMANAL} esta semana)`);
    lineas.push(`- ${fechaCorta(p.fecha)} ${p.inicio}-${p.fin} «${nombrePrograma(datos, p.programaId)}», falta ${persona(p.titularId)}. ` +
      `Sugeridos por la app: ${sugeridos.length ? sugeridos.join(", ") : "nadie disponible"}.`);
  });

  const idsPorVenir = new Set(todosPorVenir.map(p => p.id));
  const vencidos = relevosOrdenados(datos.relevos.filter(x => x.estado === "pendiente" && !idsPorVenir.has(x.id)));
  if (vencidos.length) {
    lineas.push(`\nPENDIENTES QUE YA PASARON SIN ACTUALIZAR (${vencidos.length}):`);
    vencidos.slice(0, 10).forEach(x => lineas.push(`- ${fechaCorta(x.fecha)} «${nombrePrograma(datos, x.programaId)}», faltó ${persona(x.titularId)}`));
  }

  lineas.push("\nRELEVOS REGISTRADOS (los 120 más recientes; fecha | programa | horario | falta | cubre | estado | motivo | observación):");
  relevosOrdenados(datos.relevos).slice(0, 120).forEach(x => lineas.push(
    `- ${x.fecha} (${DIAS_CORTOS[diaSemana(x.fecha)]}) | ${nombrePrograma(datos, x.programaId)} | ${x.inicio}-${x.fin} | ${persona(x.titularId)} | ` +
    `${x.relevoId ? persona(x.relevoId) : "-"} | ${ESTADOS[x.estado].texto} | ${x.motivo || "-"} | ${(x.observaciones || "-").slice(0, 80)}`));
  lineas.push(`(Total de relevos en la bitácora: ${datos.relevos.length}.)`);
  return lineas.join("\n");
}

/* ---------- Pantalla ---------- */

function prepararAsistente() {
  const dialogo = document.getElementById("dialogo-asistente");
  prepararDialogo(dialogo);
  document.getElementById("boton-asistente").addEventListener("click", abrirAsistente);
  document.getElementById("asistente-nuevo").addEventListener("click", () => {
    Asistente.mensajes = [];
    pintarAsistente();
    document.getElementById("asistente-texto").focus();
  });
  document.getElementById("form-asistente").addEventListener("submit", evento => {
    evento.preventDefault();
    preguntar(document.getElementById("asistente-texto").value);
  });
  const texto = document.getElementById("asistente-texto");
  texto.addEventListener("keydown", evento => {
    // Enter envía; Shift + Enter hace un salto de línea
    if (evento.key === "Enter" && !evento.shiftKey) { evento.preventDefault(); preguntar(texto.value); }
  });
  document.getElementById("asistente-mensajes").addEventListener("click", evento => {
    const sugerida = evento.target.closest("[data-pregunta]");
    if (sugerida) preguntar(sugerida.dataset.pregunta);
  });
  // El botón aparece solo cuando el servidor confirma que hay IA
  const mostrarBoton = () => { document.getElementById("boton-asistente").hidden = !IA.activa; };
  document.addEventListener("ia-estado", mostrarBoton);
  mostrarBoton();
}

function abrirAsistente() {
  if (!IA.activa) return;
  pintarAsistente();
  document.getElementById("dialogo-asistente").showModal();
  document.getElementById("asistente-texto").focus();
}

/** Convierte la respuesta en HTML seguro: primero se escapa todo; luego solo negritas y listas. */
function formatoRespuesta(texto) {
  let html = "";
  let enLista = false;
  for (const linea of esc(texto).split("\n")) {
    const item = linea.match(/^\s*[-*•]\s+(.*)$/);
    if (item) {
      if (!enLista) { html += "<ul>"; enLista = true; }
      html += `<li>${item[1]}</li>`;
      continue;
    }
    if (enLista) { html += "</ul>"; enLista = false; }
    if (linea.trim()) html += `<p>${linea}</p>`;
  }
  if (enLista) html += "</ul>";
  return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function pintarAsistente() {
  const caja = document.getElementById("asistente-mensajes");
  const bienvenida = `
    <div class="chat__mensaje chat__mensaje--asistente">
      <p>Hola. Puedo explicarte cómo usar la bitácora o responder preguntas sobre los relevos. Por ejemplo:</p>
      <div class="chat__sugeridas">
        ${PREGUNTAS_SUGERIDAS.map(p => `<button type="button" class="chip" data-pregunta="${esc(p)}">${esc(p)}</button>`).join("")}
      </div>
    </div>`;
  const conversacion = Asistente.mensajes.map(m => m.rol === "usuario"
    ? `<div class="chat__mensaje chat__mensaje--usuario"><p>${esc(m.texto)}</p></div>`
    : `<div class="chat__mensaje chat__mensaje--asistente${m.error ? " chat__mensaje--error" : ""}">${m.error ? `<p>${esc(m.texto)}</p>` : formatoRespuesta(m.texto)}</div>`).join("");
  const escribiendo = Asistente.esperando
    ? `<div class="chat__mensaje chat__mensaje--asistente chat__escribiendo" aria-label="El asistente está escribiendo"><span></span><span></span><span></span></div>`
    : "";
  caja.innerHTML = bienvenida + conversacion + escribiendo;
  caja.scrollTop = caja.scrollHeight;
  document.getElementById("asistente-enviar").disabled = Asistente.esperando;
}

/* ---------- Preguntar ---------- */

async function preguntar(texto) {
  const pregunta = String(texto || "").trim().slice(0, 1500);
  if (!pregunta || Asistente.esperando) return;
  document.getElementById("asistente-texto").value = "";
  Asistente.mensajes.push({ rol: "usuario", texto: pregunta });
  Asistente.esperando = true;
  pintarAsistente();

  try {
    const respuesta = await fetch("api/ia/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        mensajes: Asistente.mensajes.filter(m => !m.error).slice(-MAX_MENSAJES_CHAT).map(({ rol, texto: t }) => ({ rol, texto: t })),
        contexto: contextoAsistente(),
      }),
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(json.error || "No se pudo consultar la IA.");
    Asistente.mensajes.push({ rol: "asistente", texto: json.respuesta });
  } catch (e) {
    Asistente.mensajes.push({
      rol: "asistente", error: true,
      texto: e.name === "TimeoutError" ? "La IA tardó demasiado en responder. Intenta de nuevo." : e.message,
    });
  }
  Asistente.esperando = false;
  pintarAsistente();
  document.getElementById("asistente-texto").focus();
}
