/* ==========================================================
   vistas/reportes.js — Cuentas, resumen del mes y gráficas
   ----------------------------------------------------------
   Requisito 07: contador por presentador.
   Nivel 2: resumen del mes (relevos, horas, pendientes).
   Nivel 3: saldo de equidad, gráficas y reporte imprimible.
   Las gráficas se dibujan a mano con SVG y HTML (sin librerías).
   ========================================================== */

const Reporte = { mes: null }; // "2026-11"

function pintarReportes() {
  if (!Reporte.mes) Reporte.mes = hoyISO().slice(0, 7);
  const mes = Reporte.mes;
  const [anio, numMes] = mes.split("-").map(Number);
  const nombreMes = `${MESES[numMes - 1]} de ${anio}`;
  const resumen = resumenDelMes(datos, mes);
  const delMes = contarPorPersona(datos, mes)
    .filter(f => f.hechos > 0 || f.recibidos > 0)
    .sort((a, b) => (b.horas - a.horas) || a.persona.nombre.localeCompare(b.persona.nombre));
  const general = contarPorPersona(datos);

  document.getElementById("vista-reportes").innerHTML = `
    <div class="vista__encabezado">
      <div>
        <p class="sobretitulo">Reporte mensual</p>
        <h1 id="titulo-reportes">Reportes</h1>
      </div>
      <div class="vista__acciones no-imprimir">
        <div class="campo campo--en-linea">
          <label for="reporte-mes">Mes</label>
          <input id="reporte-mes" type="month" value="${mes}">
        </div>
        <button class="boton boton--principal" type="button" id="boton-imprimir">Imprimir o guardar PDF</button>
      </div>
    </div>

    <div class="solo-impresion encabezado-impreso">
      <strong>Relévame · Onda Viva</strong>
      <span>Reporte de ${nombreMes} · generado el ${fechaLarga(hoyISO())}</span>
    </div>

    <h2 class="seccion-titulo">Resumen de ${nombreMes}</h2>
    <div class="cifras cifras--grandes">
      <div class="cifra"><span class="cifra__valor mono">${resumen.total}</span><span class="cifra__etiqueta">relevos registrados</span></div>
      <div class="cifra cifra--cubierto"><span class="cifra__valor mono">${resumen.cubiertos}</span><span class="cifra__etiqueta">${icono("i-check")}cubiertos</span></div>
      <div class="cifra cifra--pendiente"><span class="cifra__valor mono">${resumen.pendientes}</span><span class="cifra__etiqueta">${icono("i-reloj")}pendientes</span></div>
      <div class="cifra cifra--sin-cubrir"><span class="cifra__valor mono">${resumen.sinCubrir}</span><span class="cifra__etiqueta">${icono("i-mic-off")}sin cubrir</span></div>
      <div class="cifra"><span class="cifra__valor mono">${textoHoras(resumen.horas)}</span><span class="cifra__etiqueta">horas cubiertas</span></div>
    </div>

    <div class="rejilla-2">
      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Relevos por semana</h3>
        ${graficaSemanas(mes)}
      </article>
      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Presentadores con más horas cubiertas</h3>
        ${graficaHoras(delMes)}
      </article>
    </div>

    <div class="rejilla-2">
      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Programas pendientes o sin cubrir</h3>
        ${resumen.porResolver.length ? `
          <ul class="mini-lista">
            ${resumen.porResolver.map(r => `
              <li>
                <button type="button" class="mini-lista__fila" data-editar="${r.id}">
                  <span class="mini-lista__fecha">${fechaCorta(r.fecha)}<span class="mono">${r.inicio}</span></span>
                  <span class="mini-lista__texto"><strong>${esc(nombrePrograma(datos, r.programaId))}</strong><span>Faltó ${esc(nombrePersona(datos, r.titularId))}</span></span>
                  ${insigniaEstado(r.estado)}
                </button>
              </li>`).join("")}
          </ul>` : `<p class="tarjeta__nota tarjeta__nota--ok">${icono("i-check")} Todos los relevos del mes quedaron cubiertos.</p>`}
      </article>

      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Horas cubiertas por presentador</h3>
        ${delMes.length ? `
          <div class="tabla-caja">
            <table class="tabla tabla--compacta">
              <thead><tr><th scope="col">Presentador</th><th scope="col" class="num">Relevos</th><th scope="col" class="num">Horas</th><th scope="col" class="num">Lo relevaron</th></tr></thead>
              <tbody>${delMes.map(f => `
                <tr><td>${botonPersona(f.persona.id)}</td><td class="num mono">${f.hechos}</td><td class="num mono">${textoHoras(f.horas)}</td><td class="num mono">${f.recibidos}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>` : `<p class="tarjeta__nota">No hay relevos cubiertos este mes.</p>`}
      </article>
    </div>

    <h2 class="seccion-titulo salto-pagina">Contador general <span class="seccion-titulo__sub">Todo el historial</span></h2>
    <article class="tarjeta">
      <p class="tarjeta__nota">
        <strong>Saldo de equidad</strong> = relevos que hizo − veces que lo relevaron.
        Positivo: ha cubierto más de lo que le han cubierto. Negativo: le han cubierto más.
      </p>
      ${general.length ? `
      <div class="tabla-caja">
        <table class="tabla tabla--contador">
          <thead>
            <tr>
              <th scope="col">Presentador</th>
              <th scope="col" class="num">Relevos hechos</th>
              <th scope="col" class="num">Veces relevado</th>
              <th scope="col" class="num">Horas cubiertas</th>
              <th scope="col">Saldo de equidad</th>
              <th scope="col">Esta semana</th>
            </tr>
          </thead>
          <tbody>${general.map(filaContador).join("")}</tbody>
        </table>
      </div>` : estadoVacio("Aún no hay presentadores", "Agrégalos en Ajustes.")}
    </article>

    ${htmlEquidad(general)}
  `;
}

function filaContador(f) {
  const maximo = 6; // la barra del saldo llega al tope en ±6
  const ancho = Math.min(Math.abs(f.saldo), maximo) / maximo * 50;
  const signo = f.saldo > 0 ? "+" : f.saldo < 0 ? "−" : "";
  const clase = f.saldo > 0 ? "saldo--positivo" : f.saldo < 0 ? "saldo--negativo" : "";
  return `
    <tr>
      <td data-etiqueta="Presentador"><strong>${botonPersona(f.persona.id)}</strong>${f.persona.activo ? "" : ` <span class="texto-suave">(inactivo)</span>`}</td>
      <td data-etiqueta="Relevos hechos" class="num mono">${f.hechos}</td>
      <td data-etiqueta="Veces relevado" class="num mono">${f.recibidos}</td>
      <td data-etiqueta="Horas cubiertas" class="num mono">${textoHoras(f.horas)}</td>
      <td data-etiqueta="Saldo">
        <span class="saldo ${clase}">
          <span class="saldo__pista" aria-hidden="true"><span class="saldo__barra" style="width:${ancho}%"></span></span>
          <span class="saldo__valor mono">${signo}${Math.abs(f.saldo)}</span>
        </span>
      </td>
      <td data-etiqueta="Esta semana">${cupo(f.semana)}</td>
    </tr>`;
}

/* ---------- Saldo de equidad (Nivel 3) ---------- */

function htmlEquidad(filas) {
  const dan = filas.filter(f => f.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 5);
  const reciben = filas.filter(f => f.saldo < 0).sort((a, b) => a.saldo - b.saldo).slice(0, 5);
  const lista = (items, vacio) => items.length
    ? `<ol class="ranking">${items.map(f => `<li><span>${botonPersona(f.persona.id)}</span><span class="mono">${f.saldo > 0 ? "+" : "−"}${Math.abs(f.saldo)}</span></li>`).join("")}</ol>`
    : `<p class="tarjeta__nota">${vacio}</p>`;
  return `
    <div class="rejilla-2">
      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Han cubierto más de lo que les cubrieron</h3>
        ${lista(dan, "Nadie tiene saldo a favor todavía.")}
      </article>
      <article class="tarjeta">
        <h3 class="tarjeta__titulo">Les han cubierto más de lo que han cubierto</h3>
        ${lista(reciben, "Nadie tiene saldo en contra todavía.")}
        ${reciben.length ? `<p class="tarjeta__nota">Para repartir mejor, la sugerencia de relevos pone primero a quien ha cubierto menos.</p>` : ""}
      </article>
    </div>`;
}

/* ---------- Gráfica: relevos por semana (SVG, columnas apiladas) ---------- */

function graficaSemanas(mes) {
  const primerDia = `${mes}-01`;
  const [anio, numMes] = mes.split("-").map(Number);
  const ultimoDia = aISO(new Date(anio, numMes, 0));

  // Semanas (lunes a domingo) que tocan el mes
  const semanas = [];
  for (let lunes = lunesDe(primerDia); lunes <= ultimoDia; lunes = sumarDias(lunes, 7)) {
    const domingo = sumarDias(lunes, 6);
    const relevos = datos.relevos.filter(r => r.fecha.startsWith(mes) && r.fecha >= lunes && r.fecha <= domingo);
    semanas.push({
      lunes,
      cubierto: relevos.filter(r => r.estado === "cubierto").length,
      pendiente: relevos.filter(r => r.estado === "pendiente").length,
      "sin-cubrir": relevos.filter(r => r.estado === "sin-cubrir").length,
      total: relevos.length,
    });
  }

  if (semanas.every(s => s.total === 0)) return `<p class="tarjeta__nota">No hay relevos en este mes.</p>`;

  const ancho = 560, alto = 220, margenIzq = 8, margenAbajo = 36, margenArriba = 22;
  const maximo = Math.max(...semanas.map(s => s.total), 1);
  const paso = (ancho - margenIzq * 2) / semanas.length;
  const anchoBarra = Math.min(56, paso * 0.55);
  const escala = (alto - margenAbajo - margenArriba) / maximo;
  const base = alto - margenAbajo;
  const orden = ["cubierto", "pendiente", "sin-cubrir"]; // de abajo hacia arriba

  let barras = "";
  semanas.forEach((s, i) => {
    const x = margenIzq + paso * i + (paso - anchoBarra) / 2;
    let y = base;
    for (const estado of orden) {
      const h = s[estado] * escala;
      if (h > 0) {
        y -= h;
        barras += `<rect class="barra barra--${estado}" x="${x}" y="${y}" width="${anchoBarra}" height="${h}"><title>${ESTADOS[estado].texto}: ${s[estado]}</title></rect>`;
      }
    }
    barras += `<text class="grafica__valor" x="${x + anchoBarra / 2}" y="${y - 6}" text-anchor="middle">${s.total}</text>`;
    barras += `<text class="grafica__eje" x="${x + anchoBarra / 2}" y="${base + 18}" text-anchor="middle">${aFecha(s.lunes).getDate()} ${MESES_CORTOS[aFecha(s.lunes).getMonth()]}</text>`;
  });

  const descripcion = semanas.map(s => `semana del ${fechaSinAnio(s.lunes)}: ${s.total}`).join("; ");

  return `
    <svg class="grafica" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Relevos por semana. ${esc(descripcion)}">
      <line class="grafica__base" x1="0" x2="${ancho}" y1="${base}" y2="${base}"/>
      ${barras}
    </svg>
    <div class="leyenda leyenda--chica">${orden.map(e => `<span class="leyenda__item"><span class="leyenda__muestra leyenda__muestra--${e}"></span>${ESTADOS[e].texto}</span>`).join("")}</div>
    <details class="detalles-datos">
      <summary>Ver los datos en tabla</summary>
      <table class="tabla tabla--compacta">
        <thead><tr><th scope="col">Semana del</th><th scope="col" class="num">Cubiertos</th><th scope="col" class="num">Pendientes</th><th scope="col" class="num">Sin cubrir</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody>${semanas.map(s => `<tr><td>${fechaSinAnio(s.lunes)}</td><td class="num mono">${s.cubierto}</td><td class="num mono">${s.pendiente}</td><td class="num mono">${s["sin-cubrir"]}</td><td class="num mono">${s.total}</td></tr>`).join("")}</tbody>
      </table>
    </details>`;
}

/* ---------- Gráfica: horas por presentador (barras horizontales) ---------- */

function graficaHoras(filas) {
  const top = filas.filter(f => f.horas > 0).sort((a, b) => b.horas - a.horas).slice(0, 8);
  if (!top.length) return `<p class="tarjeta__nota">No hay horas cubiertas este mes.</p>`;
  const maximo = top[0].horas;
  return `
    <ol class="barras-h" aria-label="Horas cubiertas por presentador, de mayor a menor">
      ${top.map(f => `
        <li class="barras-h__fila">
          <span class="barras-h__nombre">${esc(f.persona.nombre)}</span>
          <span class="barras-h__pista" aria-hidden="true"><span class="barras-h__barra" style="width:${(f.horas / maximo) * 100}%"></span></span>
          <span class="barras-h__valor mono">${textoHoras(f.horas)}</span>
        </li>`).join("")}
    </ol>`;
}

/* ---------- Eventos ---------- */

function prepararReportes() {
  const vista = document.getElementById("vista-reportes");
  vista.addEventListener("change", evento => {
    if (evento.target.id === "reporte-mes" && evento.target.value) {
      Reporte.mes = evento.target.value;
      pintarReportes();
      document.getElementById("reporte-mes").focus();
    }
  });
  vista.addEventListener("click", evento => {
    if (evento.target.closest("#boton-imprimir")) window.print();
  });
}
