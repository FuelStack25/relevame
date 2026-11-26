/* ==========================================================
   xlsx.js — Crear archivos de Excel (.xlsx) sin librerías
   ----------------------------------------------------------
   Un .xlsx es un ZIP con varios archivos XML adentro. Aquí se
   escriben esos XML y se empaquetan en un ZIP "sin comprimir"
   (método store), que Excel, Google Sheets y LibreOffice abren
   sin problema.

   Uso:
     const archivo = crearXLSX([
       { nombre: "Relevos",
         columnas: [{ titulo: "Fecha", tipo: "fecha", ancho: 12 }, …],
         filas: [["2026-11-26", …], …],
         encabezado: ["Título", "Subtítulo"] }   // opcional, va arriba
     ]);
     descargarArchivo("archivo.xlsx", archivo, TIPO_XLSX);

   Tipos de columna: "texto" (por defecto), "numero", "horas" (1 decimal),
   "porcentaje" (0,83 → 83 %), "fecha" ("AAAA-MM-DD") y "hora" ("HH:MM").
   Fechas y horas se guardan como valores de verdad: se pueden ordenar,
   filtrar y sumar en Excel.
   ========================================================== */

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/* ---------- Estilos (índices de styles.xml, más abajo) ---------- */
const ESTILO = { normal: 0, encabezado: 1, titulo: 2, fecha: 3, hora: 4, horas: 5, porcentaje: 6, subtitulo: 7, negrita: 8 };
const ESTILO_POR_TIPO = { fecha: ESTILO.fecha, hora: ESTILO.hora, horas: ESTILO.horas, porcentaje: ESTILO.porcentaje };

/* ---------- Utilidades ---------- */

/** Protege el texto para XML y quita caracteres que Excel no acepta. */
function xmlTexto(valor) {
  return String(valor ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 0 → "A", 25 → "Z", 26 → "AA" */
function letraColumna(indice) {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

/** "2026-11-26" → número de serie de Excel (días desde el 30/12/1899). */
function serieFecha(textoISO) {
  const [a, m, d] = textoISO.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/** "07:30" → fracción del día (0,3125). */
function serieHora(textoHora) {
  const [h, m] = textoHora.split(":").map(Number);
  return (h * 60 + m) / 1440;
}

/** Una celda en XML según su tipo. Vacía si no hay valor. */
function xmlCelda(ref, valor, tipo, estilo) {
  if (valor === null || valor === undefined || valor === "") return "";
  const s = estilo ?? ESTILO_POR_TIPO[tipo] ?? ESTILO.normal;
  if (tipo === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return `<c r="${ref}" s="${s}"><v>${serieFecha(valor)}</v></c>`;
  if (tipo === "hora" && /^\d{1,2}:\d{2}$/.test(valor)) return `<c r="${ref}" s="${s}"><v>${serieHora(valor)}</v></c>`;
  if (["numero", "horas", "porcentaje"].includes(tipo) && Number.isFinite(Number(valor))) {
    return `<c r="${ref}" s="${s}"><v>${Number(valor)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xmlTexto(valor)}</t></is></c>`;
}

/* ---------- Hojas ---------- */

/** El XML de una hoja: encabezado opcional, fila de títulos, datos, fila fija y filtros. */
function xmlHoja(hoja) {
  const encabezado = hoja.encabezado || [];
  const columnas = hoja.columnas;
  const filaTitulos = encabezado.length ? encabezado.length + 2 : 1; // deja una fila en blanco tras el encabezado
  const ultimaFila = filaTitulos + hoja.filas.length;
  const ultimaColumna = letraColumna(columnas.length - 1);
  const filas = [];

  encabezado.forEach((texto, i) => {
    const estilo = i === 0 ? ESTILO.titulo : ESTILO.subtitulo;
    filas.push(`<row r="${i + 1}">${xmlCelda(`A${i + 1}`, texto, "texto", estilo)}</row>`);
  });
  filas.push(`<row r="${filaTitulos}">${columnas.map((c, i) =>
    xmlCelda(`${letraColumna(i)}${filaTitulos}`, c.titulo, "texto", ESTILO.encabezado)).join("")}</row>`);
  hoja.filas.forEach((fila, f) => {
    const r = filaTitulos + 1 + f;
    filas.push(`<row r="${r}">${fila.map((valor, i) => {
      const columna = columnas[i] || {};
      // Una celda puede traer su propio tipo: { v: 0.83, tipo: "porcentaje" }
      const propio = valor !== null && typeof valor === "object";
      return xmlCelda(`${letraColumna(i)}${r}`, propio ? valor.v : valor, propio ? valor.tipo : columna.tipo,
        (propio && valor.negrita) || columna.negrita ? ESTILO.negrita : undefined);
    }).join("")}</row>`);
  });

  const conFiltro = hoja.filtro !== false && hoja.filas.length > 0;
  const anchos = columnas.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 14}" customWidth="1"/>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"${hoja.indice === 0 ? ' tabSelected="1"' : ""}><pane ySplit="${filaTitulos}" topLeftCell="A${filaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos}</cols>
<sheetData>${filas.join("")}</sheetData>
${conFiltro ? `<autoFilter ref="A${filaTitulos}:${ultimaColumna}${ultimaFila}"/>` : ""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

/* ---------- Partes fijas del libro ---------- */

const XML_ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><color rgb="FF16181D"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF16181D"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="FF1F3A5F"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF5B616E"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF8EA5C5"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function xmlLibro(hojas) {
  const filtros = hojas.map((h, i) => {
    if (h.filtro === false || !h.filas.length) return "";
    const fila = h.encabezado && h.encabezado.length ? h.encabezado.length + 2 : 1;
    const nombre = h.nombre.replace(/'/g, "''");
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlTexto(nombre)}'!$A$${fila}:$${letraColumna(h.columnas.length - 1)}$${fila + h.filas.length}</definedName>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${hojas.map((h, i) => `<sheet name="${xmlTexto(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
${filtros ? `<definedNames>${filtros}</definedNames>` : ""}
</workbook>`;
}

function xmlRelacionesLibro(hojas) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function xmlTiposContenido(hojas) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
}

const XML_RELACIONES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

function xmlPropiedades(titulo) {
  const ahora = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlTexto(titulo)}</dc:title><dc:creator>Relévame · Onda Viva</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${ahora}</dcterms:created>
</cp:coreProperties>`;
}

/* ---------- ZIP sin compresión ---------- */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = TABLA_CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Empaqueta [{ nombre, texto }] en un ZIP (método store). Devuelve un Uint8Array. */
function crearZip(archivos) {
  const codificar = new TextEncoder();
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  for (const { nombre, texto } of archivos) {
    const nombreBytes = codificar.encode(nombre);
    const datos = codificar.encode(texto);
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, hora, true); local.setUint16(12, fecha, true);
    local.setUint32(14, crc, true); local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreBytes.length, true); local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, datos);

    const entrada = new DataView(new ArrayBuffer(46));
    entrada.setUint32(0, 0x02014B50, true); entrada.setUint16(4, 20, true); entrada.setUint16(6, 20, true);
    entrada.setUint16(8, 0x0800, true); entrada.setUint16(10, 0, true); entrada.setUint16(12, hora, true);
    entrada.setUint16(14, fecha, true); entrada.setUint32(16, crc, true); entrada.setUint32(20, datos.length, true);
    entrada.setUint32(24, datos.length, true); entrada.setUint16(28, nombreBytes.length, true);
    entrada.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(entrada.buffer), nombreBytes);

    desplazamiento += 30 + nombreBytes.length + datos.length;
  }

  const tamCentral = central.reduce((suma, b) => suma + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054B50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((suma, b) => suma + b.length, 0));
  let i = 0;
  for (const b of todo) { salida.set(b, i); i += b.length; }
  return salida;
}

/* ---------- Libro completo ---------- */

/** Devuelve los bytes de un .xlsx con las hojas dadas (ver el uso arriba). */
function crearXLSX(hojas, titulo = "Relévame") {
  const conIndice = hojas.map((h, indice) => ({ ...h, indice, nombre: h.nombre.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31) }));
  return crearZip([
    { nombre: "[Content_Types].xml", texto: xmlTiposContenido(conIndice) },
    { nombre: "_rels/.rels", texto: XML_RELACIONES },
    { nombre: "docProps/core.xml", texto: xmlPropiedades(titulo) },
    { nombre: "xl/workbook.xml", texto: xmlLibro(conIndice) },
    { nombre: "xl/_rels/workbook.xml.rels", texto: xmlRelacionesLibro(conIndice) },
    { nombre: "xl/styles.xml", texto: XML_ESTILOS },
    ...conIndice.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, texto: xmlHoja(h) })),
  ]);
}
