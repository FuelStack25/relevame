/* ==========================================================
   vistas/parrilla.js — Parrilla semanal (lunes a sábado)
   ----------------------------------------------------------
   Como la parrilla de programación de una emisora: filas por
   hora y columnas por día. Tocar un programa abre el
   formulario ya lleno con esa fecha y ese programa.
   En el celular se ve un día a la vez.
   ========================================================== */

const Parrilla = {
  lunes: null, // lunes de la semana que se está viendo
  dia: null,   // día elegido en la vista de celular
};

const MINUTOS_FILA = 30; // cada fila de la cuadrícula = 30 minutos

function pintarParrilla() {
  const hoy = hoyISO();
  if (!Parrilla.lunes) Parrilla.lunes = lunesDe(hoy);
  const dias = [0, 1, 2, 3, 4, 5].map(i => sumarDias(Parrilla.lunes, i)); // lun … sáb
  if (!Parrilla.dia || !dias.includes(Parrilla.dia)) {
    Parrilla.dia = dias.includes(hoy) ? hoy : dias[0];
  }

  const vista = document.getElementById("vista-parrilla");

  if (datos.programas.length === 0) {
    vista.innerHTML = `
      <div class="vista__encabezado"><h1 id="titulo-parrilla">Parrilla</h1></div>
      ${estadoVacio("Aún no hay programas", "Agrega los programas de Onda Viva en Ajustes para ver la parrilla.",
        `<a class="boton boton--principal" href="#ajustes">Ir a Ajustes</a>`)}`;
    return;
  }

  const esEstaSemana = Parrilla.lunes === lunesDe(hoy);

  vista.innerHTML = `
    <div class="vista__encabezado">
      <div>
        <p class="sobretitulo">Programación de la semana</p>
        <h1 id="titulo-parrilla">Parrilla</h1>
        <p class="vista__ayuda">Toca un programa para registrar o ver su relevo.</p>
      </div>
      <div class="vista__acciones">
        <div class="semana-nav" role="group" aria-label="Cambiar de semana">
          <button class="boton-icono boton-icono--borde" type="button" data-semana="-7" aria-label="Semana anterior">${icono("i-izq")}</button>
          <span class="semana-nav__texto">${rangoCorto(dias[0], dias[5])}</span>
          <button class="boton-icono boton-icono--borde" type="button" data-semana="7" aria-label="Semana siguiente">${icono("i-der")}</button>
          <button class="boton boton--borde boton--chico" type="button" data-semana="hoy" ${esEstaSemana ? "disabled" : ""}>Esta semana</button>
        </div>
        <a class="boton boton--whatsapp boton--chico" href="${esc(enlaceWhatsApp("", mensajeResumenSemana(Parrilla.lunes)))}"
           target="_blank" rel="noopener" title="Abre WhatsApp con el resumen listo para el grupo del equipo">
          ${icono("i-mensaje")} Enviar resumen al grupo
        </a>
      </div>
    </div>

    <div class="leyenda" aria-label="Convenciones">
      <span class="leyenda__item"><span class="leyenda__muestra"></span>Sin novedad</span>
      ${insigniaEstado("pendiente")}${insigniaEstado("cubierto")}${insigniaEstado("sin-cubrir")}
    </div>

    ${htmlCuadricula(dias, hoy)}
    ${htmlDiaMovil(dias, hoy)}
  `;
}

/** "23 – 28 nov" o "30 nov – 5 dic" */
function rangoCorto(desde, hasta) {
  const a = aFecha(desde), b = aFecha(hasta);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`
    : `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} – ${b.getDate()} ${MESES_CORTOS[b.getMonth()]}`;
}

/* ---------- Computador: cuadrícula semanal ---------- */

function htmlCuadricula(dias, hoy) {
  const minimo = Math.floor(Math.min(...datos.programas.map(p => aMinutos(p.inicio))) / 60) * 60;
  const maximo = Math.ceil(Math.max(...datos.programas.map(p => aMinutos(p.fin))) / 60) * 60;
  const filas = (maximo - minimo) / MINUTOS_FILA;
  const fila = minutos => Math.round((minutos - minimo) / MINUTOS_FILA) + 2; // +2: la fila 1 es el encabezado

  let html = `<div class="cuadricula" style="--filas:${filas}">`;

  // Encabezados de los días
  html += `<div class="cuadricula__esquina"></div>`;
  dias.forEach((fecha, i) => {
    html += `<div class="cuadricula__dia${fecha === hoy ? " es-hoy" : ""}" style="grid-column:${i + 2}">
      <span>${DIAS_CORTOS[diaSemana(fecha)]}</span><strong>${aFecha(fecha).getDate()}</strong>
    </div>`;
  });

  // Horas y celdas de fondo (una por hora y por día)
  for (let m = minimo; m < maximo; m += 60) {
    const f = fila(m);
    html += `<div class="cuadricula__hora mono" style="grid-row:${f} / span 2">${String(m / 60).padStart(2, "0")}:00</div>`;
    dias.forEach((fecha, i) => {
      html += `<div class="cuadricula__hueco${fecha === hoy ? " es-hoy" : ""}" style="grid-row:${f} / span 2;grid-column:${i + 2}"></div>`;
    });
  }

  // Programas
  dias.forEach((fecha, i) => {
    for (const programa of programasDelDia(datos, fecha)) {
      const inicio = fila(aMinutos(programa.inicio));
      const alto = Math.max(1, fila(aMinutos(programa.fin)) - inicio);
      html += htmlBloquePrograma(programa, fecha, hoy, `grid-row:${inicio} / span ${alto};grid-column:${i + 2}`, alto);
    }
  });

  return html + `</div>`;
}

/** Un programa dentro de la parrilla (botón). */
function htmlBloquePrograma(programa, fecha, hoy, estilo, alto) {
  const relevo = datos.relevos.find(r => r.programaId === programa.id && r.fecha === fecha);
  const titular = nombrePersona(datos, programa.titularId);
  const ahora = horaAhora();
  const enVivo = fecha === hoy && programa.inicio <= ahora && ahora < programa.fin;
  const pasado = (fecha < hoy ? " es-pasado" : "") + (enVivo ? " al-aire-ahora" : "");

  let persona, clase = "", descripcion;
  if (!relevo) {
    persona = esc(titular);
    descripcion = `Presenta ${titular}. Sin novedad. Toca para registrar un relevo.`;
  } else {
    const info = ESTADOS[relevo.estado];
    clase = ` bloque--${relevo.estado}`;
    persona = relevo.estado === "cubierto"
      ? `${icono(info.icono)}${esc(nombrePersona(datos, relevo.relevoId))}`
      : `${icono(info.icono)}${info.texto}`;
    descripcion = `${info.texto}. Falta ${titular}${relevo.relevoId ? `, cubre ${nombrePersona(datos, relevo.relevoId)}` : ""}. Toca para ver o editar.`;
  }

  const atributos = relevo ? `data-editar="${relevo.id}"` : `data-crear="${programa.id}" data-fecha="${fecha}"`;
  const etiqueta = `${programa.nombre}, ${fechaLarga(fecha)}, ${horario(programa.inicio, programa.fin)}. ${descripcion}`;

  return `<button type="button" class="bloque${clase}${pasado}${alto <= 2 ? " bloque--corto" : ""}" style="${estilo}" ${atributos} aria-label="${esc(etiqueta)}">
    <span class="bloque__nombre">${esc(programa.nombre)}</span>
    <span class="bloque__persona">${persona}</span>
    ${alto > 2 ? `<span class="bloque__hora mono">${programa.inicio}–${programa.fin}</span>` : ""}
  </button>`;
}

/* ---------- Celular: un día a la vez ---------- */

function htmlDiaMovil(dias, hoy) {
  const chips = dias.map(fecha => `
    <button type="button" class="dia-chip${fecha === Parrilla.dia ? " activo" : ""}${fecha === hoy ? " es-hoy" : ""}"
      data-dia="${fecha}" aria-pressed="${fecha === Parrilla.dia}">
      <span>${DIAS_CORTOS[diaSemana(fecha)]}</span><strong>${aFecha(fecha).getDate()}</strong>
    </button>`).join("");

  const programas = programasDelDia(datos, Parrilla.dia);
  const filas = programas.map(p => `
    <li class="dia-movil__fila">
      <span class="dia-movil__hora mono">${p.inicio}<br>${p.fin}</span>
      ${htmlBloquePrograma(p, Parrilla.dia, hoy, "", 2)}
    </li>`).join("");

  return `
    <div class="dia-movil">
      <div class="dia-movil__chips" role="group" aria-label="Elegir día">${chips}</div>
      <h2 class="dia-movil__titulo">${esc(fechaLarga(Parrilla.dia))}</h2>
      ${programas.length ? `<ul class="dia-movil__lista">${filas}</ul>` : `<p class="tarjeta__nota">No hay programas este día.</p>`}
    </div>`;
}

/* ---------- Eventos propios de la parrilla ---------- */

function prepararParrilla() {
  const vista = document.getElementById("vista-parrilla");
  vista.addEventListener("click", evento => {
    const semana = evento.target.closest("[data-semana]");
    if (semana) {
      const valor = semana.dataset.semana;
      Parrilla.lunes = valor === "hoy" ? lunesDe(hoyISO()) : sumarDias(Parrilla.lunes, Number(valor));
      Parrilla.dia = null;
      pintarParrilla();
      return;
    }
    const dia = evento.target.closest("[data-dia]");
    if (dia) {
      Parrilla.dia = dia.dataset.dia;
      pintarParrilla();
      return;
    }
    const crear = evento.target.closest("[data-crear]");
    if (crear) {
      abrirFormulario({ valores: { programaId: crear.dataset.crear, fecha: crear.dataset.fecha } });
    }
  });
}
