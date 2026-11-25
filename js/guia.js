/* ==========================================================
   guia.js — Guía de primer uso y ayuda
   ----------------------------------------------------------
   La coordinadora debe poder usar el sitio sola. La primera
   vez que abre la bitácora ve 5 pasos cortos. Después puede
   volver a verlos con el botón "?" de la cabecera o la tecla ?.
   ========================================================== */

const CLAVE_GUIA = "ondaviva.guiaVista";

const PASOS_GUIA = [
  {
    icono: "i-mic",
    titulo: "Bienvenida a Relévame",
    texto: `<p>Aquí se anota <strong>cada vez que alguien no puede salir al aire</strong> y quién toma el micrófono en su lugar.</p>
            <p>Todo se guarda solo en este navegador: no se pierde al cerrar la página.</p>`,
  },
  {
    icono: "i-mas",
    titulo: "Registrar un relevo",
    texto: `<p>Toca <strong>Registrar relevo</strong> y elige el programa: el horario y el titular se llenan solos.</p>
            <p>Si aún no sabes quién cubre, guárdalo como <strong>Pendiente</strong> y complétalo después. También puedes tocar cualquier programa en la <strong>Parrilla</strong>.</p>`,
  },
  {
    icono: "i-personas",
    titulo: "¿Quién puede cubrir?",
    texto: `<p>Este botón muestra a quién está libre, ordenado por quién ha cubierto menos. Avisa si alguien ya tiene <strong>3 relevos esa semana</strong> o está al aire a esa hora.</p>
            <p>Con el botón de mensaje le pides el relevo <strong>por WhatsApp</strong> con el texto ya escrito. Si hay varios pendientes, <strong>Proponer quién cubre</strong> los reparte todos de una vez.</p>`,
  },
  {
    icono: "i-ausencia",
    titulo: "Ausencias de varios días",
    texto: `<p>Si alguien falta varios días (incapacidad, vacaciones…), usa <strong>Registrar ausencia</strong>: se crean de una vez los pendientes de todos sus programas.</p>
            <p>Toca cualquier <strong>nombre subrayado</strong> para ver la ficha de esa persona.</p>`,
  },
  {
    icono: "i-grafica",
    titulo: "Reportes y atajos",
    texto: `<p>En <strong>Reportes</strong> está el resumen del mes, el contador por presentador y el botón para imprimir o guardar en PDF.</p>
            <div class="guia__atajos">
              <kbd>N</kbd><span>Registrar relevo</span>
              <kbd>A</kbd><span>Registrar ausencia</span>
              <kbd>R</kbd><span>Proponer quién cubre los pendientes</span>
              <kbd>C</kbd><span>Modo cabina (pantalla del estudio)</span>
              <kbd>V</kbd><span>Dictar un relevo por voz</span>
              <kbd>/</kbd><span>Buscar en la bitácora</span>
              <kbd>1</kbd><span>… <kbd>5</kbd> cambiar de pantalla</span>
              <kbd>T</kbd><span>Tema claro u oscuro</span>
              <kbd>?</kbd><span>Ver esta ayuda</span>
            </div>`,
  },
];

let pasoGuia = 0;

function prepararGuia() {
  const dialogo = document.getElementById("dialogo-guia");
  dialogo.addEventListener("close", () => {
    try { localStorage.setItem(CLAVE_GUIA, "1"); } catch (e) { /* sin almacenamiento */ }
  });
  dialogo.addEventListener("click", evento => {
    if (evento.target === dialogo) return dialogo.close();
    const boton = evento.target.closest("[data-guia]");
    if (!boton) return;
    const accion = boton.dataset.guia;
    if (accion === "cerrar") return dialogo.close();
    pasoGuia += accion === "siguiente" ? 1 : -1;
    if (pasoGuia >= PASOS_GUIA.length) return dialogo.close();
    pintarGuia();
  });
}

function abrirGuia() {
  pasoGuia = 0;
  pintarGuia();
  document.getElementById("dialogo-guia").showModal();
}

/** La primera vez que se abre la bitácora en este navegador. */
function guiaYaVista() {
  try { return localStorage.getItem(CLAVE_GUIA) === "1"; } catch (e) { return true; }
}

function pintarGuia() {
  const paso = PASOS_GUIA[pasoGuia];
  const ultimo = pasoGuia === PASOS_GUIA.length - 1;
  document.getElementById("guia-cuerpo").innerHTML = `
    <div class="guia__pasos" aria-hidden="true">
      ${PASOS_GUIA.map((_, i) => `<span class="guia__punto${i <= pasoGuia ? " activo" : ""}"></span>`).join("")}
    </div>
    <p class="sobretitulo">Paso ${pasoGuia + 1} de ${PASOS_GUIA.length}</p>
    <div class="guia__icono">${icono(paso.icono)}</div>
    <h2 id="guia-titulo">${paso.titulo}</h2>
    <div class="guia__texto">${paso.texto}</div>
    <div class="guia__botones">
      <button type="button" class="boton boton--texto" data-guia="cerrar">${ultimo ? "Cerrar" : "Saltar guía"}</button>
      <span class="separador"></span>
      ${pasoGuia > 0 ? `<button type="button" class="boton boton--borde" data-guia="atras">Atrás</button>` : ""}
      <button type="button" class="boton boton--principal" data-guia="siguiente" autofocus>${ultimo ? "Empezar" : "Siguiente"}</button>
    </div>`;
  document.querySelector("#guia-cuerpo [data-guia='siguiente']").focus();
}
