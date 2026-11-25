/* ==========================================================
   resolver.js — Proponer quién cubre todos los pendientes
   ----------------------------------------------------------
   En vez de buscar relevo uno por uno, el sistema arma una
   propuesta para todos los pendientes que aún no terminan
   (ver proponerRelevos en reglas.js). La coordinadora la
   revisa, puede quitar filas, pedir confirmación por WhatsApp
   y asigna todo con un toque (con opción de deshacer).
   ========================================================== */

const Resolver = { propuesta: [] };

function prepararResolver() {
  const dialogo = document.getElementById("dialogo-resolver");
  prepararDialogo(dialogo);
  const form = document.getElementById("form-resolver");
  form.addEventListener("change", actualizarBotonResolver);
  form.addEventListener("submit", evento => {
    evento.preventDefault();
    aplicarPropuesta();
  });
}

function abrirResolver() {
  if (!estadoConfiguracion(datos).puedeRegistrar) return avisarQueFaltaConfigurar();
  const pendientes = pendientesPorVenir(datos);
  if (!pendientes.length) {
    avisar("No hay pendientes por cubrir. ¡Todo al día!");
    return;
  }
  Resolver.propuesta = proponerRelevos(datos, pendientes);
  pintarResolver();

  const dialogo = document.getElementById("dialogo-resolver");
  dialogo.showModal();
  dialogo.querySelector(".panel__cuerpo").scrollTop = 0;
  document.getElementById("resolver-intro").focus();
  marcarLimpio(document.getElementById("form-resolver"));
}

function pintarResolver() {
  const lista = Resolver.propuesta;
  const conPersona = lista.filter(p => p.persona);
  const personas = new Set(conPersona.map(p => p.persona.id));

  const fila = ({ relevo: r, persona, semana }) => {
    const programa = esc(nombrePrograma(datos, r.programaId));
    const cuando = `${fechaRelativa(r.fecha)} · <span class="mono">${r.inicio}–${r.fin}</span>`;
    const falta = `falta ${esc(nombrePersona(datos, r.titularId))}`;

    if (!persona) {
      return `
        <li class="propuesta propuesta--sin">
          <div class="propuesta__texto">
            <span class="propuesta__cuando">${cuando}</span>
            <strong>${programa}</strong>
            <span class="propuesta__falta">${falta}</span>
            <span class="propuesta__nadie">${icono("i-alerta")} Nadie disponible: ya tienen ${LIMITE_SEMANAL} esa semana, están al aire o también faltan.</span>
          </div>
          <a class="boton boton--whatsapp boton--chico" href="${esc(enlaceWhatsApp("", mensajeAvisarEquipo(r)))}"
             target="_blank" rel="noopener">${icono("i-mensaje")} Avisar al grupo</a>
        </li>`;
    }

    const pedir = enlaceWhatsApp(persona.telefono, mensajePedirRelevo(persona, r));
    return `
      <li class="propuesta">
        <label class="propuesta__check">
          <input type="checkbox" name="asignar" value="${r.id}" checked>
          <span class="propuesta__texto">
            <span class="propuesta__cuando">${cuando}</span>
            <strong>${programa}</strong>
            <span class="propuesta__falta">${falta}</span>
            <span class="propuesta__quien">${icono("i-flecha")} Cubre <strong>${esc(persona.nombre)}</strong>
              <span class="texto-suave">· quedará con ${semana}/${LIMITE_SEMANAL} esa semana</span></span>
          </span>
        </label>
        <a class="boton-icono boton-icono--whatsapp" href="${esc(pedir)}" target="_blank" rel="noopener"
           aria-label="Pedirle el relevo a ${esc(persona.nombre)} por WhatsApp" title="Pedir por WhatsApp">${icono("i-mensaje")}</a>
      </li>`;
  };

  document.getElementById("resolver-cuerpo").innerHTML = `
    <p class="resolver__intro" id="resolver-intro" tabindex="-1">
      <strong>${conPersona.length} de ${lista.length}</strong> pendientes tienen propuesta,
      repartidos entre <strong>${personas.size} ${personas.size === 1 ? "persona" : "personas"}</strong>.
    </p>
    <p class="ayuda resolver__reglas">
      Respeta el máximo de ${LIMITE_SEMANAL} por semana y los choques de horario, y pone primero a quien ha
      cubierto menos este mes. Confirma con cada persona (${icono("i-mensaje")}) y quita la marca de lo que no quieras asignar.
    </p>
    <ul class="propuestas">${lista.map(fila).join("")}</ul>`;

  actualizarBotonResolver();
}

function actualizarBotonResolver() {
  const n = document.querySelectorAll("#form-resolver input[name='asignar']:checked").length;
  const boton = document.getElementById("resolver-aplicar");
  boton.disabled = n === 0;
  boton.textContent = n === 1 ? "Asignar 1 relevo" : `Asignar ${n} relevos`;
}

/** Guarda lo marcado. Cada asignación se vuelve a validar contra los datos reales. */
function aplicarPropuesta() {
  const marcados = new Set(
    [...document.querySelectorAll("#form-resolver input[name='asignar']:checked")].map(i => i.value)
  );
  const cambios = [];
  let noSePudo = 0;

  for (const { relevo, persona } of Resolver.propuesta) {
    if (!persona || !marcados.has(relevo.id)) continue;
    const r = datos.relevos.find(x => x.id === relevo.id);
    if (!r || r.estado !== "pendiente") continue;
    const nuevo = { ...r, estado: "cubierto", relevoId: persona.id };
    if (Object.keys(validarRelevo(datos, nuevo, r.id)).length) { noSePudo++; continue; }
    cambios.push({ r, antes: { estado: r.estado, relevoId: r.relevoId } });
    r.estado = "cubierto";
    r.relevoId = persona.id;
  }

  document.getElementById("dialogo-resolver").close();
  guardarCambios();

  const texto = (cambios.length === 1 ? "Se asignó 1 relevo." : `Se asignaron ${cambios.length} relevos.`) +
    (noSePudo ? ` ${noSePudo} ya no se pudo asignar: revísalo a mano.` : "");
  avisar(texto, {
    tipo: noSePudo ? "error" : "ok",
    duracion: 9000,
    accion: cambios.length ? {
      texto: "Deshacer",
      icono: "i-deshacer",
      alHacer: () => {
        cambios.forEach(({ r, antes }) => Object.assign(r, antes));
        guardarCambios();
      },
    } : null,
  });
}
