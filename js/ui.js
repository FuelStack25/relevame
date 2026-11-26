/* ==========================================================
   ui.js — Piezas de interfaz que se reutilizan
   ----------------------------------------------------------
   Íconos, insignias de estado, avisos breves (toasts) y el
   diálogo de confirmación.
   ========================================================== */

/** HTML de un ícono del sprite de index.html. */
function icono(id, clase = "icono") {
  return `<svg class="${clase}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

/** Insignia de estado: punto de color + palabra (nunca solo color). */
function insigniaEstado(estado) {
  const info = ESTADOS[estado];
  if (!info) return "";
  return `<span class="insignia insignia--${estado}"><span class="insignia__punto" aria-hidden="true"></span>${info.texto}</span>`;
}

/**
 * Indicador del cupo semanal: tres barras, una por relevo.
 * cupo(2) → ▮▮▯ "2 de 3 esta semana"
 */
function cupo(cantidad) {
  let barras = "";
  for (let i = 1; i <= LIMITE_SEMANAL; i++) {
    barras += `<span class="cupo__barra${i <= cantidad ? " cupo__barra--llena" : ""}"></span>`;
  }
  const lleno = cantidad >= LIMITE_SEMANAL ? " cupo--lleno" : "";
  return `<span class="cupo${lleno}" title="${cantidad} de ${LIMITE_SEMANAL} relevos esta semana">
    <span class="cupo__barras" aria-hidden="true">${barras}</span>
    <span class="cupo__texto">${cantidad}/${LIMITE_SEMANAL}</span>
  </span>`;
}

/** Bloque de "no hay nada aquí" con un botón opcional. */
function estadoVacio(titulo, texto, botonHTML = "") {
  return `<div class="vacio">
    ${icono("i-mic", "vacio__icono")}
    <h3>${titulo}</h3>
    <p>${texto}</p>
    ${botonHTML}
  </div>`;
}

/* ---------- Avisos breves ---------- */

/**
 * Muestra un aviso abajo de la pantalla durante unos segundos.
 * Opcional: un botón de acción, por ejemplo "Deshacer".
 */
function avisar(mensaje, { accion = null, tipo = "ok", duracion = 5000 } = {}) {
  const contenedor = document.getElementById("avisos");
  const aviso = document.createElement("div");
  aviso.className = `aviso aviso--${tipo}`;
  aviso.innerHTML = `
    ${icono(tipo === "error" ? "i-alerta" : "i-check")}
    <span class="aviso__texto">${esc(mensaje)}</span>
  `;

  let temporizador;
  const quitar = () => {
    clearTimeout(temporizador);
    aviso.classList.add("aviso--saliendo");
    setTimeout(() => aviso.remove(), 160);
  };

  if (accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "aviso__accion";
    boton.innerHTML = `${accion.icono ? icono(accion.icono) : ""}${esc(accion.texto)}`;
    boton.addEventListener("click", () => { accion.alHacer(); quitar(); });
    aviso.appendChild(boton);
  }

  contenedor.appendChild(aviso);
  temporizador = setTimeout(quitar, duracion);
}

/* ---------- Confirmación antes de borrar ---------- */

/**
 * Abre el diálogo de confirmación y espera la respuesta.
 * Uso:  if (await confirmar({ titulo, mensaje })) { …borrar… }
 * Si se pasa `palabra`, la persona debe escribirla para poder aceptar.
 */
function confirmar({ titulo, mensaje, textoAceptar = "Sí, borrar", textoCancelar = "Cancelar", palabra = null }) {
  const dialogo = document.getElementById("dialogo-confirmar");
  const botonAceptar = document.getElementById("confirmar-aceptar");
  const cajaPalabra = document.getElementById("confirmar-palabra");
  const input = document.getElementById("confirmar-input");

  document.getElementById("confirmar-titulo").textContent = titulo;
  document.getElementById("confirmar-mensaje").innerHTML = mensaje;
  botonAceptar.textContent = textoAceptar;
  dialogo.querySelector("button[value='no']").textContent = textoCancelar;

  cajaPalabra.hidden = !palabra;
  input.value = "";
  botonAceptar.disabled = Boolean(palabra);
  if (palabra) {
    cajaPalabra.querySelector("label").textContent = `Para confirmar, escribe ${palabra}`;
    input.oninput = () => { botonAceptar.disabled = input.value.trim().toUpperCase() !== palabra; };
  }

  dialogo.returnValue = "";
  dialogo.showModal();
  (palabra ? input : dialogo.querySelector("button[value='no']")).focus();

  return new Promise(resolver => {
    dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "si"), { once: true });
  });
}

/* ---------- Diálogos (paneles) ---------- */

/**
 * "Huella" de un formulario: todos sus valores en un texto.
 * Sirve para saber si la persona cambió algo desde que lo abrió.
 */
function huellaFormulario(form) {
  return [...form.elements]
    .filter(el => el.matches("input, select, textarea"))
    .map(el => (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value)
    .join("\u0001");
}

/** Se llama justo después de llenar un formulario al abrirlo. */
function marcarLimpio(form) {
  form.dataset.huella = huellaFormulario(form);
}

/**
 * Cierra un <dialog> con los botones data-cerrar, el fondo oscuro o Esc.
 * Si el diálogo tiene un formulario con cambios sin guardar, primero
 * pregunta, para no perder lo escrito por un toque accidental.
 */
function prepararDialogo(dialogo) {
  const intentarCerrar = async () => {
    const form = dialogo.querySelector("form[data-huella]");
    if (form && huellaFormulario(form) !== form.dataset.huella) {
      const descartar = await confirmar({
        titulo: "¿Descartar los cambios?",
        mensaje: "<p>Lo que escribiste aún no se ha guardado.</p>",
        textoAceptar: "Sí, descartar",
        textoCancelar: "Seguir editando",
      });
      if (!descartar) return;
    }
    dialogo.close();
  };

  dialogo.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", intentarCerrar));
  dialogo.addEventListener("click", evento => {
    if (evento.target === dialogo) intentarCerrar(); // clic en el fondo
  });
  dialogo.addEventListener("cancel", evento => { // tecla Esc
    evento.preventDefault();
    intentarCerrar();
  });
}

/** Descarga un archivo generado en el navegador (CSV, copia de seguridad…). */
function descargarArchivo(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Llena un <select> con opciones. opciones: [{ valor, texto }] */
function llenarSelect(select, opciones, textoVacio = null) {
  const vacio = textoVacio !== null ? `<option value="">${esc(textoVacio)}</option>` : "";
  select.innerHTML = vacio + opciones
    .map(o => `<option value="${esc(o.valor)}"${o.deshabilitado ? " disabled" : ""}>${esc(o.texto)}</option>`)
    .join("");
}
