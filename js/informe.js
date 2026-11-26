/* ==========================================================
   informe.js — Reporte mensual en PDF y en Excel
   ----------------------------------------------------------
   Los dos salen de los MISMOS datos (datosInforme), así el
   PDF, el Excel y la pantalla de Reportes siempre coinciden.

   - PDF: con las librerías jsPDF y jsPDF-AutoTable (carpeta
     lib/). Se cargan solo al tocar "Descargar PDF", para no
     hacer más lenta la app. Sale un documento formal:
     membrete, secciones numeradas, puntos clave escritos,
     tablas, "Página X de Y" y espacio para firmas.
   - Excel: con xlsx.js (hecho a mano, sin librerías).
   ========================================================== */

/* ---------- Datos del reporte ---------- */

/** "A, B y C" */
function enLista(textos) {
  return textos.length <= 1 ? textos.join("") : `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}`;
}

/** Todo lo que necesitan el PDF y el Excel de un mes ("2026-11"). */
function datosInforme(mes) {
  const [anio, numMes] = mes.split("-").map(Number);
  const nombreMes = `${MESES[numMes - 1]} de ${anio}`;
  const resumen = resumenDelMes(datos, mes);
  const relevos = [...resumen.relevos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio));
  const personas = contarPorPersona(datos, mes)
    .filter(f => f.hechos > 0 || f.recibidos > 0)
    .sort((a, b) => (b.horas - a.horas) || (b.hechos - a.hechos) || a.persona.nombre.localeCompare(b.persona.nombre));
  return {
    mes,
    nombreMes,
    periodo: `1 al ${new Date(anio, numMes, 0).getDate()} de ${nombreMes}`,
    generado: fechaLarga(hoyISO()),
    resumen,
    relevos,
    personas,
    semanas: semanasDelMes(datos, mes),
    porResolver: relevos.filter(r => r.estado !== "cubierto"),
    hallazgos: hallazgosDelMes(resumen, relevos, personas),
    porcentaje: resumen.total ? resumen.cubiertos / resumen.total : 0,
  };
}

/** Puntos clave del mes, escritos en frases (lo primero que lee un directivo). */
function hallazgosDelMes(resumen, relevos, personas) {
  if (!resumen.total) return ["No se registraron relevos en este periodo."];
  const frases = [];
  const porcentaje = Math.round((resumen.cubiertos / resumen.total) * 100);
  frases.push(`El ${porcentaje} % de los relevos quedaron cubiertos (${resumen.cubiertos} de ${resumen.total}): el equipo sostuvo ${textoHoras(resumen.horas)} de programación.`);

  const sinCubrir = relevos.filter(r => r.estado === "sin-cubrir");
  if (sinCubrir.length) {
    const nombres = sinCubrir.slice(0, 3).map(r => `${nombrePrograma(datos, r.programaId)} (${fechaCorta(r.fecha)})`);
    frases.push(`${sinCubrir.length === 1 ? "1 programa no salió" : `${sinCubrir.length} programas no salieron`} al aire: ` +
      `${enLista(nombres)}${sinCubrir.length > 3 ? ` y ${sinCubrir.length - 3} más` : ""}.`);
  } else {
    frases.push("Ningún programa quedó fuera del aire por falta de presentador.");
  }
  if (resumen.pendientes) {
    frases.push(resumen.pendientes === 1 ? "Queda 1 relevo pendiente de confirmar." : `Quedan ${resumen.pendientes} relevos pendientes de confirmar.`);
  }

  const motivos = {};
  relevos.forEach(r => { if (r.motivo) motivos[r.motivo] = (motivos[r.motivo] || 0) + 1; });
  const [motivo, veces] = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0] || [];
  if (motivo) frases.push(`El motivo de ausencia más frecuente fue «${motivo}» (${veces} ${veces === 1 ? "caso" : "casos"}).`);

  // Quién cubrió más horas; si varios empatan, eso dice que la carga quedó repartida
  const maxHoras = Math.max(0, ...personas.map(p => p.horas));
  const lideres = personas.filter(p => p.horas === maxHoras && maxHoras > 0);
  if (lideres.length === 1) {
    const [lider] = lideres;
    frases.push(`${lider.persona.nombre} fue quien más horas cubrió: ${textoHoras(lider.horas)} en ${lider.hechos} ${lider.hechos === 1 ? "relevo" : "relevos"}.`);
  } else if (lideres.length > 1) {
    frases.push(`${lideres.length} presentadores empataron en el máximo de horas cubiertas (${textoHoras(maxHoras)} cada uno): la carga quedó bien repartida.`);
  }

  const maximo = Math.max(0, ...relevos.filter(r => r.estado === "cubierto")
    .map(r => relevosEnSemana(datos, r.relevoId, r.fecha)));
  if (maximo <= LIMITE_SEMANAL) frases.push(`Se respetó el límite de ${LIMITE_SEMANAL} relevos por persona en cada semana.`);
  return frases;
}

/* ---------- Excel ---------- */

const COLUMNAS_RELEVOS = [
  { titulo: "Fecha", tipo: "fecha", ancho: 12 },
  { titulo: "Día", ancho: 11 },
  { titulo: "Programa", ancho: 24 },
  { titulo: "Inicio", tipo: "hora", ancho: 8 },
  { titulo: "Fin", tipo: "hora", ancho: 8 },
  { titulo: "Horas", tipo: "horas", ancho: 8 },
  { titulo: "Titular (falta)", ancho: 22 },
  { titulo: "Relevo (cubre)", ancho: 22 },
  { titulo: "Motivo", ancho: 14 },
  { titulo: "Estado", ancho: 12 },
  { titulo: "Observaciones", ancho: 40 },
];

function filasRelevosExcel(lista) {
  return lista.map(r => [
    r.fecha,
    DIAS_LARGOS[diaSemana(r.fecha)],
    nombrePrograma(datos, r.programaId),
    r.inicio,
    r.fin,
    duracionHoras(r.inicio, r.fin),
    nombrePersona(datos, r.titularId),
    r.relevoId ? nombrePersona(datos, r.relevoId) : "",
    r.motivo || "",
    ESTADOS[r.estado].texto,
    r.observaciones || "",
  ]);
}

/** Reporte del mes en Excel: resumen, relevos, presentadores, semanas y lo pendiente. */
function descargarExcelMes(mes) {
  const d = datosInforme(mes);
  const encabezado = titulo => [`${titulo} · ${d.nombreMes}`, `Onda Viva · Coordinación de programación · generado el ${d.generado}`];
  const hojas = [
    {
      nombre: "Resumen",
      encabezado: encabezado("Reporte de relevos"),
      filtro: false,
      columnas: [{ titulo: "Indicador", ancho: 36 }, { titulo: "Valor", tipo: "numero", ancho: 14 }],
      filas: [
        ["Relevos registrados", d.resumen.total],
        ["Cubiertos", d.resumen.cubiertos],
        ["Pendientes", d.resumen.pendientes],
        ["Sin cubrir (no salieron al aire)", d.resumen.sinCubrir],
        ["Porcentaje cubierto", { v: d.porcentaje, tipo: "porcentaje" }],
        ["Horas cubiertas", { v: d.resumen.horas, tipo: "horas" }],
        ["", ""],
        [{ v: "Puntos clave", negrita: true }, ""],
        ...d.hallazgos.map(frase => [frase, ""]),
      ],
    },
    { nombre: "Relevos", encabezado: encabezado("Relevos del mes"), columnas: COLUMNAS_RELEVOS, filas: filasRelevosExcel(d.relevos) },
    {
      nombre: "Por presentador",
      encabezado: encabezado("Horas cubiertas por presentador"),
      columnas: [
        { titulo: "Presentador", ancho: 26 },
        { titulo: "Relevos hechos", tipo: "numero", ancho: 15 },
        { titulo: "Horas cubiertas", tipo: "horas", ancho: 15 },
        { titulo: "Veces relevado", tipo: "numero", ancho: 15 },
        { titulo: "Saldo del mes", tipo: "numero", ancho: 14 },
      ],
      filas: d.personas.map(p => [p.persona.nombre, p.hechos, p.horas, p.recibidos, p.saldo]),
    },
    {
      nombre: "Por semana",
      encabezado: encabezado("Relevos por semana"),
      columnas: [
        { titulo: "Semana del (lunes)", tipo: "fecha", ancho: 18 },
        { titulo: "Cubiertos", tipo: "numero", ancho: 11 },
        { titulo: "Pendientes", tipo: "numero", ancho: 11 },
        { titulo: "Sin cubrir", tipo: "numero", ancho: 11 },
        { titulo: "Total", tipo: "numero", ancho: 9 },
      ],
      filas: d.semanas.map(s => [s.lunes, s.cubierto, s.pendiente, s["sin-cubrir"], s.total]),
    },
    {
      nombre: "Pendientes y sin cubrir",
      encabezado: encabezado("Programas pendientes o que no salieron al aire"),
      columnas: [
        { titulo: "Fecha", tipo: "fecha", ancho: 12 },
        { titulo: "Programa", ancho: 24 },
        { titulo: "Inicio", tipo: "hora", ancho: 8 },
        { titulo: "Fin", tipo: "hora", ancho: 8 },
        { titulo: "Faltó", ancho: 22 },
        { titulo: "Motivo", ancho: 14 },
        { titulo: "Estado", ancho: 12 },
      ],
      filas: d.porResolver.map(r => [r.fecha, nombrePrograma(datos, r.programaId), r.inicio, r.fin,
        nombrePersona(datos, r.titularId), r.motivo || "", ESTADOS[r.estado].texto]),
    },
  ];
  descargarArchivo(`reporte-relevos-${d.nombreMes.replace(/ de /g, "-")}.xlsx`, crearXLSX(hojas, `Reporte de relevos · ${d.nombreMes}`), TIPO_XLSX);
  avisar(`Se descargó el reporte de ${d.nombreMes} en Excel.`);
}

/* ---------- PDF ---------- */

const LIBRERIAS_PDF = ["lib/jspdf.umd.min.js", "lib/jspdf.plugin.autotable.min.js"];
const cargasDeScript = {};

/** Carga un script una sola vez y espera a que esté listo. */
function cargarScript(src) {
  cargasDeScript[src] ||= new Promise((listo, error) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = listo;
    script.onerror = () => { delete cargasDeScript[src]; error(new Error(`No se pudo cargar ${src}`)); };
    document.head.appendChild(script);
  });
  return cargasDeScript[src];
}

// Colores del estilo "Despacho" en RGB (jsPDF los pide así)
const PDF = {
  tinta: [22, 24, 29], suave: [91, 97, 110], acento: [31, 58, 95], linea: [228, 229, 233],
  encabezado: [238, 241, 245], lineaEncabezado: [142, 165, 197],
  cubierto: [7, 148, 85], pendiente: [220, 104, 3], sinCubrir: [217, 45, 32],
  textoEstado: { cubierto: [8, 93, 58], pendiente: [147, 55, 13], "sin-cubrir": [145, 32, 24] },
};

async function descargarPDFMes(mes) {
  try {
    for (const src of LIBRERIAS_PDF) await cargarScript(src);
  } catch (e) {
    avisar("No se pudo preparar el PDF. Revisa la conexión y vuelve a intentarlo.", { tipo: "error" });
    return;
  }
  const d = datosInforme(mes);
  crearPDFMes(d).save(`reporte-relevos-${d.nombreMes.replace(/ de /g, "-")}.pdf`);
  avisar("Se descargó el reporte en PDF.");
}

/** Arma el documento. Tamaño carta, en milímetros. */
function crearPDFMes(d) {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
  const ANCHO = doc.internal.pageSize.getWidth();
  const ALTO = doc.internal.pageSize.getHeight();
  const M = 16;                 // margen lateral
  const UTIL = ANCHO - 2 * M;   // ancho útil
  const ARRIBA = 34;            // donde empieza el contenido (debajo del membrete)
  const ABAJO = ALTO - 22;      // donde termina (encima del pie)
  let y = ARRIBA;

  doc.setProperties({ title: `Reporte de relevos · ${d.nombreMes}`, author: "Relévame · Onda Viva", creator: "Relévame" });
  const color = (rgb, tipo = "text") => (tipo === "text" ? doc.setTextColor(...rgb) : tipo === "fill" ? doc.setFillColor(...rgb) : doc.setDrawColor(...rgb));
  const letra = (tamano, estilo = "normal", rgb = PDF.tinta) => { doc.setFont("helvetica", estilo); doc.setFontSize(tamano); color(rgb); };
  const espacio = alto => { if (y + alto > ABAJO) { doc.addPage(); y = ARRIBA; } };
  const seccion = titulo => {
    espacio(18);
    letra(12, "bold");
    doc.text(titulo, M, y);
    y += 6;
  };
  const tabla = (cabecera, filas, opciones = {}) => {
    doc.autoTable({
      startY: y,
      head: [cabecera],
      body: filas,
      margin: { left: M, right: M, top: ARRIBA - 2, bottom: ALTO - ABAJO + 2 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.5, textColor: PDF.tinta, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
        lineColor: PDF.linea, lineWidth: { bottom: 0.2 }, valign: "middle" },
      headStyles: { fillColor: PDF.encabezado, textColor: PDF.acento, fontStyle: "bold", lineColor: PDF.lineaEncabezado, lineWidth: { bottom: 0.4 } },
      ...opciones,
    });
    y = doc.lastAutoTable.finalY + 10;
  };
  // Colorea la columna "Estado" (la de la posición `indice`) con el texto oscuro de su tono
  const estadoComoTexto = indice => data => {
    if (data.section !== "body" || data.column.index !== indice) return;
    const clave = Object.keys(ESTADOS).find(k => ESTADOS[k].texto === data.cell.raw);
    if (clave) { data.cell.styles.textColor = PDF.textoEstado[clave]; data.cell.styles.fontStyle = "bold"; }
  };

  /* Título */
  letra(20, "bold", PDF.acento);
  doc.text(`Relevos de ${d.nombreMes}`, M, y);
  y += 7;
  letra(9.5, "normal", PDF.suave);
  doc.text(`Periodo: ${d.periodo} · programación de lunes a sábado`, M, y);
  y += 12;

  /* 1. Resumen: cifras + puntos clave */
  seccion("1. Resumen");
  const cifras = [
    [String(d.resumen.total), "relevos registrados"],
    [String(d.resumen.cubiertos), `cubiertos (${Math.round(d.porcentaje * 100)} %)`],
    [String(d.resumen.pendientes), "pendientes"],
    [String(d.resumen.sinCubrir), "sin cubrir"],
    [textoHoras(d.resumen.horas), "horas cubiertas"],
  ];
  const separacion = 3;
  const anchoCaja = (UTIL - separacion * (cifras.length - 1)) / cifras.length;
  cifras.forEach(([valor, etiqueta], i) => {
    const x = M + i * (anchoCaja + separacion);
    color(PDF.linea, "draw"); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, anchoCaja, 20, 1.5, 1.5, "S");
    letra(16, "bold"); doc.text(valor, x + 4, y + 9);
    letra(8, "normal", PDF.suave); doc.text(etiqueta, x + 4, y + 15);
  });
  y += 28;

  letra(10, "bold");
  doc.text("Puntos clave", M, y);
  y += 5.5;
  letra(9.5);
  for (const frase of d.hallazgos) {
    const lineas = doc.splitTextToSize(frase, UTIL - 6);
    espacio(lineas.length * 4.6 + 2);
    color(PDF.acento, "fill"); doc.circle(M + 1.2, y - 1.2, 0.7, "F");
    doc.text(lineas, M + 5, y);
    y += lineas.length * 4.6 + 1.6;
  }
  y += 6;

  /* 2. Relevos por semana: barras apiladas dibujadas a mano */
  espacio(d.semanas.length * 7 + 30); // título y gráfica juntos en la misma página
  seccion("2. Relevos por semana");
  const maximo = Math.max(1, ...d.semanas.map(s => s.total));
  const anchoEtiqueta = 36;
  const anchoBarras = UTIL - anchoEtiqueta - 12;
  const etiquetaSemana = lunes => { const f = aFecha(lunes); return `Semana del ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`; };
  for (const s of d.semanas) {
    letra(8.5, "normal", PDF.suave);
    doc.text(etiquetaSemana(s.lunes), M, y + 3.3);
    let x = M + anchoEtiqueta;
    for (const [clave, rgb] of [["cubierto", PDF.cubierto], ["pendiente", PDF.pendiente], ["sin-cubrir", PDF.sinCubrir]]) {
      const ancho = (s[clave] / maximo) * anchoBarras;
      if (ancho > 0) { color(rgb, "fill"); doc.rect(x, y, ancho, 4.5, "F"); x += ancho; }
    }
    if (s.total === 0) { color(PDF.linea, "fill"); doc.rect(x, y + 1.9, 0.4, 0.8, "F"); }
    letra(8.5, "bold"); doc.text(String(s.total), x + 2, y + 3.3);
    y += 7;
  }
  // Leyenda
  y += 1;
  let xLeyenda = M + anchoEtiqueta;
  for (const [texto, rgb] of [["Cubierto", PDF.cubierto], ["Pendiente", PDF.pendiente], ["Sin cubrir", PDF.sinCubrir]]) {
    color(rgb, "fill"); doc.rect(xLeyenda, y - 2.6, 3, 3, "F");
    letra(8, "normal", PDF.suave); doc.text(texto, xLeyenda + 4.5, y);
    xLeyenda += doc.getTextWidth(texto) + 12;
  }
  y += 10;

  /* 3. Lo que no salió al aire o sigue pendiente */
  seccion("3. Programas que no salieron al aire o siguen pendientes");
  if (!d.porResolver.length) {
    letra(9.5, "normal", PDF.suave);
    doc.text("Ninguno: todos los relevos del mes quedaron cubiertos.", M, y);
    y += 12;
  } else {
    tabla(
      ["Fecha", "Programa", "Horario", "Faltó", "Motivo", "Estado"],
      d.porResolver.map(r => [fechaCorta(r.fecha), nombrePrograma(datos, r.programaId), `${r.inicio}–${r.fin}`,
        nombrePersona(datos, r.titularId), r.motivo || "—", ESTADOS[r.estado].texto]),
      { didParseCell: estadoComoTexto(5) },
    );
  }

  /* 4. Horas por presentador */
  seccion("4. Horas cubiertas por presentador");
  if (!d.personas.length) {
    letra(9.5, "normal", PDF.suave);
    doc.text("No hubo relevos cubiertos en este periodo.", M, y);
    y += 12;
  } else {
    tabla(
      ["Presentador", "Relevos hechos", "Horas cubiertas", "Veces relevado", "Saldo del mes"],
      d.personas.map(p => [p.persona.nombre, p.hechos, textoHoras(p.horas), p.recibidos, (p.saldo > 0 ? "+" : "") + p.saldo]),
      {
        // Columnas de números alineadas a la derecha, también en el encabezado
        didParseCell: data => { if (data.column.index >= 1) data.cell.styles.halign = "right"; },
      },
    );
    letra(8, "normal", PDF.suave);
    espacio(6);
    doc.text("Saldo del mes = relevos que hizo - veces que lo relevaron. Positivo: cubrió más de lo que le cubrieron.", M, y - 5);
    y += 4;
  }

  /* 5. Detalle completo (sigue en la misma página si cabe el título y unas filas) */
  y += 4;
  espacio(40);
  seccion(`5. Detalle de relevos (${d.relevos.length})`);
  if (!d.relevos.length) {
    letra(9.5, "normal", PDF.suave);
    doc.text("No se registraron relevos en este periodo.", M, y);
    y += 12;
  } else {
    tabla(
      ["Fecha", "Programa", "Horario", "Titular", "Relevo", "Motivo", "Estado"],
      d.relevos.map(r => [
        fechaCorta(r.fecha),
        nombrePrograma(datos, r.programaId) + (r.observaciones ? `\n${r.observaciones}` : ""),
        `${r.inicio}–${r.fin}`,
        nombrePersona(datos, r.titularId),
        r.relevoId ? nombrePersona(datos, r.relevoId) : "—",
        r.motivo || "—",
        ESTADOS[r.estado].texto,
      ]),
      {
        styles: { font: "helvetica", fontSize: 8, textColor: PDF.tinta, cellPadding: { top: 2, bottom: 2, left: 1.8, right: 1.8 },
          lineColor: PDF.linea, lineWidth: { bottom: 0.2 }, valign: "top" },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 44 }, 2: { cellWidth: 21 }, 6: { cellWidth: 19 } },
        rowPageBreak: "avoid",
        didParseCell: estadoComoTexto(6),
      },
    );
  }

  /* Firmas */
  espacio(34);
  y += 16;
  const anchoFirma = 70;
  for (const [x, rol, cargo] of [[M, "Elaboró", "Coordinación de programación"], [ANCHO - M - anchoFirma, "Aprobó", "Dirección de Onda Viva"]]) {
    color(PDF.suave, "draw"); doc.setLineWidth(0.3);
    doc.line(x, y, x + anchoFirma, y);
    letra(8.5, "bold"); doc.text(rol, x, y + 5);
    letra(8, "normal", PDF.suave); doc.text(`${cargo} · nombre y firma`, x, y + 9.5);
  }

  /* Membrete y pie en todas las páginas (al final, cuando ya se sabe cuántas son) */
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    // Logo: cuadro azul con tres barras blancas
    color(PDF.acento, "fill"); doc.roundedRect(M, 11, 10, 10, 1.6, 1.6, "F");
    doc.setFillColor(255, 255, 255);
    // Tres barras de 1,6 mm separadas 1 mm, apoyadas en la misma base (como el ícono de la app)
    doc.rect(M + 1.6, 15.2, 1.6, 3.6, "F"); doc.rect(M + 4.2, 13.0, 1.6, 5.8, "F"); doc.rect(M + 6.8, 16.0, 1.6, 2.8, "F");
    letra(11, "bold"); doc.text("Onda Viva", M + 13, 15.2);
    letra(8, "normal", PDF.suave); doc.text("Coordinación de programación", M + 13, 19.4);
    letra(9, "bold"); doc.text("Reporte mensual de relevos", ANCHO - M, 15.2, { align: "right" });
    letra(8, "normal", PDF.suave); doc.text(d.nombreMes[0].toUpperCase() + d.nombreMes.slice(1), ANCHO - M, 19.4, { align: "right" });
    color(PDF.linea, "draw"); doc.setLineWidth(0.4); doc.line(M, 25, ANCHO - M, 25);
    // Pie
    doc.setLineWidth(0.2); doc.line(M, ALTO - 14, ANCHO - M, ALTO - 14);
    letra(7.5, "normal", PDF.suave);
    doc.text(`Relévame · Onda Viva — generado el ${d.generado}`, M, ALTO - 9);
    doc.text(`Página ${pagina} de ${total}`, ANCHO - M, ALTO - 9, { align: "right" });
  }
  return doc;
}
