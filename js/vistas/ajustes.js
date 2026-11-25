/* ==========================================================
   vistas/ajustes.js — Equipo, programas y datos
   ----------------------------------------------------------
   Nivel 2: administrar presentadores y programas sin tocar código.
   Requisito 08: datos de ejemplo y botón para empezar de cero.
   Nivel 3: copia de seguridad y restauración.
   ========================================================== */

const Ajustes = { editandoPersona: null, editandoPrograma: null };

function pintarAjustes() {
  const vista = document.getElementById("vista-ajustes");
  const personas = [...datos.presentadores].sort((a, b) =>
    (b.activo - a.activo) || a.nombre.localeCompare(b.nombre));
  const programas = [...datos.programas].sort((a, b) =>
    (programaActivo(b) - programaActivo(a)) || (Math.min(...a.dias) - Math.min(...b.dias)) || a.inicio.localeCompare(b.inicio));

  vista.innerHTML = `
    <div class="vista__encabezado">
      <div>
        <p class="sobretitulo">Equipo, programas y copias de seguridad</p>
        <h1 id="titulo-ajustes">Ajustes</h1>
      </div>
    </div>

    <nav class="indice" aria-label="En esta página">
      <a href="#ajustes" data-ir-a="sec-presentadores">Presentadores</a>
      <a href="#ajustes" data-ir-a="sec-programas">Programas</a>
      <a href="#ajustes" data-ir-a="sec-datos">Datos</a>
      <a href="#ajustes" data-ir-a="sec-app">App y ayuda</a>
    </nav>

    <!-- ===== Presentadores ===== -->
    <section class="tarjeta" id="sec-presentadores" aria-labelledby="t-presentadores">
      <h2 class="tarjeta__titulo" id="t-presentadores">Presentadores <span class="tarjeta__sub">${datos.presentadores.filter(p => p.activo).length} activos</span></h2>

      <form class="form-en-linea" id="form-persona" novalidate>
        <div class="campo">
          <label for="nueva-persona">Agregar presentador</label>
          <input id="nueva-persona" type="text" maxlength="50" placeholder="Nombre y apellido" autocomplete="off" aria-describedby="nueva-persona-error">
          <p class="error" id="nueva-persona-error"></p>
        </div>
        <div class="campo">
          <label for="nuevo-telefono">Celular <span class="req">opcional, para WhatsApp</span></label>
          <input id="nuevo-telefono" type="tel" maxlength="20" placeholder="300 123 4567" autocomplete="off" aria-describedby="nuevo-telefono-error">
          <p class="error" id="nuevo-telefono-error"></p>
        </div>
        <button class="boton boton--principal" type="submit">${icono("i-mas")} Agregar</button>
      </form>

      ${personas.length ? `
      <ul class="lista-admin">
        ${personas.map(filaPersona).join("")}
      </ul>` : `<p class="tarjeta__nota">Aún no hay presentadores. Agrega el primero arriba.</p>`}
    </section>

    <!-- ===== Programas ===== -->
    <section class="tarjeta" id="sec-programas" aria-labelledby="t-programas">
      <div class="tarjeta__cabecera">
        <h2 class="tarjeta__titulo" id="t-programas">Programas <span class="tarjeta__sub">${datos.programas.filter(programaActivo).length} al aire</span></h2>
        <button class="boton boton--principal" type="button" data-programa-nuevo ${datos.presentadores.some(p => p.activo) ? "" : "disabled"}>${icono("i-mas")} Agregar programa</button>
      </div>
      ${datos.presentadores.some(p => p.activo) ? "" : `<p class="tarjeta__nota">Primero agrega al menos un presentador.</p>`}
      ${programas.length ? `
      <ul class="lista-admin">
        ${programas.map(filaPrograma).join("")}
      </ul>` : `<p class="tarjeta__nota">Aún no hay programas.</p>`}
    </section>

    <!-- ===== Datos ===== -->
    <section class="tarjeta" id="sec-datos" aria-labelledby="t-datos">
      <h2 class="tarjeta__titulo" id="t-datos">Datos</h2>
      <p class="tarjeta__nota">Todo se guarda en este navegador. Para pasarlo a otro computador, descarga una copia de seguridad y cárgala allá.</p>

      <div class="acciones-datos">
        <div class="accion-dato">
          <div><h3>Copia de seguridad</h3><p>Descarga un archivo con todo: equipo, programas y relevos.</p></div>
          <button class="boton boton--borde" type="button" id="boton-copia">Descargar copia</button>
        </div>
        <div class="accion-dato">
          <div><h3>Restaurar una copia</h3><p>Carga un archivo de copia. Reemplaza los datos actuales.</p></div>
          <label class="boton boton--borde" for="archivo-copia">Elegir archivo</label>
          <input class="solo-lector" id="archivo-copia" type="file" accept=".json,application/json">
        </div>
        <div class="accion-dato">
          <div><h3>Datos de ejemplo</h3><p>34 presentadores, 21 programas y relevos ficticios para practicar.</p></div>
          <button class="boton boton--borde" type="button" id="boton-ejemplo">Cargar ejemplo</button>
        </div>
        <div class="accion-dato accion-dato--peligro">
          <div><h3>Borrar solo los relevos</h3><p>Conserva el equipo y los programas.</p></div>
          <button class="boton boton--peligro-borde" type="button" id="boton-borrar-relevos" ${datos.relevos.length ? "" : "disabled"}>Borrar relevos</button>
        </div>
        <div class="accion-dato accion-dato--peligro">
          <div><h3>Empezar de cero</h3><p>Borra todo: relevos, presentadores y programas.</p></div>
          <button class="boton boton--peligro" type="button" data-accion="empezar-de-cero">Borrar todo</button>
        </div>
      </div>
    </section>

    <!-- ===== App y ayuda ===== -->
    <section class="tarjeta" id="sec-app" aria-labelledby="t-app">
      <h2 class="tarjeta__titulo" id="t-app">App y ayuda</h2>
      <div class="acciones-datos">
        <div class="accion-dato">
          <div>
            <h3>Instalar en este dispositivo</h3>
            <p>${pedidoInstalacion
              ? "Queda como una app con su propio ícono y funciona sin internet."
              : location.protocol.startsWith("http")
                ? "En el celular: abre el menú del navegador y elige «Agregar a la pantalla de inicio» (en iPhone: Compartir → Agregar a inicio)."
                : "Disponible cuando la bitácora está publicada en internet (por ejemplo, en GitHub Pages)."}</p>
          </div>
          ${pedidoInstalacion ? `<button class="boton boton--principal" type="button" data-accion="instalar">${icono("i-descargar")} Instalar app</button>` : ""}
        </div>
        <div class="accion-dato">
          <div><h3>Guía de uso y atajos</h3><p>Vuelve a ver los 5 pasos básicos y los atajos de teclado.</p></div>
          <button class="boton boton--borde" type="button" data-accion="guia">${icono("i-ayuda")} Ver guía</button>
        </div>
      </div>
    </section>
  `;
}

/* ---------- Filas ---------- */

function filaPersona(p) {
  const programas = datos.programas.filter(x => programaActivo(x) && x.titularId === p.id);
  const rol = programas.length ? `Titular de ${programas.map(x => `«${esc(x.nombre)}»`).join(", ")}` : "Disponible para relevos";

  if (Ajustes.editandoPersona === p.id) {
    return `
      <li class="lista-admin__fila lista-admin__fila--editando">
        <form class="form-en-linea" data-editar-persona="${p.id}" novalidate>
          <div class="campo">
            <label for="editar-persona">Nombre</label>
            <input id="editar-persona" type="text" maxlength="50" value="${esc(p.nombre)}" aria-describedby="editar-persona-error">
            <p class="error" id="editar-persona-error"></p>
          </div>
          <div class="campo">
            <label for="editar-telefono">Celular <span class="req">opcional</span></label>
            <input id="editar-telefono" type="tel" maxlength="20" value="${esc(p.telefono || "")}" aria-describedby="editar-telefono-error">
            <p class="error" id="editar-telefono-error"></p>
          </div>
          <button class="boton boton--principal" type="submit">Guardar</button>
          <button class="boton boton--borde" type="button" data-cancelar-persona>Cancelar</button>
        </form>
      </li>`;
  }

  return `
    <li class="lista-admin__fila${p.activo ? "" : " es-inactivo"}">
      <div class="lista-admin__texto">
        <strong>${botonPersona(p.id)}</strong>
        <span>${p.activo ? rol : "Inactivo · se conserva en el historial"}${p.telefono ? ` · <span class="mono">${esc(p.telefono)}</span>` : ""}</span>
      </div>
      <div class="lista-admin__acciones">
        ${p.activo ? `
          <button class="boton boton--texto boton--chico" type="button" data-persona-editar="${p.id}">${icono("i-lapiz")} Editar</button>
          <button class="boton boton--texto-peligro boton--chico" type="button" data-persona-quitar="${p.id}">${icono("i-papelera")} Quitar</button>` : `
          <button class="boton boton--texto boton--chico" type="button" data-persona-activar="${p.id}">Reactivar</button>`}
      </div>
    </li>`;
}

function filaPrograma(p) {
  const activo = programaActivo(p);
  return `
    <li class="lista-admin__fila${activo ? "" : " es-inactivo"}">
      <div class="lista-admin__texto">
        <strong>${esc(p.nombre)}</strong>
        <span>${activo ? `${textoDias(p.dias)} · <span class="mono">${p.inicio}–${p.fin}</span> · ${esc(nombrePersona(datos, p.titularId))}` : "Retirado · se conserva en el historial"}</span>
      </div>
      <div class="lista-admin__acciones">
        ${activo ? `
          <button class="boton boton--texto boton--chico" type="button" data-programa-editar="${p.id}">${icono("i-lapiz")} Editar</button>
          <button class="boton boton--texto-peligro boton--chico" type="button" data-programa-quitar="${p.id}">${icono("i-papelera")} Quitar</button>` : `
          <button class="boton boton--texto boton--chico" type="button" data-programa-activar="${p.id}">Volver al aire</button>`}
      </div>
    </li>`;
}

/* ---------- Presentadores ---------- */

function validarNombrePersona(nombre, ignorarId = null) {
  if (!nombre) return "Escribe el nombre.";
  const repetido = datos.presentadores.some(p => p.id !== ignorarId && p.nombre.toLowerCase() === nombre.toLowerCase());
  return repetido ? "Ya hay un presentador con ese nombre." : null;
}

function mostrarErrorCampo(inputId, mensaje) {
  const input = document.getElementById(inputId);
  document.getElementById(inputId + "-error").innerHTML = mensaje ? `${icono("i-alerta")}<span>${esc(mensaje)}</span>` : "";
  input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  if (mensaje) input.focus();
}

/** El celular es opcional; si se escribe, debe tener entre 7 y 15 dígitos. */
function validarTelefono(telefono) {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length >= 7 && digitos.length <= 15 ? null : "Escribe un número válido (solo dígitos, por ejemplo 300 123 4567).";
}

function agregarPersona() {
  const input = document.getElementById("nueva-persona");
  const nombre = input.value.trim().replace(/\s+/g, " ");
  const telefono = document.getElementById("nuevo-telefono").value.trim();
  const error = validarNombrePersona(nombre);
  mostrarErrorCampo("nuevo-telefono", null);
  if (error) return mostrarErrorCampo("nueva-persona", error);
  mostrarErrorCampo("nueva-persona", null);
  const errorTel = validarTelefono(telefono);
  if (errorTel) return mostrarErrorCampo("nuevo-telefono", errorTel);
  datos.presentadores.push({ id: nuevoId(), nombre, telefono, activo: true });
  guardarCambios();
  avisar(`${nombre} se agregó al equipo.`);
  document.getElementById("nueva-persona").focus();
}

function guardarNombrePersona(id) {
  const nombre = document.getElementById("editar-persona").value.trim().replace(/\s+/g, " ");
  const telefono = document.getElementById("editar-telefono").value.trim();
  const error = validarNombrePersona(nombre, id);
  if (error) return mostrarErrorCampo("editar-persona", error);
  const errorTel = validarTelefono(telefono);
  if (errorTel) return mostrarErrorCampo("editar-telefono", errorTel);
  buscarPersona(datos, id).telefono = telefono;
  buscarPersona(datos, id).nombre = nombre;
  Ajustes.editandoPersona = null;
  guardarCambios();
  avisar("Nombre actualizado. La bitácora ya muestra el nombre nuevo.");
}

async function quitarPersona(id) {
  const persona = buscarPersona(datos, id);
  const programa = datos.programas.find(p => programaActivo(p) && p.titularId === id);
  if (programa) {
    avisar(`${persona.nombre} es titular de «${programa.nombre}». Primero cambia el titular de ese programa.`, { tipo: "error", duracion: 7000 });
    return;
  }
  const tieneHistorial = datos.relevos.some(r => r.titularId === id || r.relevoId === id);
  if (tieneHistorial) {
    const ok = await confirmar({
      titulo: `¿Quitar a ${persona.nombre}?`,
      mensaje: `<p>Tiene relevos en la bitácora, así que <strong>no se borra</strong>: queda como inactivo. Ya no aparecerá en las listas para elegir, pero su historial se conserva.</p>`,
      textoAceptar: "Sí, quitar",
    });
    if (!ok) return;
    persona.activo = false;
  } else {
    const ok = await confirmar({
      titulo: `¿Quitar a ${persona.nombre}?`,
      mensaje: `<p>No tiene relevos registrados, así que se borrará del equipo.</p>`,
      textoAceptar: "Sí, quitar",
    });
    if (!ok) return;
    datos.presentadores = datos.presentadores.filter(p => p.id !== id);
  }
  guardarCambios();
  avisar(`${persona.nombre} ya no está en la lista del equipo.`);
}

/* ---------- Programas ---------- */

function prepararDialogoPrograma() {
  const dialogo = document.getElementById("dialogo-programa");
  prepararDialogo(dialogo);
  document.getElementById("p-dias").innerHTML = [1, 2, 3, 4, 5, 6].map(d => `
    <label class="dia-check"><input type="checkbox" value="${d}"><span>${DIAS_CORTOS[d]}</span></label>`).join("");
  document.getElementById("form-programa").addEventListener("submit", evento => {
    evento.preventDefault();
    guardarPrograma();
  });
}

function abrirPrograma(programa = null) {
  Ajustes.editandoPrograma = programa ? programa.id : null;
  document.getElementById("titulo-programa").textContent = programa ? "Editar programa" : "Agregar programa";
  document.getElementById("p-nombre").value = programa ? programa.nombre : "";
  document.getElementById("p-inicio").value = programa ? programa.inicio : "";
  document.getElementById("p-fin").value = programa ? programa.fin : "";
  document.querySelectorAll("#p-dias input").forEach(c => {
    c.checked = programa ? programa.dias.includes(Number(c.value)) : false;
  });
  llenarPersonas(document.getElementById("p-titular"), "Elige quién lo presenta", programa ? programa.titularId : null);
  document.getElementById("p-titular").value = programa ? programa.titularId : "";
  ["p-nombre", "p-dias", "p-inicio", "p-titular"].forEach(id => { document.getElementById(id + "-error").innerHTML = ""; });
  document.getElementById("dialogo-programa").showModal();
  document.getElementById("p-nombre").focus();
  marcarLimpio(document.getElementById("form-programa"));
}

function guardarPrograma() {
  const p = {
    nombre: document.getElementById("p-nombre").value.trim().replace(/\s+/g, " "),
    dias: [...document.querySelectorAll("#p-dias input:checked")].map(c => Number(c.value)),
    inicio: document.getElementById("p-inicio").value,
    fin: document.getElementById("p-fin").value,
    titularId: document.getElementById("p-titular").value,
  };
  const errores = validarPrograma(datos, p, Ajustes.editandoPrograma);
  const mapa = { nombre: "p-nombre", dias: "p-dias", inicio: "p-inicio", titularId: "p-titular" };
  for (const [clave, id] of Object.entries(mapa)) {
    document.getElementById(id + "-error").innerHTML = errores[clave] ? `${icono("i-alerta")}<span>${esc(errores[clave])}</span>` : "";
  }
  const primero = Object.keys(errores)[0];
  if (primero) {
    const campo = document.getElementById(mapa[primero]);
    (campo.querySelector("input") || campo).focus();
    return;
  }

  if (Ajustes.editandoPrograma) {
    Object.assign(buscarPrograma(datos, Ajustes.editandoPrograma), p);
  } else {
    datos.programas.push({ id: nuevoId(), activo: true, ...p });
  }
  document.getElementById("dialogo-programa").close();
  guardarCambios();
  avisar(`Programa «${p.nombre}» guardado.`);
}

async function quitarPrograma(id) {
  const programa = buscarPrograma(datos, id);
  const usados = datos.relevos.filter(r => r.programaId === id).length;
  const ok = await confirmar({
    titulo: `¿Quitar «${programa.nombre}»?`,
    mensaje: usados
      ? `<p>Tiene ${usados} relevos en la bitácora, así que <strong>no se borra</strong>: queda como retirado. Sale de la parrilla, pero su historial se conserva.</p>`
      : `<p>No tiene relevos registrados, así que se borrará.</p>`,
    textoAceptar: "Sí, quitar",
  });
  if (!ok) return;
  if (usados) programa.activo = false;
  else datos.programas = datos.programas.filter(p => p.id !== id);
  guardarCambios();
  avisar(`«${programa.nombre}» ya no está en la parrilla.`);
}

function reactivarPrograma(id) {
  const programa = buscarPrograma(datos, id);
  const errores = validarPrograma(datos, programa, id);
  if (Object.keys(errores).length) {
    avisar(`No se puede volver al aire: ${Object.values(errores)[0]}`, { tipo: "error", duracion: 7000 });
    return;
  }
  programa.activo = true;
  guardarCambios();
  avisar(`«${programa.nombre}» volvió a la parrilla.`);
}

/* ---------- Datos: copia, restaurar, ejemplo, borrar ---------- */

function descargarCopia() {
  const copia = { app: "bitacora-onda-viva", version: 1, exportadoEn: new Date().toISOString(), datos };
  descargarArchivo(`copia-onda-viva-${hoyISO()}.json`, JSON.stringify(copia, null, 2), "application/json");
  avisar("Copia de seguridad descargada.");
}

function restaurarCopia(archivo) {
  const lector = new FileReader();
  lector.onload = async () => {
    let nuevos;
    try {
      const contenido = JSON.parse(lector.result);
      nuevos = contenido.datos || contenido; // acepta la copia completa o solo los datos
    } catch {
      nuevos = null;
    }
    if (!Almacen.esValido(nuevos)) {
      avisar("Ese archivo no es una copia de seguridad de la bitácora.", { tipo: "error" });
      return;
    }
    const ok = await confirmar({
      titulo: "¿Restaurar esta copia?",
      mensaje: `<p>La copia tiene <strong>${nuevos.relevos.length} relevos</strong>, ${nuevos.presentadores.length} presentadores y ${nuevos.programas.length} programas.</p>
                <p>Reemplazará todo lo que hay ahora en este navegador.</p>`,
      textoAceptar: "Sí, restaurar",
    });
    if (!ok) return;
    datos = { ...Almacen.vacio(), ...nuevos };
    guardarCambios();
    avisar("Copia restaurada.");
  };
  lector.readAsText(archivo);
}

async function cargarEjemplo() {
  const ok = await confirmar({
    titulo: "¿Cargar los datos de ejemplo?",
    mensaje: `<p>Se reemplazará todo lo que hay ahora por datos ficticios. Si quieres conservar lo actual, primero descarga una copia de seguridad.</p>`,
    textoAceptar: "Sí, cargar ejemplo",
  });
  if (!ok) return;
  datos = crearDatosEjemplo();
  guardarCambios();
  avisar("Datos de ejemplo cargados.");
}

async function borrarSoloRelevos() {
  const ok = await confirmar({
    titulo: "¿Borrar todos los relevos?",
    mensaje: `<p>Se borrarán los <strong>${datos.relevos.length} relevos</strong>. El equipo y los programas se conservan.</p>`,
    textoAceptar: "Sí, borrar relevos",
    palabra: "BORRAR",
  });
  if (!ok) return;
  datos.relevos = [];
  datos.esEjemplo = false;
  guardarCambios();
  avisar("Se borraron todos los relevos.");
}

/** Requisito 08: borrar todo y empezar de cero. */
async function empezarDeCero() {
  const ok = await confirmar({
    titulo: "¿Borrar todo y empezar de cero?",
    mensaje: `<p>Se borrarán <strong>todos</strong> los relevos, presentadores y programas. Esto no se puede deshacer.</p>
              <p>Después podrás agregar el equipo y los programas reales en Ajustes.</p>`,
    textoAceptar: "Sí, borrar todo",
    palabra: "BORRAR",
  });
  if (!ok) return;
  datos = Almacen.vacio();
  guardarCambios();
  location.hash = "#ajustes";
  avisar("Listo. Empieza agregando a los presentadores.");
}

/* ---------- Eventos ---------- */

function prepararAjustes() {
  const vista = document.getElementById("vista-ajustes");
  prepararDialogoPrograma();

  vista.addEventListener("submit", evento => {
    evento.preventDefault();
    if (evento.target.id === "form-persona") agregarPersona();
    const editar = evento.target.closest("[data-editar-persona]");
    if (editar) guardarNombrePersona(editar.dataset.editarPersona);
  });

  vista.addEventListener("change", evento => {
    if (evento.target.id === "archivo-copia" && evento.target.files[0]) {
      restaurarCopia(evento.target.files[0]);
      evento.target.value = "";
    }
  });

  vista.addEventListener("click", evento => {
    const b = selector => evento.target.closest(selector);
    let el;
    if ((el = b("[data-ir-a]"))) {
      evento.preventDefault();
      document.getElementById(el.dataset.irA).scrollIntoView({ behavior: "smooth", block: "start" });
    }
    else if ((el = b("[data-persona-editar]"))) {
      Ajustes.editandoPersona = el.dataset.personaEditar;
      pintarAjustes();
      document.getElementById("editar-persona").focus();
    }
    else if (b("[data-cancelar-persona]")) { Ajustes.editandoPersona = null; pintarAjustes(); }
    else if ((el = b("[data-persona-quitar]"))) quitarPersona(el.dataset.personaQuitar);
    else if ((el = b("[data-persona-activar]"))) {
      const persona = buscarPersona(datos, el.dataset.personaActivar);
      persona.activo = true;
      guardarCambios();
      avisar(`${persona.nombre} volvió al equipo.`);
    }
    else if (b("[data-programa-nuevo]")) abrirPrograma();
    else if ((el = b("[data-programa-editar]"))) abrirPrograma(buscarPrograma(datos, el.dataset.programaEditar));
    else if ((el = b("[data-programa-quitar]"))) quitarPrograma(el.dataset.programaQuitar);
    else if ((el = b("[data-programa-activar]"))) reactivarPrograma(el.dataset.programaActivar);
    else if (b("#boton-copia")) descargarCopia();
    else if (b("#boton-ejemplo")) cargarEjemplo();
    else if (b("#boton-borrar-relevos")) borrarSoloRelevos();
  });
}
