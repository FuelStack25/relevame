/* ==========================================================
   ficha.js — Ficha de cada presentador
   ----------------------------------------------------------
   Todo sobre una persona en un solo lugar: qué programa
   presenta, su cupo de la semana, cuántos relevos ha hecho,
   cuántas veces la han relevado, su saldo de equidad y su
   historial. Se abre tocando cualquier nombre subrayado.
   ========================================================== */

let fichaAbiertaId = null;

function prepararFicha() {
  const dialogo = document.getElementById("dialogo-ficha");
  prepararDialogo(dialogo);
  dialogo.addEventListener("close", () => { fichaAbiertaId = null; });

  document.getElementById("ficha-cuerpo").addEventListener("click", evento => {
    const editar = evento.target.closest("[data-ficha-editar]");
    if (editar) {
      const relevo = datos.relevos.find(r => r.id === editar.dataset.fichaEditar);
      dialogo.close();
      if (relevo) abrirFormulario({ relevo });
      return;
    }
    if (evento.target.closest("[data-ficha-ausencia]")) {
      const id = fichaAbiertaId;
      dialogo.close();
      abrirAusencia(id);
    }
  });
}

/** Botón con el nombre de la persona que abre su ficha. */
function botonPersona(id) {
  if (!id) return `<span class="texto-suave">—</span>`;
  return `<button type="button" class="persona" data-ficha="${id}">${esc(nombrePersona(datos, id))}</button>`;
}

function abrirFicha(personaId) {
  const persona = buscarPersona(datos, personaId);
  if (!persona) return;
  fichaAbiertaId = personaId;
  pintarFicha();
  const dialogo = document.getElementById("dialogo-ficha");
  if (!dialogo.open) dialogo.showModal();
}

/** Se vuelve a pintar si los datos cambian con la ficha abierta. */
function pintarFicha() {
  if (!fichaAbiertaId) return;
  const persona = buscarPersona(datos, fichaAbiertaId);
  if (!persona) return;

  const cuenta = contarPorPersona(datos).find(f => f.persona.id === persona.id) ||
    { hechos: 0, recibidos: 0, horas: 0, semana: 0, saldo: 0 };
  const programas = datos.programas.filter(p => programaActivo(p) && p.titularId === persona.id);
  const historial = relevosOrdenados(
    datos.relevos.filter(r => r.relevoId === persona.id || r.titularId === persona.id)
  ).slice(0, 10);
  const iniciales = persona.nombre.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  const signo = cuenta.saldo > 0 ? "+" : cuenta.saldo < 0 ? "−" : "";

  document.getElementById("ficha-cuerpo").innerHTML = `
    <div class="ficha__cabeza">
      <span class="ficha__inicial" aria-hidden="true">${esc(iniciales)}</span>
      <div>
        <h3 class="ficha__nombre" id="ficha-nombre">${esc(persona.nombre)}</h3>
        <p class="ficha__rol">${persona.activo ? (programas.length
          ? `Titular de ${programas.map(p => `«${esc(p.nombre)}» (${textoDias(p.dias)}, ${horario(p.inicio, p.fin)})`).join(", ")}`
          : "Disponible para relevos") : "Inactivo"}</p>
      </div>
    </div>

    <div class="ficha__contacto">
      ${persona.telefono ? `
        <a class="boton boton--whatsapp boton--chico" href="${esc(enlaceWhatsApp(persona.telefono, `Hola ${persona.nombre.split(" ")[0]}, `))}" target="_blank" rel="noopener">
          ${icono("i-mensaje")} Escribir por WhatsApp
        </a>
        <span class="boton boton--texto boton--chico mono" aria-label="Teléfono">${icono("i-telefono")}${esc(persona.telefono)}</span>` : `
        <p class="ayuda">${icono("i-telefono", "icono")} Sin teléfono. Agrégalo en Ajustes para escribirle por WhatsApp con un toque.</p>`}
    </div>

    <div class="ficha__cifras">
      <div class="cifra"><span class="cifra__valor">${cuenta.hechos}</span><span class="cifra__etiqueta">relevos hechos</span></div>
      <div class="cifra"><span class="cifra__valor">${cuenta.recibidos}</span><span class="cifra__etiqueta">veces relevado</span></div>
      <div class="cifra ${cuenta.saldo > 0 ? "cifra--cubierto" : cuenta.saldo < 0 ? "cifra--sin-cubrir" : ""}"><span class="cifra__valor">${signo}${Math.abs(cuenta.saldo)}</span><span class="cifra__etiqueta">saldo de equidad</span></div>
      <div class="cifra"><span class="cifra__valor">${textoHoras(cuenta.horas)}</span><span class="cifra__etiqueta">horas cubiertas</span></div>
    </div>

    <p class="tarjeta__nota">Esta semana: ${cupo(cuenta.semana)} ${cuenta.semana >= LIMITE_SEMANAL ? "· ya no puede cubrir más esta semana" : `· puede cubrir ${LIMITE_SEMANAL - cuenta.semana} más`}</p>

    ${programas.length && persona.activo ? `
      <button type="button" class="boton boton--borde boton--ancho" data-ficha-ausencia style="margin-top:16px">
        ${icono("i-ausencia")} Registrar una ausencia de ${esc(persona.nombre.split(" ")[0])}
      </button>` : ""}

    <h4 class="ficha__seccion">Últimos relevos</h4>
    ${historial.length ? `
      <ul class="mini-lista">
        ${historial.map(r => {
          const cubrio = r.relevoId === persona.id;
          return `
          <li>
            <button type="button" class="mini-lista__fila" data-ficha-editar="${r.id}">
              <span class="mini-lista__fecha">${fechaRelativa(r.fecha)}<span class="mono">${r.inicio}</span></span>
              <span class="mini-lista__texto">
                <strong>${esc(nombrePrograma(datos, r.programaId))}</strong>
                <span>${cubrio ? `Cubrió a ${esc(nombrePersona(datos, r.titularId))}` : r.relevoId ? `Faltó · cubrió ${esc(nombrePersona(datos, r.relevoId))}` : `Faltó${r.motivo ? " · " + esc(r.motivo.toLowerCase()) : ""}`}</span>
              </span>
              ${insigniaEstado(r.estado)}
            </button>
          </li>`;
        }).join("")}
      </ul>` : `<p class="tarjeta__nota">Todavía no tiene relevos registrados.</p>`}
  `;
}
