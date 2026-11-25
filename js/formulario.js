/* ==========================================================
   formulario.js — Registrar y editar un relevo
   ----------------------------------------------------------
   Requisitos 01 (formulario), 02 (validaciones),
   03 (máx. 3 por semana) y 05 (sugerir quién cubre).
   Las reglas viven en reglas.js; este archivo solo conecta
   esas reglas con los campos del formulario.
   ========================================================== */

const $ = id => document.getElementById(id);

// Estado interno del formulario
const Formulario = {
  editandoId: null,     // id del relevo que se edita, o null si es nuevo
  tocados: new Set(),   // campos que la persona ya visitó (para no regañar antes de tiempo)
  intentoGuardar: false // después de tocar "Guardar" se muestran todos los errores
};

// Qué campo muestra cada error
const CAMPOS_ERROR = {
  programaId: { input: "f-programa", error: "f-programa-error", nombre: "Programa" },
  fecha:      { input: "f-fecha",    error: "f-fecha-error",    nombre: "Fecha" },
  inicio:     { input: "f-inicio",   error: "f-inicio-error",   nombre: "Horario" },
  titularId:  { input: "f-titular",  error: "f-titular-error",  nombre: "Titular" },
  estado:     { input: "f-estado",   error: "f-estado-error",   nombre: "Estado" },
  relevoId:   { input: "f-relevo",   error: "f-relevo-error",   nombre: "Relevo" },
};

// El campo "fin" comparte el mensaje de error con "inicio"
const nombreError = nombreCampo => (nombreCampo === "fin" ? "inicio" : nombreCampo);

/* ---------- Preparar (una sola vez al cargar la página) ---------- */

function prepararFormulario() {
  const dialogo = $("dialogo-relevo");
  const form = $("form-relevo");
  prepararDialogo(dialogo);

  llenarSelect($("f-motivo"), MOTIVOS.map(m => ({ valor: m, texto: m })), "Sin especificar");

  $("f-programa").addEventListener("change", alCambiarPrograma);

  // Al salir de un campo, se revisa ese campo
  form.addEventListener("focusout", evento => {
    if (!evento.target.name) return;
    Formulario.tocados.add(nombreError(evento.target.name));
    revisarFormulario();
  });

  // Al cambiar cualquier cosa, se actualiza lo que depende de ella
  form.addEventListener("change", evento => {
    if (evento.target.name) Formulario.tocados.add(nombreError(evento.target.name));
    actualizarDependientes();
    // Si se elige a alguien que no puede cubrir (ya tiene 3 esa semana o un
    // choque de horario), se sugiere al instante quién sí puede
    const noPuede = evento.target.id === "f-relevo" && $("f-relevo").value &&
      validarRelevo(datos, leerFormulario(), Formulario.editandoId).relevoId;
    if (noPuede) {
      mostrarSugerencias(true);
      subirEnPanel($("campo-relevo"));
    }
    revisarFormulario();
  });

  form.addEventListener("submit", alGuardar);
  $("boton-sugerir").addEventListener("click", () => mostrarSugerencias(!estanAbiertasSugerencias()));
  $("lista-sugerencias").addEventListener("click", alElegirSugerencia);
  $("resumen-errores").addEventListener("click", evento => {
    const boton = evento.target.closest("[data-ir]");
    if (boton) enfocarCampo(boton.dataset.ir);
  });

  // "Abrir ese relevo" cuando se intenta registrar uno repetido
  form.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-abrir-relevo]");
    if (!boton) return;
    const existente = datos.relevos.find(r => r.id === boton.dataset.abrirRelevo);
    if (existente) abrirFormulario({ relevo: existente });
  });

  $("boton-borrar-relevo").addEventListener("click", async () => {
    const relevo = datos.relevos.find(r => r.id === Formulario.editandoId);
    if (relevo && await pedirConfirmacionBorrado(relevo)) {
      dialogo.close();
      borrarRelevo(relevo.id);
    }
  });
}

/* ---------- Abrir ---------- */

/**
 * Abre el formulario.
 *  - abrirFormulario()                          → relevo nuevo vacío
 *  - abrirFormulario({ valores: { fecha, programaId } }) → nuevo con datos ya puestos
 *  - abrirFormulario({ relevo })                → editar uno existente
 *  - abrirFormulario({ relevo, estado: "cubierto" }) → editar y cambiar ya el estado
 *
 * Si el relevo todavía busca quién cubra, se abren solas las sugerencias:
 * es lo que la coordinadora viene a hacer.
 */
function abrirFormulario({ relevo = null, valores = {}, estado = null } = {}) {
  if (!relevo && !estadoConfiguracion(datos).puedeRegistrar) return avisarQueFaltaConfigurar();
  const form = $("form-relevo");
  form.reset();
  Formulario.tocados.clear();
  Formulario.intentoGuardar = false;
  Formulario.editandoId = relevo ? relevo.id : null;
  $("resumen-errores").hidden = true;
  mostrarSugerencias(false);
  mostrarDictado(!relevo); // dictar por voz: solo en relevos nuevos

  const actual = relevo || {};
  llenarProgramas(actual.programaId);
  llenarPersonas($("f-titular"), "Elige quién falta", actual.titularId);

  if (relevo) {
    $("titulo-form").textContent = "Editar relevo";
    $("boton-borrar-relevo").hidden = false;
    $("f-programa").value = relevo.programaId;
    $("f-fecha").value = relevo.fecha;
    $("f-inicio").value = relevo.inicio;
    $("f-fin").value = relevo.fin;
    $("f-titular").value = relevo.titularId;
    marcarEstado(estado || relevo.estado);
    actualizarDependientes();
    $("f-relevo").value = relevo.relevoId || "";
    $("f-motivo").value = relevo.motivo || "";
    $("f-observaciones").value = relevo.observaciones || "";
  } else {
    $("titulo-form").textContent = "Registrar relevo";
    $("boton-borrar-relevo").hidden = true;
    $("f-fecha").value = valores.fecha || hoyISO();
    marcarEstado(valores.estado || "pendiente");
    if (valores.programaId) {
      $("f-programa").value = valores.programaId;
      alCambiarPrograma();
    }
  }

  actualizarDependientes();
  revisarFormulario();
  const dialogo = $("dialogo-relevo");
  if (!dialogo.open) dialogo.showModal(); // puede estar abierto si se salta a un relevo repetido
  dialogo.querySelector(".panel__cuerpo").scrollTop = 0;

  // ¿Falta quién cubra? → directo a las sugerencias
  const estadoFinal = estadoElegido();
  const buscaRelevo = (relevo || valores.programaId) &&
    (estadoFinal === "pendiente" || (estadoFinal === "cubierto" && !$("f-relevo").value));
  if (buscaRelevo) {
    mostrarSugerencias(true);
    subirEnPanel($("boton-sugerir"), 96); // cerca de arriba, con un poco de contexto encima
    $("boton-sugerir").focus({ preventScroll: true });
  } else {
    $(relevo || valores.programaId ? "f-titular" : "f-programa").focus();
  }

  marcarLimpio($("form-relevo"));
}

/**
 * Desplaza el panel para que el elemento quede cerca de arriba (a `margen` px),
 * dejando ver lo que viene debajo. Solo baja, nunca sube.
 */
function subirEnPanel(elemento, margen = 72) {
  const cuerpo = $("dialogo-relevo").querySelector(".panel__cuerpo");
  const distancia = elemento.getBoundingClientRect().top - cuerpo.getBoundingClientRect().top - margen;
  if (distancia > 0) cuerpo.scrollTop += distancia;
}

/* ---------- Llenar listas ---------- */

function llenarProgramas(seleccionado) {
  const opciones = datos.programas
    .filter(p => programaActivo(p) || p.id === seleccionado) // los retirados solo si se edita uno viejo
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => ({ valor: p.id, texto: `${p.nombre} · ${textoDias(p.dias)}, ${horario(p.inicio, p.fin)}` }));
  llenarSelect($("f-programa"), opciones, "Elige el programa");
  if (seleccionado) $("f-programa").value = seleccionado;
}

/**
 * Llena una lista de personas activas. Si se edita un relevo viejo cuya
 * persona ya está inactiva, también se incluye para no perder el dato.
 * `anotar(persona)` permite agregar un texto al lado del nombre.
 */
function llenarPersonas(select, textoVacio, incluirId = null, excluirId = null, anotar = null) {
  const opciones = datos.presentadores
    .filter(p => (p.activo || p.id === incluirId) && p.id !== excluirId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => ({ valor: p.id, texto: p.nombre + (anotar ? anotar(p) : "") }));
  llenarSelect(select, opciones, textoVacio);
}

/* ---------- Leer lo que hay en el formulario ---------- */

function estadoElegido() {
  const marcado = document.querySelector("#f-estado input:checked");
  return marcado ? marcado.value : "";
}

function marcarEstado(estado) {
  document.querySelectorAll("#f-estado input").forEach(i => { i.checked = i.value === estado; });
}

function leerFormulario() {
  const estado = estadoElegido();
  return {
    programaId: $("f-programa").value,
    fecha: $("f-fecha").value,
    inicio: $("f-inicio").value,
    fin: $("f-fin").value,
    titularId: $("f-titular").value,
    estado,
    relevoId: estado === "cubierto" ? ($("f-relevo").value || null) : null,
    motivo: $("f-motivo").value,
    observaciones: $("f-observaciones").value.trim(),
  };
}

/* ---------- Reacciones a los cambios ---------- */

/** Al elegir un programa se llenan solos el horario y el titular. */
function alCambiarPrograma() {
  const programa = buscarPrograma(datos, $("f-programa").value);
  if (!programa) return;
  $("f-inicio").value = programa.inicio;
  $("f-fin").value = programa.fin;
  llenarPersonas($("f-titular"), "Elige quién falta", programa.titularId);
  $("f-titular").value = programa.titularId;
  if ($("f-fecha").value) Formulario.tocados.add("fecha"); // para avisar ya si no sale ese día
}

/** Actualiza todo lo que depende de otros campos. */
function actualizarDependientes() {
  const r = leerFormulario();
  const estado = estadoElegido();

  // Ayuda del programa
  const programa = buscarPrograma(datos, r.programaId);
  $("f-programa-ayuda").textContent = programa
    ? `Sale ${textoDias(programa.dias)}, de ${horario(programa.inicio, programa.fin)} · Titular: ${nombrePersona(datos, programa.titularId)}`
    : "Al elegirlo se llenan solos el horario y el titular.";

  // Contexto bajo el título: se sigue viendo qué relevo es aunque se baje en el panel
  const contexto = $("contexto-form");
  contexto.textContent = programa && r.fecha
    ? `${programa.nombre} · ${fechaCorta(r.fecha)}${r.inicio && r.fin ? ` · ${r.inicio}–${r.fin}` : ""}`
    : "";
  contexto.hidden = !contexto.textContent;

  // Ayuda del estado y campo "Relevo" solo si está cubierto
  $("f-estado-ayuda").textContent = estado ? ESTADOS[estado].ayuda : "";
  $("campo-relevo").hidden = estado !== "cubierto";

  // Lista de relevos con el cupo semanal de cada persona
  const seleccionado = $("f-relevo").value;
  llenarPersonas($("f-relevo"), "Elige quién cubre", seleccionado || null, r.titularId, persona => {
    if (!r.fecha) return "";
    const n = relevosEnSemana(datos, persona.id, r.fecha, Formulario.editandoId);
    return n >= LIMITE_SEMANAL ? ` — sin cupo (${n}/${LIMITE_SEMANAL})` : ` — ${n}/${LIMITE_SEMANAL} esta semana`;
  });
  $("f-relevo").value = seleccionado && seleccionado !== r.titularId ? seleccionado : "";

  const relevoId = $("f-relevo").value;
  $("f-relevo-ayuda").textContent = relevoId && r.fecha
    ? `${nombrePersona(datos, relevoId)} lleva ${relevosEnSemana(datos, relevoId, r.fecha, Formulario.editandoId)} de ${LIMITE_SEMANAL} relevos en la semana del ${fechaSinAnio(lunesDe(r.fecha))}.`
    : `Máximo ${LIMITE_SEMANAL} relevos por persona en cada semana (lunes a domingo).`;

  // Botón "Avisar al equipo por WhatsApp": solo si sigue pendiente y los datos están completos
  const completo = programa && r.fecha && r.inicio && r.fin && r.fin > r.inicio && r.titularId;
  $("avisar-equipo").hidden = !(estado === "pendiente" && completo);
  if (estado === "pendiente" && completo) $("enlace-avisar-equipo").href = enlaceWhatsApp("", mensajeAvisarEquipo(r));

  if (estanAbiertasSugerencias()) pintarSugerencias();
}

/* ---------- Errores ---------- */

/** Valida y muestra los errores de los campos ya visitados. Devuelve los errores. */
function revisarFormulario() {
  const errores = validarRelevo(datos, leerFormulario(), Formulario.editandoId);

  for (const [clave, campo] of Object.entries(CAMPOS_ERROR)) {
    const mostrar = (Formulario.intentoGuardar || Formulario.tocados.has(clave)) && errores[clave];
    const parrafo = $(campo.error);
    const input = $(campo.input);
    // Si el problema es un relevo repetido, se ofrece abrir el que ya existe
    const repetido = mostrar && clave === "fecha" ? buscarRepetido(datos, leerFormulario(), Formulario.editandoId) : null;
    const abrir = repetido
      ? ` <button type="button" class="enlace" data-abrir-relevo="${repetido.id}">Abrir ese relevo</button>`
      : "";
    // Si la persona elegida no puede y la lista está abierta, se señala hacia ella
    const pista = mostrar && clave === "relevoId" && $("f-relevo").value && estanAbiertasSugerencias()
      ? " Abajo están quienes sí pueden."
      : "";
    parrafo.innerHTML = mostrar ? `${icono("i-alerta")}<span>${esc(errores[clave] + pista)}${abrir}</span>` : "";
    input.setAttribute("aria-invalid", mostrar ? "true" : "false");
    const ayuda = input.id + "-ayuda";
    input.setAttribute("aria-describedby", [document.getElementById(ayuda) ? ayuda : "", campo.error].join(" ").trim());
  }

  // El resumen de arriba solo existe después de intentar guardar
  if (Formulario.intentoGuardar) pintarResumenErrores(errores);
  return errores;
}

function pintarResumenErrores(errores) {
  const caja = $("resumen-errores");
  const claves = Object.keys(errores);
  caja.hidden = claves.length === 0;
  if (!claves.length) return;
  caja.innerHTML = `
    <p class="resumen-errores__titulo">${icono("i-alerta")} Falta corregir ${claves.length === 1 ? "1 dato" : claves.length + " datos"}</p>
    <ul>${claves.map(c => `
      <li><button type="button" class="enlace" data-ir="${c}">${CAMPOS_ERROR[c].nombre}: ${esc(errores[c])}</button></li>`).join("")}
    </ul>`;
}

function enfocarCampo(clave) {
  const input = $(CAMPOS_ERROR[clave].input);
  const enfocable = clave === "estado" ? input.querySelector("input") : input;
  enfocable.focus();
}

/* ---------- Guardar ---------- */

function alGuardar(evento) {
  evento.preventDefault();
  Formulario.intentoGuardar = true;
  const errores = revisarFormulario();

  if (Object.keys(errores).length > 0) {
    // Si el problema es la persona que cubre, se abren las sugerencias
    if (errores.relevoId && estadoElegido() === "cubierto") mostrarSugerencias(true);
    $("resumen-errores").focus();
    return;
  }

  const valores = leerFormulario();
  const programa = buscarPrograma(datos, valores.programaId);

  if (Formulario.editandoId) {
    const i = datos.relevos.findIndex(r => r.id === Formulario.editandoId);
    datos.relevos[i] = { ...datos.relevos[i], ...valores };
  } else {
    datos.relevos.push({ id: nuevoId(), creadoEn: new Date().toISOString(), ...valores });
  }

  guardarCambios();
  $("dialogo-relevo").close();
  avisar(`Relevo guardado: ${programa.nombre}, ${fechaCorta(valores.fecha)}.`);
}

/* ---------- Sugerencias: ¿quién puede cubrir? ---------- */

function estanAbiertasSugerencias() {
  return !$("lista-sugerencias").hidden;
}

function mostrarSugerencias(abrir) {
  $("lista-sugerencias").hidden = !abrir;
  $("boton-sugerir").setAttribute("aria-expanded", String(abrir));
  if (abrir) pintarSugerencias();
}

function pintarSugerencias() {
  const r = leerFormulario();
  const caja = $("lista-sugerencias");

  if (!r.fecha || !r.inicio || !r.fin || r.fin <= r.inicio) {
    caja.innerHTML = `<p class="sugerencias__nota">Primero elige el programa, la fecha y el horario.</p>`;
    return;
  }

  const lista = sugerirRelevos(datos, { ...r, ignorarId: Formulario.editandoId });
  const libres = lista.filter(s => s.disponible);
  const ocupados = lista.filter(s => !s.disponible);

  const fila = s => `
    <li>
      <button type="button" class="sugerencia" data-id="${s.persona.id}" aria-label="Elegir a ${esc(s.persona.nombre)} como relevo">
        <span class="sugerencia__nombre">${esc(s.persona.nombre)}</span>
        ${cupo(s.semana)}
        <span class="sugerencia__dato">${s.mes === 1 ? "1 relevo" : s.mes + " relevos"} este mes · libre a esa hora</span>
        ${icono("i-flecha", "icono sugerencia__flecha")}
      </button>
      <a class="boton-icono boton-icono--whatsapp" href="${esc(enlaceWhatsApp(s.persona.telefono, mensajePedirRelevo(s.persona, r)))}"
         target="_blank" rel="noopener" aria-label="Pedir el relevo a ${esc(s.persona.nombre)} por WhatsApp" title="Pedir por WhatsApp">
        ${icono("i-mensaje")}
      </a>
    </li>`;

  caja.innerHTML = `
    <p class="sugerencias__nota">
      ${libres.length ? `${libres.length} personas pueden cubrir. Primero quienes han cubierto menos este mes. Toca un nombre para elegirlo, o ${icono("i-mensaje", "icono")} para pedírselo por WhatsApp.` : "Nadie del equipo está libre en ese horario."}
    </p>
    <ul class="sugerencias__libres">${libres.slice(0, 6).map(fila).join("")}</ul>
    ${libres.length > 6 ? `<details class="sugerencias__mas"><summary>Ver ${libres.length - 6} más</summary><ul class="sugerencias__libres">${libres.slice(6).map(fila).join("")}</ul></details>` : ""}
    ${ocupados.length ? `
      <details class="sugerencias__mas">
        <summary>No pueden cubrir (${ocupados.length})</summary>
        <ul class="sugerencias__ocupados">
          ${ocupados.map(s => `<li>${icono("i-x")}<strong>${esc(s.persona.nombre)}</strong> ${esc(s.razon)}</li>`).join("")}
        </ul>
      </details>` : ""}
  `;
}

function alElegirSugerencia(evento) {
  const boton = evento.target.closest(".sugerencia");
  if (!boton) return;
  marcarEstado("cubierto");
  actualizarDependientes();
  $("f-relevo").value = boton.dataset.id;
  Formulario.tocados.add("relevoId");
  Formulario.tocados.add("estado");
  mostrarSugerencias(false);
  actualizarDependientes();
  revisarFormulario();
  $("f-relevo").focus();
}
