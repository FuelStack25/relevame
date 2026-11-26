/* ==========================================================
   app.js — Arranque y navegación
   ----------------------------------------------------------
   1. Carga los datos (o los de ejemplo la primera vez).
   2. Muestra la pantalla según la dirección: #hoy, #parrilla…
   3. Después de cada cambio: guarda y vuelve a pintar.
   4. Tema claro/oscuro, atajos de teclado y app instalable.
   ========================================================== */

// Todos los datos de la app viven en esta variable (ver almacen.js).
let datos;

const VISTAS = {
  hoy: pintarHoy,
  parrilla: pintarParrilla,
  bitacora: pintarBitacora,
  reportes: pintarReportes,
  ajustes: pintarAjustes,
};

function vistaActual() {
  const nombre = location.hash.replace("#", "");
  return VISTAS[nombre] ? nombre : "hoy";
}

/* ---------- Pintar ---------- */

/** Muestra solo la vista activa y la dibuja. */
function mostrarVista({ enfocar = false } = {}) {
  const activa = vistaActual();
  for (const nombre of Object.keys(VISTAS)) {
    document.getElementById(`vista-${nombre}`).hidden = nombre !== activa;
  }
  document.querySelectorAll(".nav__enlace").forEach(enlace => {
    if (enlace.dataset.vista === activa) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  });
  VISTAS[activa]();
  if (enfocar) {
    window.scrollTo(0, 0);
    // Si se llegó con irA(), el foco va al elemento pedido; si no, al título
    // de la pantalla (útil con teclado y lector de pantalla)
    const destino = enfocarAlMostrar && document.getElementById(enfocarAlMostrar);
    enfocarAlMostrar = null;
    if (destino) {
      destino.scrollIntoView({ block: "center" });
      destino.focus({ preventScroll: true });
      return;
    }
    const titulo = document.getElementById(`titulo-${activa}`);
    if (titulo) {
      titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    }
  }
}

let enfocarAlMostrar = null; // id del elemento a enfocar al llegar con irA()

/** Va a una pantalla y deja el foco en un elemento concreto de ella. */
function irA(vista, idEnfocar = null) {
  enfocarAlMostrar = idEnfocar;
  if (location.hash === "#" + vista) mostrarVista({ enfocar: true });
  else location.hash = "#" + vista; // el cambio de dirección vuelve a pintar
}

/** Si aún no hay equipo o programas, no tiene sentido abrir un formulario vacío. */
function avisarQueFaltaConfigurar() {
  avisar("Antes de registrar relevos, agrega al equipo y los programas.", { tipo: "error", duracion: 6000 });
  irA("hoy", "titulo-primeros-pasos");
}

/** Cabecera: indicador AL AIRE y aviso de datos de ejemplo. */
function pintarCabecera() {
  const ahora = alAireAhora(datos);
  const caja = document.getElementById("al-aire");
  caja.classList.toggle("al-aire--activo", Boolean(ahora));
  caja.querySelector(".al-aire__texto").textContent = ahora ? `Al aire · ${ahora.programa.nombre}` : "Fuera del aire";
  document.getElementById("aviso-ejemplo").hidden = !datos.esEjemplo;

  // Insignia en "Hoy" (y en la pestaña del navegador) con lo que falta resolver,
  // para verlo desde cualquier pantalla
  const manana = sumarDias(hoyISO(), 1);
  const porResolver = datos.relevos.filter(r => r.estado === "pendiente" && r.fecha <= manana).length;
  const insignia = document.getElementById("nav-insignia");
  insignia.hidden = porResolver === 0;
  insignia.innerHTML = `${porResolver}<span class="solo-lector"> por resolver</span>`;
  document.title = (porResolver ? `(${porResolver}) ` : "") + "Relévame · Onda Viva";
}

/* ---------- Guardar ---------- */

/** Se llama después de CUALQUIER cambio en los datos (Requisito 06). */
function guardarCambios() {
  const ok = Almacen.guardar(datos);
  if (!ok) avisar("No se pudo guardar en este navegador. Descarga una copia de seguridad.", { tipo: "error", duracion: 8000 });
  pintarCabecera();
  mostrarVista();
  pintarFicha(); // si la ficha de alguien está abierta, se actualiza
}

/* ---------- Borrar un relevo (con confirmación y deshacer) ---------- */

/** Pregunta antes de borrar, mostrando qué se va a borrar (Requisito 05). */
function pedirConfirmacionBorrado(relevo) {
  const quien = relevo.relevoId
    ? `${esc(nombrePersona(datos, relevo.relevoId))} cubría a ${esc(nombrePersona(datos, relevo.titularId))}`
    : `Faltaba ${esc(nombrePersona(datos, relevo.titularId))}`;
  return confirmar({
    titulo: "¿Borrar este relevo?",
    mensaje: `
      <div class="ficha-mini">
        <strong>${esc(nombrePrograma(datos, relevo.programaId))}</strong>
        <span>${esc(fechaLarga(relevo.fecha))} · ${horario(relevo.inicio, relevo.fin)}</span>
        <span>${quien}</span>
        ${insigniaEstado(relevo.estado)}
      </div>`,
    textoAceptar: "Sí, borrar",
  });
}

function borrarRelevo(id) {
  const posicion = datos.relevos.findIndex(r => r.id === id);
  if (posicion === -1) return;
  const [borrado] = datos.relevos.splice(posicion, 1);
  guardarCambios();
  avisar(`Relevo de «${nombrePrograma(datos, borrado.programaId)}» borrado.`, {
    duracion: 7000,
    accion: {
      texto: "Deshacer",
      icono: "i-deshacer",
      alHacer: () => {
        datos.relevos.push(borrado);
        guardarCambios();
        avisar("Relevo recuperado.");
      },
    },
  });
}

/* ---------- Resolver un pendiente que ya pasó, en un toque ---------- */

function marcarSinCubrir(id) {
  const relevo = datos.relevos.find(r => r.id === id);
  if (!relevo) return;
  const antes = { estado: relevo.estado, relevoId: relevo.relevoId };
  relevo.estado = "sin-cubrir";
  relevo.relevoId = null;
  guardarCambios();
  document.getElementById("titulo-por-resolver")?.focus(); // el botón tocado ya no existe
  avisar(`«${nombrePrograma(datos, relevo.programaId)}» quedó como sin cubrir.`, {
    duracion: 7000,
    accion: {
      texto: "Deshacer",
      icono: "i-deshacer",
      alHacer: () => {
        Object.assign(relevo, antes);
        guardarCambios();
      },
    },
  });
}

/* ---------- Tema claro / oscuro ---------- */

const CLAVE_TEMA = "ondaviva.tema";

// Claro por defecto; el oscuro es opcional y se recuerda en este navegador
function temaActual() {
  return document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro";
}

function cambiarTema() {
  const nuevo = temaActual() === "claro" ? "oscuro" : "claro";
  if (nuevo === "oscuro") document.documentElement.dataset.tema = "oscuro";
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) { /* sin almacenamiento */ }
  pintarBotonTema();
}

function pintarBotonTema() {
  const boton = document.getElementById("boton-tema");
  boton.setAttribute("aria-label", temaActual() === "claro" ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
}

/* ---------- Clics que sirven en todas las pantallas ---------- */

function prepararClicsGenerales() {
  document.getElementById("boton-tema").addEventListener("click", cambiarTema);

  document.addEventListener("click", evento => {
    // Los nombres subrayados abren la ficha (también dentro de diálogos)
    const ficha = evento.target.closest("[data-ficha]");
    if (ficha) {
      abrirFicha(ficha.dataset.ficha);
      return;
    }
    if (evento.target.closest("dialog")) return; // los diálogos manejan sus propios clics

    // Pendientes que ya pasaron (pantalla Hoy)
    const sinCubrir = evento.target.closest("[data-sin-cubrir]");
    if (sinCubrir) {
      marcarSinCubrir(sinCubrir.dataset.sinCubrir);
      return;
    }
    const cubrir = evento.target.closest("[data-cubrir]");
    if (cubrir) {
      const relevo = datos.relevos.find(r => r.id === cubrir.dataset.cubrir);
      if (relevo) abrirFormulario({ relevo, estado: "cubierto" });
      return;
    }

    // Enlaces que llevan a la bitácora ya filtrada (el enlace navega solo)
    const irBitacora = evento.target.closest("[data-ir-bitacora]");
    if (irBitacora) {
      limpiarFiltros();
      Filtros.estado = irBitacora.dataset.estado || "";
      Filtros.desde = irBitacora.dataset.desde || "";
      Filtros.hasta = irBitacora.dataset.hasta || "";
      return;
    }

    const accion = evento.target.closest("[data-accion]");
    if (accion) {
      const que = accion.dataset.accion;
      if (que === "nuevo-relevo") abrirFormulario();
      else if (que === "nueva-ausencia") abrirAusencia();
      else if (que === "empezar-de-cero") empezarDeCero();
      else if (que === "guia") abrirGuia();
      else if (que === "instalar") instalarApp();
      // Primeros pasos (pantalla Hoy)
      else if (que === "ir-presentadores") irA("ajustes", "pegar-personas");
      else if (que === "nuevo-programa") abrirPrograma();
      else if (que === "cargar-ejemplo") cargarEjemplo();
      else if (que === "resolver") abrirResolver();
      else if (que === "cabina") abrirCabina();
      return;
    }
    const editar = evento.target.closest("[data-editar]");
    if (editar) {
      const relevo = datos.relevos.find(r => r.id === editar.dataset.editar);
      if (relevo) abrirFormulario({ relevo });
    }
  });
}

/* ---------- Atajos de teclado ---------- */

function prepararAtajos() {
  const pantallas = ["hoy", "parrilla", "bitacora", "reportes", "ajustes"];

  document.addEventListener("keydown", evento => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const objetivo = evento.target;
    const escribiendo = objetivo.closest("input, textarea, select, [contenteditable='true']");
    const hayDialogo = document.querySelector("dialog[open]") || cabinaAbierta();
    if (escribiendo || hayDialogo) return;

    const tecla = evento.key.toLowerCase();
    if (tecla === "n") { evento.preventDefault(); abrirFormulario(); }
    else if (tecla === "a") { evento.preventDefault(); abrirAusencia(); }
    else if (tecla === "r") { evento.preventDefault(); abrirResolver(); }
    else if (tecla === "c") { evento.preventDefault(); abrirCabina(); }
    else if (tecla === "v") {
      evento.preventDefault();
      abrirFormulario();
      if (document.getElementById("dialogo-relevo").open) empezarDictado();
    }
    else if (tecla === "t") { cambiarTema(); }
    else if (evento.key === "?") { evento.preventDefault(); abrirGuia(); }
    else if (evento.key === "/") {
      evento.preventDefault();
      if (vistaActual() !== "bitacora") location.hash = "#bitacora";
      setTimeout(() => document.getElementById("filtro-texto")?.focus(), 0);
    }
    else if (/^[1-5]$/.test(evento.key)) { location.hash = "#" + pantallas[Number(evento.key) - 1]; }
  });
}

/* ---------- App instalable (PWA) ---------- */

let pedidoInstalacion = null; // lo entrega el navegador cuando la app se puede instalar

function prepararApp() {
  // Solo funciona publicada en internet (https), no abriendo el archivo con doble clic
  if (!location.protocol.startsWith("http")) return;

  const manifiesto = document.createElement("link");
  manifiesto.rel = "manifest";
  manifiesto.href = "manifest.webmanifest";
  document.head.appendChild(manifiesto);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(error => console.warn("Sin modo sin conexión:", error));
  }

  window.addEventListener("beforeinstallprompt", evento => {
    evento.preventDefault();
    pedidoInstalacion = evento;
    if (vistaActual() === "ajustes") pintarAjustes();
  });
  window.addEventListener("appinstalled", () => {
    pedidoInstalacion = null;
    avisar("¡Listo! La bitácora quedó instalada como app.");
  });
}

async function instalarApp() {
  if (!pedidoInstalacion) return;
  pedidoInstalacion.prompt();
  await pedidoInstalacion.userChoice;
  pedidoInstalacion = null;
  if (vistaActual() === "ajustes") pintarAjustes();
}

/* ---------- Arranque ---------- */

function iniciar() {
  datos = Almacen.cargar();
  if (!datos) {
    // Primera vez (o datos dañados): se cargan los de ejemplo
    datos = crearDatosEjemplo();
    Almacen.guardar(datos);
  }

  prepararFormulario();
  prepararAusencia();
  prepararFicha();
  prepararGuia();
  prepararResolver();
  prepararCabina();
  prepararVoz();
  prepararParrilla();
  prepararBitacora();
  prepararReportes();
  prepararAjustes();
  prepararClicsGenerales();
  prepararAtajos();
  prepararApp();
  pintarBotonTema();

  window.addEventListener("hashchange", () => mostrarVista({ enfocar: true }));

  // Si la app está abierta en otra pestaña y allá cambian algo, se actualiza aquí
  window.addEventListener("storage", evento => {
    if (evento.key !== CLAVE_ALMACEN) return;
    datos = Almacen.cargar() || Almacen.vacio();
    pintarCabecera();
    mostrarVista();
  });

  // Cada 30 segundos se revisa qué programa está al aire. Si nadie está usando
  // la pantalla Hoy, se repinta entera (así un pendiente que terminó pasa solo a
  // "Ya pasaron"); si no, solo la tarjeta del aire, para no quitarle el foco a nadie.
  setInterval(() => {
    pintarCabecera();
    if (vistaActual() !== "hoy") return;
    const enUso = document.querySelector("dialog[open]") ||
      document.getElementById("vista-hoy").contains(document.activeElement);
    if (!enUso) return pintarHoy();
    const tarjeta = document.getElementById("tarjeta-aire");
    if (tarjeta) tarjeta.outerHTML = htmlTarjetaAire();
  }, 30000);

  pintarCabecera();
  mostrarVista();

  if (!guiaYaVista()) abrirGuia();
}

iniciar();
