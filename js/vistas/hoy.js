/* ==========================================================
   vistas/hoy.js — Pantalla de inicio
   ----------------------------------------------------------
   Lo que la coordinadora necesita ver al llegar:
   qué está al aire, qué falta resolver hoy y mañana,
   y botones grandes para registrar relevos o ausencias.
   ========================================================== */

/** "HH:MM" de este momento. */
function horaAhora() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
}

function pintarHoy() {
  const hoy = hoyISO();
  const manana = sumarDias(hoy, 1);
  const horaActual = horaAhora();
  const vista = document.getElementById("vista-hoy");

  // Pendientes hasta mañana, los más antiguos primero. Se separan en dos grupos:
  //  - por cubrir: aún no empiezan → hay que buscar quién cubra
  //  - ya pasaron: terminaron y nadie actualizó el estado → no deben perderse de vista
  const pendientes = relevosOrdenados(
    datos.relevos.filter(r => r.estado === "pendiente" && r.fecha <= manana)
  ).reverse();
  const yaPaso = r => r.fecha < hoy || (r.fecha === hoy && r.fin <= horaActual);
  const porCubrir = pendientes.filter(r => !yaPaso(r));
  const atrasados = pendientes.filter(yaPaso);
  const MAX_ATRASADOS = 5;

  // Resumen de la semana actual
  const lunes = lunesDe(hoy);
  const domingo = sumarDias(lunes, 6);
  const deLaSemana = datos.relevos.filter(r => r.fecha >= lunes && r.fecha <= domingo);
  const cuenta = estado => deLaSemana.filter(r => r.estado === estado).length;

  // Cada cifra de la semana lleva a la bitácora ya filtrada
  const cifra = (estado, valor, etiqueta) => `
    <a class="cifra cifra--enlace${estado ? ` cifra--${estado}` : ""}" href="#bitacora" title="Ver en la bitácora"
       data-ir-bitacora data-estado="${estado}" data-desde="${lunes}" data-hasta="${domingo}">
      <span class="cifra__valor">${valor}</span><span class="cifra__etiqueta">${etiqueta}</span>
    </a>`;

  // Próximos relevos (de hoy en adelante)
  const proximos = relevosOrdenados(datos.relevos.filter(r => r.fecha >= hoy)).reverse().slice(0, 5);

  const config = estadoConfiguracion(datos);

  vista.innerHTML = `
    <div class="vista__encabezado">
      <div>
        <p class="sobretitulo">${esc(fechaLarga(hoy))}</p>
        <h1 id="titulo-hoy">Hoy en Onda Viva</h1>
      </div>
      <div class="vista__acciones vista__acciones--grandes" ${config.puedeRegistrar ? "" : "hidden"}>
        <button class="boton boton--borde boton--grande" type="button" data-accion="nueva-ausencia" title="Atajo: A">
          ${icono("i-ausencia")} Registrar ausencia
        </button>
        <button class="boton boton--principal boton--grande" type="button" data-accion="nuevo-relevo" title="Atajo: N">
          ${icono("i-mas")} Registrar relevo
        </button>
      </div>
    </div>

    ${htmlPrimerosPasos(config)}

    <div class="rejilla-hoy">
      <div class="columna columna--izq">
      ${htmlTarjetaAire()}
      <article class="tarjeta tarjeta--semana">
        <h2 class="tarjeta__titulo">Esta semana <span class="tarjeta__sub">${fechaSinAnio(lunes)} al ${fechaSinAnio(domingo)}</span></h2>
        <div class="cifras">
          ${cifra("", deLaSemana.length, "relevos")}
          ${cifra("pendiente", cuenta("pendiente"), `${icono("i-reloj")}pendientes`)}
          ${cifra("cubierto", cuenta("cubierto"), `${icono("i-check")}cubiertos`)}
          ${cifra("sin-cubrir", cuenta("sin-cubrir"), `${icono("i-mic-off")}sin cubrir`)}
        </div>
      </article>
      </div>
      <div class="columna columna--der">
      <article class="tarjeta tarjeta--pendientes">
        <h2 class="tarjeta__titulo" id="titulo-por-resolver" tabindex="-1">Por resolver <span class="tarjeta__sub">hoy y mañana</span></h2>
        ${porCubrir.length ? `
          <ul class="alertas">${porCubrir.map(htmlAlertaPorCubrir).join("")}</ul>` : `
          <p class="tarjeta__nota tarjeta__nota--ok">${icono("i-check")} Nada pendiente por cubrir hoy ni mañana.</p>`}
        ${atrasados.length ? `
          <h3 class="alertas__grupo">Ya pasaron <span class="tarjeta__sub">¿se cubrieron o no salieron al aire?</span></h3>
          <ul class="alertas">${atrasados.slice(0, MAX_ATRASADOS).map(htmlAlertaAtrasada).join("")}</ul>
          ${atrasados.length > MAX_ATRASADOS ? `
            <a class="enlace-ver" href="#bitacora" data-ir-bitacora data-estado="pendiente">Ver todos los pendientes en la bitácora ${icono("i-flecha")}</a>` : ""}` : ""}
      </article>
      <article class="tarjeta tarjeta--proximos">
        <h2 class="tarjeta__titulo">Próximos relevos</h2>
        ${proximos.length ? `
          <ul class="mini-lista">
            ${proximos.map(r => `
              <li>
                <button type="button" class="mini-lista__fila" data-editar="${r.id}">
                  <span class="mini-lista__fecha">${fechaRelativa(r.fecha)}<span class="mono">${r.inicio}</span></span>
                  <span class="mini-lista__texto">
                    <strong>${esc(nombrePrograma(datos, r.programaId))}</strong>
                    <span>${r.relevoId ? `${esc(nombrePersona(datos, r.relevoId))} cubre a ${esc(nombrePersona(datos, r.titularId))}` : `Falta ${esc(nombrePersona(datos, r.titularId))}`}</span>
                  </span>
                  ${insigniaEstado(r.estado)}
                </button>
              </li>`).join("")}
          </ul>
          <a class="enlace-ver" href="#bitacora">Ver toda la bitácora ${icono("i-flecha")}</a>` : `
          <p class="tarjeta__nota">No hay relevos programados desde hoy.</p>`}
      </article>
      </div>
    </div>
  `;
}

/**
 * "Primeros pasos": aparece cuando la bitácora está vacía (por ejemplo, después
 * de "Empezar de cero"). Guía en 3 pasos y solo muestra el botón del paso actual.
 */
function htmlPrimerosPasos(config) {
  if (config.puedeRegistrar && config.relevos > 0) return "";

  const pasos = [
    {
      hecho: config.presentadores >= 2,
      titulo: "Agrega al equipo",
      texto: config.presentadores >= 2
        ? `${config.presentadores} presentadores activos.`
        : "Al menos 2 presentadores. Puedes pegar la lista completa de una vez.",
      boton: `<button class="boton boton--principal" type="button" data-accion="ir-presentadores">${icono("i-personas")} Agregar presentadores</button>`,
    },
    {
      hecho: config.programas >= 1,
      titulo: "Agrega los programas",
      texto: config.programas >= 1
        ? `${config.programas === 1 ? "1 programa" : config.programas + " programas"} en la parrilla.`
        : "Nombre, días, horario y quién lo presenta.",
      boton: `<button class="boton boton--principal" type="button" data-accion="nuevo-programa">${icono("i-parrilla")} Agregar programa</button>`,
    },
    {
      hecho: config.relevos > 0,
      titulo: "Registra el primer relevo",
      texto: "Cuando alguien no pueda salir al aire, anótalo y elige quién lo cubre.",
      boton: `<button class="boton boton--principal" type="button" data-accion="nuevo-relevo">${icono("i-mas")} Registrar relevo</button>`,
    },
  ];
  const actual = pasos.findIndex(p => !p.hecho);

  return `
    <section class="tarjeta primeros-pasos" aria-labelledby="titulo-primeros-pasos">
      <div class="tarjeta__cabecera">
        <h2 class="tarjeta__titulo" id="titulo-primeros-pasos" tabindex="-1">Primeros pasos</h2>
        <span class="tarjeta__sub">Paso ${actual + 1} de ${pasos.length}</span>
      </div>
      <ol class="pasos">
        ${pasos.map((p, i) => {
          const estado = p.hecho ? "hecho" : i === actual ? "actual" : "pendiente";
          const marca = p.hecho ? icono("i-check") : i + 1;
          const lector = { hecho: "Hecho: ", actual: "Paso actual: ", pendiente: "Después: " }[estado];
          return `
          <li class="paso paso--${estado}"${estado === "actual" ? ` aria-current="step"` : ""}>
            <span class="paso__marca" aria-hidden="true">${marca}</span>
            <div>
              <p class="paso__titulo"><span class="solo-lector">${lector}</span>${p.titulo}</p>
              <p class="paso__texto">${p.texto}</p>
              ${estado === "actual" ? `<div class="paso__accion">${p.boton}</div>` : ""}
            </div>
          </li>`;
        }).join("")}
      </ol>
      ${config.presentadores === 0 && config.programas === 0 ? `
        <p class="primeros-pasos__pie">¿Solo quieres probar cómo funciona?
          <button class="boton boton--texto boton--chico" type="button" data-accion="cargar-ejemplo">Cargar datos de ejemplo</button>
        </p>` : ""}
    </section>`;
}

/** Pendiente que aún no empieza: un toque abre el formulario con las sugerencias. */
function htmlAlertaPorCubrir(r) {
  return `
    <li>
      <button type="button" class="alerta" data-editar="${r.id}">
        ${icono("i-alerta", "icono alerta__icono")}
        <span class="alerta__texto">
          <strong>${esc(nombrePrograma(datos, r.programaId))}</strong>
          <span>${fechaRelativa(r.fecha)} · <span class="mono">${r.inicio}–${r.fin}</span> · falta ${esc(nombrePersona(datos, r.titularId))}</span>
        </span>
        <span class="alerta__accion">Buscar relevo ${icono("i-flecha")}</span>
      </button>
    </li>`;
}

/**
 * Pendiente que ya terminó: se resuelve en un toque.
 * "Se cubrió" abre el formulario listo para elegir quién;
 * "No salió" lo marca como sin cubrir al instante (con Deshacer).
 */
function htmlAlertaAtrasada(r) {
  const programa = esc(nombrePrograma(datos, r.programaId));
  const cuando = fechaRelativa(r.fecha);
  return `
    <li class="alerta alerta--pasada alerta--acciones">
      ${icono("i-alerta", "icono alerta__icono")}
      <span class="alerta__texto">
        <strong>${programa}</strong>
        <span>${cuando} · <span class="mono">${r.inicio}–${r.fin}</span> · faltó ${esc(nombrePersona(datos, r.titularId))}</span>
      </span>
      <span class="alerta__botones">
        <button type="button" class="boton boton--borde boton--chico" data-cubrir="${r.id}"
          aria-label="Se cubrió: ${programa}, ${cuando}. Elegir quién cubrió">${icono("i-check")} Se cubrió</button>
        <button type="button" class="boton boton--peligro-borde boton--chico" data-sin-cubrir="${r.id}"
          aria-label="No salió al aire: ${programa}, ${cuando}">${icono("i-mic-off")} No salió</button>
      </span>
    </li>`;
}

/**
 * Tarjeta "Al aire ahora": como la luz de estudio y un medidor VU
 * que se va llenando a medida que avanza el programa.
 */
function htmlTarjetaAire() {
  const ahora = alAireAhora(datos);
  if (!ahora) {
    const siguiente = programasDelDia(datos, hoyISO()).find(p => p.inicio > horaAhora());
    return `
      <article class="tarjeta tarjeta--aire fuera-del-aire" id="tarjeta-aire">
        <p class="sobretitulo">Ahora</p>
        <h2 class="aire__programa">Fuera del aire</h2>
        <p class="aire__persona texto-suave">${siguiente
          ? `Sigue «${esc(siguiente.nombre)}» a las <span class="mono">${siguiente.inicio}</span>`
          : "Onda Viva transmite de lunes a sábado."}</p>
      </article>`;
  }

  const { programa, relevo } = ahora;
  let quien;
  if (!relevo) {
    quien = `${icono("i-mic")} ${botonPersona(programa.titularId)}`;
  } else if (relevo.estado === "cubierto") {
    quien = `${icono("i-mic")} ${botonPersona(relevo.relevoId)} <span class="aire__cubre">cubre a ${esc(nombrePersona(datos, relevo.titularId))}</span>`;
  } else if (relevo.estado === "pendiente") {
    quien = `${icono("i-alerta")} Sin presentador confirmado`;
  } else {
    quien = `${icono("i-mic-off")} No salió al aire`;
  }

  // Avance del programa en 20 "LED": verde, luego ámbar y al final rojo
  const total = aMinutos(programa.fin) - aMinutos(programa.inicio);
  const pasados = aMinutos(horaAhora()) - aMinutos(programa.inicio);
  const encendidos = Math.max(1, Math.round((pasados / total) * 20));
  const faltan = total - pasados;
  const leds = Array.from({ length: 20 }, (_, i) => {
    const clase = i < encendidos ? `on${i >= 16 ? " alto" : i >= 12 ? " medio" : ""}` : "";
    return `<span class="${clase}"></span>`;
  }).join("");

  return `
    <article class="tarjeta tarjeta--aire" id="tarjeta-aire">
      <p class="sobretitulo"><span class="punto-vivo" aria-hidden="true"></span>Al aire ahora · ${programa.inicio}–${programa.fin}</p>
      <h2 class="aire__programa">${esc(programa.nombre)}</h2>
      <p class="aire__persona">${quien}</p>
      ${relevo ? `<div class="aire__estado">${insigniaEstado(relevo.estado)}</div>` : ""}
      <div class="vu" role="img" aria-label="Avance del programa: faltan ${faltan} minutos">${leds}</div>
      <div class="vu__texto" aria-hidden="true"><span>${programa.inicio}</span><span>faltan ${faltan} min</span><span>${programa.fin}</span></div>
    </article>`;
}
