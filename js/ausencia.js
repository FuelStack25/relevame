/* ==========================================================
   ausencia.js — Registrar una ausencia de varios días
   ----------------------------------------------------------
   Si alguien falta varios días (incapacidad, vacaciones…),
   en vez de registrar relevo por relevo, se elige la persona
   y las fechas: se crean de una vez los relevos PENDIENTES
   de todos sus programas en ese rango. Antes de guardar se
   muestra una vista previa de lo que se va a crear.
   ========================================================== */

function prepararAusencia() {
  const dialogo = document.getElementById("dialogo-ausencia");
  prepararDialogo(dialogo);
  llenarSelect(document.getElementById("a-motivo"), MOTIVOS.map(m => ({ valor: m, texto: m })), "Sin especificar");

  const form = document.getElementById("form-ausencia");
  form.addEventListener("input", pintarVistaPrevia);
  form.addEventListener("change", pintarVistaPrevia);
  form.addEventListener("submit", evento => {
    evento.preventDefault();
    guardarAusencia();
  });
}

/** Abre el diálogo. Opcional: con una persona ya elegida (desde su ficha). */
function abrirAusencia(personaId = "") {
  if (!estadoConfiguracion(datos).puedeRegistrar) return avisarQueFaltaConfigurar();
  const titulares = new Set(datos.programas.filter(programaActivo).map(p => p.titularId));
  const select = document.getElementById("a-persona");
  const opciones = datos.presentadores
    .filter(p => p.activo && titulares.has(p.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => ({ valor: p.id, texto: p.nombre }));
  llenarSelect(select, opciones, "Elige quién falta");
  select.value = personaId;

  const hoy = hoyISO();
  document.getElementById("a-desde").value = hoy;
  document.getElementById("a-hasta").value = sumarDias(hoy, 4);
  document.getElementById("a-motivo").value = "";
  document.getElementById("a-observaciones").value = "";
  mostrarErroresAusencia({});
  pintarVistaPrevia();

  document.getElementById("dialogo-ausencia").showModal();
  select.focus();
  marcarLimpio(document.getElementById("form-ausencia"));
}

function leerAusencia() {
  return {
    personaId: document.getElementById("a-persona").value,
    desde: document.getElementById("a-desde").value,
    hasta: document.getElementById("a-hasta").value,
    motivo: document.getElementById("a-motivo").value,
    observaciones: document.getElementById("a-observaciones").value.trim(),
  };
}

function mostrarErroresAusencia(errores) {
  for (const [clave, id] of [["persona", "a-persona"], ["desde", "a-desde"]]) {
    document.getElementById(id + "-error").innerHTML = errores[clave] ? `${icono("i-alerta")}<span>${esc(errores[clave])}</span>` : "";
    document.getElementById(id).setAttribute("aria-invalid", errores[clave] ? "true" : "false");
  }
}

/** Lista de lo que se va a crear, para revisar antes de guardar. */
function pintarVistaPrevia() {
  const a = leerAusencia();
  const caja = document.getElementById("a-vista-previa");
  const boton = document.getElementById("a-guardar");
  const errores = validarAusencia(datos, a);

  if (errores.persona || errores.desde) {
    caja.innerHTML = `<p class="ayuda">${a.personaId ? esc(errores.persona || errores.desde) : "Elige a la persona y las fechas para ver qué programas quedan sin presentador."}</p>`;
    boton.disabled = true;
    boton.textContent = "Crear pendientes";
    return;
  }

  const lista = programasDeAusencia(datos, a.personaId, a.desde, a.hasta);
  const nuevos = lista.filter(x => !x.existe).length;
  boton.disabled = nuevos === 0;
  boton.textContent = nuevos ? `Crear ${nuevos} pendiente${nuevos === 1 ? "" : "s"}` : "Crear pendientes";

  caja.innerHTML = lista.length ? `
    <p class="vista-previa__titulo">${nuevos} relevo${nuevos === 1 ? "" : "s"} pendiente${nuevos === 1 ? "" : "s"} por crear${lista.length > nuevos ? ` · ${lista.length - nuevos} ya registrado${lista.length - nuevos === 1 ? "" : "s"}` : ""}</p>
    <ul>
      ${lista.map(x => `
        <li class="${x.existe ? "ya-existe" : ""}">
          <span class="mono">${fechaCorta(x.fecha)} ${x.programa.inicio}</span>
          <span>${esc(x.programa.nombre)}${x.existe ? " (ya registrado)" : ""}</span>
        </li>`).join("")}
    </ul>` : `<p class="ayuda">En esas fechas ${esc(nombrePersona(datos, a.personaId))} no tiene programas al aire.</p>`;
}

function guardarAusencia() {
  const a = leerAusencia();
  const errores = validarAusencia(datos, a);
  mostrarErroresAusencia(errores);
  if (Object.keys(errores).length) return;

  const nuevos = programasDeAusencia(datos, a.personaId, a.desde, a.hasta).filter(x => !x.existe);
  if (!nuevos.length) return;

  const creadoEn = new Date().toISOString();
  for (const { fecha, programa } of nuevos) {
    datos.relevos.push({
      id: nuevoId(), creadoEn, fecha,
      programaId: programa.id, inicio: programa.inicio, fin: programa.fin,
      titularId: a.personaId, relevoId: null, estado: "pendiente",
      motivo: a.motivo, observaciones: a.observaciones,
    });
  }

  document.getElementById("dialogo-ausencia").close();
  // Se muestra la bitácora filtrada por esa persona para ver lo creado
  limpiarFiltros();
  Filtros.persona = a.personaId;
  Filtros.estado = "pendiente";
  guardarCambios();
  location.hash = "#bitacora";
  avisar(`Se crearon ${nuevos.length} relevos pendientes para ${nombrePersona(datos, a.personaId)}.`);
}
