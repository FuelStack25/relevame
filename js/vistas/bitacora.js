/* ==========================================================
   vistas/bitacora.js — Lista de todos los relevos
   ----------------------------------------------------------
   Requisito 04: del más reciente al más antiguo.
   Nivel 2: buscar y filtrar; exportar a CSV.
   Nivel 3: marca los choques de horario.
   ========================================================== */

const Filtros = { texto: "", persona: "", programa: "", estado: "", desde: "", hasta: "" };

// La lista se muestra por partes para que siga ágil con meses de historial
const PASO_BITACORA = 50;
const Bitacora = { limite: PASO_BITACORA };

/** Quita todos los filtros y vuelve a mostrar desde el principio. */
function limpiarFiltros() {
  Object.keys(Filtros).forEach(k => { Filtros[k] = ""; });
  Bitacora.limite = PASO_BITACORA;
}

function pintarBitacora() {
  const vista = document.getElementById("vista-bitacora");

  const personas = [...datos.presentadores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const programas = [...datos.programas].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const opcion = (valor, texto, actual) =>
    `<option value="${esc(valor)}"${valor === actual ? " selected" : ""}>${esc(texto)}</option>`;

  vista.innerHTML = `
    <div class="vista__encabezado">
      <div>
        <p class="sobretitulo">Del más reciente al más antiguo</p>
        <h1 id="titulo-bitacora">Bitácora</h1>
      </div>
      <div class="vista__acciones">
        <button class="boton boton--borde" type="button" id="boton-csv">${icono("i-descargar")} Exportar a CSV</button>
        <button class="boton boton--borde" type="button" data-accion="nueva-ausencia" title="Atajo: A">${icono("i-ausencia")} Registrar ausencia</button>
        <button class="boton boton--principal" type="button" data-accion="nuevo-relevo" title="Atajo: N">${icono("i-mas")} Registrar relevo</button>
      </div>
    </div>

    <form class="filtros" id="filtros" role="search" aria-label="Filtrar relevos" onsubmit="return false">
      <div class="campo filtros__buscar">
        <label for="filtro-texto">Buscar</label>
        <div class="input-icono">
          ${icono("i-buscar")}
          <input id="filtro-texto" name="texto" type="search" placeholder="Nombre, programa u observación  ( / )" value="${esc(Filtros.texto)}">
        </div>
      </div>
      <details class="filtros__mas" ${filtrosAbiertos() ? "open" : ""}>
        <summary>Más filtros <span class="filtros__contador" id="filtros-contador" hidden></span></summary>
        <div class="filtros__rejilla">
      <div class="campo">
        <label for="filtro-persona">Presentador</label>
        <select id="filtro-persona" name="persona">
          ${opcion("", "Todos", Filtros.persona)}
          ${personas.map(p => opcion(p.id, p.nombre, Filtros.persona)).join("")}
        </select>
      </div>
      <div class="campo">
        <label for="filtro-programa">Programa</label>
        <select id="filtro-programa" name="programa">
          ${opcion("", "Todos", Filtros.programa)}
          ${programas.map(p => opcion(p.id, p.nombre + (programaActivo(p) ? "" : " (retirado)"), Filtros.programa)).join("")}
        </select>
      </div>
      <div class="campo">
        <label for="filtro-desde">Desde</label>
        <input id="filtro-desde" name="desde" type="date" value="${esc(Filtros.desde)}">
      </div>
      <div class="campo">
        <label for="filtro-hasta">Hasta</label>
        <input id="filtro-hasta" name="hasta" type="date" value="${esc(Filtros.hasta)}">
      </div>
        </div>
      </details>
    </form>

    <div id="resultados-bitacora"></div>
  `;

  pintarResultadosBitacora();
}

/**
 * Relevos que pasan los filtros, ya ordenados.
 * Con { conEstado: false } se ignora el filtro de estado (para contar cada estado).
 */
function relevosFiltrados({ conEstado = true } = {}) {
  const texto = Filtros.texto.trim().toLowerCase();
  return relevosOrdenados(datos.relevos).filter(r => {
    if (Filtros.persona && r.titularId !== Filtros.persona && r.relevoId !== Filtros.persona) return false;
    if (Filtros.programa && r.programaId !== Filtros.programa) return false;
    if (conEstado && Filtros.estado && r.estado !== Filtros.estado) return false;
    if (Filtros.desde && r.fecha < Filtros.desde) return false;
    if (Filtros.hasta && r.fecha > Filtros.hasta) return false;
    if (texto) {
      const todo = [
        nombrePrograma(datos, r.programaId), nombrePersona(datos, r.titularId),
        r.relevoId ? nombrePersona(datos, r.relevoId) : "", r.motivo, r.observaciones,
      ].join(" ").toLowerCase();
      if (!todo.includes(texto)) return false;
    }
    return true;
  });
}

function hayFiltros() {
  return Object.values(Filtros).some(v => v !== "");
}

/** Cuántos filtros de "Más filtros" están activos (sin el buscador ni el estado). */
function cuantosFiltros() {
  return ["persona", "programa", "desde", "hasta"].filter(k => Filtros[k] !== "").length;
}

/** Botones de estado con su conteo, siempre a la vista (también en celular). */
function htmlChipsEstado(base) {
  const opciones = [
    ["", "Todos", base.length],
    ...Object.entries(ESTADOS).map(([valor, info]) => [valor, info.texto, base.filter(r => r.estado === valor).length]),
  ];
  return `
    <div class="chips" role="group" aria-label="Filtrar por estado">
      ${opciones.map(([valor, texto, n]) => `
        <button type="button" class="chip${valor ? ` chip--${valor}` : ""}" data-filtro-estado="${valor}" aria-pressed="${Filtros.estado === valor}">
          ${valor ? icono(ESTADOS[valor].icono) : ""}${texto} <span class="chip__n">${n}</span>
        </button>`).join("")}
    </div>`;
}

/** En computador los filtros siempre se ven; en celular, solo si se abren o hay alguno activo. */
function filtrosAbiertos() {
  return window.matchMedia("(min-width: 1024px)").matches || cuantosFiltros() > 0;
}

/** Solo repinta la tabla (así no se pierde el foco al escribir en el buscador). */
function pintarResultadosBitacora() {
  const caja = document.getElementById("resultados-bitacora");
  if (!caja) return;
  const base = relevosFiltrados({ conEstado: false });
  const lista = Filtros.estado ? base.filter(r => r.estado === Filtros.estado) : base;
  document.getElementById("boton-csv").disabled = lista.length === 0;

  const contador = document.getElementById("filtros-contador");
  contador.hidden = cuantosFiltros() === 0;
  contador.textContent = cuantosFiltros();

  if (datos.relevos.length === 0) {
    caja.innerHTML = estadoVacio("Aún no hay relevos",
      "Cuando alguien no pueda salir al aire, regístralo aquí.",
      `<button class="boton boton--principal" type="button" data-accion="nuevo-relevo">${icono("i-mas")} Registrar el primero</button>`);
    return;
  }

  const barra = htmlChipsEstado(base) + `
    <div class="resultados__barra">
      <p class="resultados__conteo" role="status">Mostrando <strong>${lista.length}</strong> de ${datos.relevos.length} relevos</p>
      ${hayFiltros() ? `<button class="boton boton--texto boton--chico" type="button" id="limpiar-filtros">${icono("i-x")} Quitar filtros</button>` : ""}
    </div>`;

  if (lista.length === 0) {
    caja.innerHTML = barra + estadoVacio("Ningún relevo coincide", "Prueba con otros filtros o quítalos.");
    return;
  }

  caja.innerHTML = barra + `
    <div class="tabla-caja">
      <table class="tabla tabla--relevos">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Programa</th>
            <th scope="col">Horario</th>
            <th scope="col">Titular · falta</th>
            <th scope="col">Relevo · cubre</th>
            <th scope="col">Motivo</th>
            <th scope="col">Estado</th>
            <th scope="col"><span class="solo-lector">Acciones</span></th>
          </tr>
        </thead>
        <tbody>${lista.slice(0, Bitacora.limite).map(filaRelevo).join("")}</tbody>
      </table>
    </div>
    ${lista.length > Bitacora.limite ? `
      <button class="boton boton--borde boton--ancho mostrar-mas" type="button" id="mostrar-mas">
        Mostrar ${Math.min(PASO_BITACORA, lista.length - Bitacora.limite)} más · quedan ${lista.length - Bitacora.limite}
      </button>` : ""}`;
}

/** "Hoy · mar 24 nov" o "lun 30 nov" (+ año si no es el año actual). */
function celdaFecha(fecha) {
  const relativa = fechaRelativa(fecha);
  const corta = fechaCorta(fecha);
  const anio = aFecha(fecha).getFullYear();
  const extra = relativa !== corta ? corta : (anio !== new Date().getFullYear() ? String(anio) : "");
  return `<span class="celda-fecha">${relativa}</span>${extra ? `<span class="celda-anio">${extra}</span>` : ""}`;
}

function filaRelevo(r) {
  const choque = choqueDeRelevo(datos, r);
  return `
    <tr class="${r.fecha < hoyISO() ? "es-pasado" : ""}">
      <td data-etiqueta="Fecha">${celdaFecha(r.fecha)}</td>
      <td data-etiqueta="Programa" class="celda-programa">
        <strong>${esc(nombrePrograma(datos, r.programaId))}</strong>
        ${r.observaciones ? `<span class="celda-obs">${esc(r.observaciones)}</span>` : ""}
      </td>
      <td data-etiqueta="Horario" class="mono">${r.inicio}–${r.fin}</td>
      <td data-etiqueta="Titular">${botonPersona(r.titularId)}</td>
      <td data-etiqueta="Relevo">
        ${botonPersona(r.relevoId)}
        ${choque ? `<span class="choque">${icono("i-alerta")}Choque: ${esc(choque)}</span>` : ""}
      </td>
      <td data-etiqueta="Motivo">${r.motivo ? esc(r.motivo) : `<span class="texto-suave">—</span>`}</td>
      <td data-etiqueta="Estado">${insigniaEstado(r.estado)}</td>
      <td class="celda-acciones">
        <button class="boton-icono" type="button" data-editar="${r.id}" aria-label="Editar relevo de ${esc(nombrePrograma(datos, r.programaId))}, ${fechaCorta(r.fecha)}">${icono("i-lapiz")}</button>
        <button class="boton-icono boton-icono--peligro" type="button" data-borrar="${r.id}" aria-label="Borrar relevo de ${esc(nombrePrograma(datos, r.programaId))}, ${fechaCorta(r.fecha)}">${icono("i-papelera")}</button>
      </td>
    </tr>`;
}

/* ---------- Exportar a CSV (Excel / Google Sheets) ---------- */

function exportarCSV() {
  const lista = relevosFiltrados();
  // Excel en español usa ";" como separador. El BOM (﻿) hace que lea bien las tildes.
  const celda = valor => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const encabezado = ["Fecha", "Día", "Programa", "Inicio", "Fin", "Horas", "Titular", "Relevo", "Motivo", "Estado", "Observaciones"];
  const filas = lista.map(r => [
    r.fecha,
    DIAS_LARGOS[diaSemana(r.fecha)],
    nombrePrograma(datos, r.programaId),
    r.inicio,
    r.fin,
    String(duracionHoras(r.inicio, r.fin)).replace(".", ","),
    nombrePersona(datos, r.titularId),
    r.relevoId ? nombrePersona(datos, r.relevoId) : "",
    r.motivo,
    ESTADOS[r.estado].texto,
    r.observaciones,
  ]);
  const csv = "﻿" + [encabezado, ...filas].map(f => f.map(celda).join(";")).join("\r\n");
  descargarArchivo(`relevos-onda-viva-${hoyISO()}.csv`, csv, "text/csv;charset=utf-8");
  avisar(`Se descargó el archivo con ${lista.length} relevos.`);
}

/* ---------- Eventos ---------- */

function prepararBitacora() {
  const vista = document.getElementById("vista-bitacora");

  vista.addEventListener("input", evento => {
    const campo = evento.target;
    if (!campo.closest("#filtros")) return;
    Filtros[campo.name] = campo.value;
    Bitacora.limite = PASO_BITACORA;
    pintarResultadosBitacora();
  });

  vista.addEventListener("click", async evento => {
    if (evento.target.closest("#boton-csv")) return exportarCSV();

    const chip = evento.target.closest("[data-filtro-estado]");
    if (chip) {
      Filtros.estado = chip.dataset.filtroEstado;
      Bitacora.limite = PASO_BITACORA;
      pintarResultadosBitacora();
      // Se repinta la barra: el foco vuelve al botón tocado
      document.querySelector(`#resultados-bitacora [data-filtro-estado="${Filtros.estado}"]`)?.focus();
      return;
    }

    if (evento.target.closest("#mostrar-mas")) {
      const antes = Bitacora.limite;
      Bitacora.limite += PASO_BITACORA;
      pintarResultadosBitacora();
      // El foco pasa a la primera fila nueva
      document.querySelectorAll("#resultados-bitacora tbody tr")[antes]?.querySelector("[data-editar]")?.focus();
      return;
    }

    if (evento.target.closest("#limpiar-filtros")) {
      limpiarFiltros();
      pintarBitacora();
      document.getElementById("filtro-texto").focus();
      return;
    }

    const borrar = evento.target.closest("[data-borrar]");
    if (borrar) {
      const relevo = datos.relevos.find(r => r.id === borrar.dataset.borrar);
      if (relevo && await pedirConfirmacionBorrado(relevo)) borrarRelevo(relevo.id);
    }
  });
}
