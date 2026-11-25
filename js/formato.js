/* ==========================================================
   formato.js — Fechas, horas y texto en español
   ----------------------------------------------------------
   Todas las fechas se guardan como texto "AAAA-MM-DD" y las
   horas como "HH:MM". Así se comparan fácil y no hay líos de
   zona horaria. Aquí está todo lo que las convierte en texto
   amable para la coordinadora.
   ========================================================== */

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Convierte "2026-12-03" en un objeto Date a medianoche (hora local). */
function aFecha(textoISO) {
  const [a, m, d] = textoISO.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** Convierte un Date en "2026-12-03" (sin usar toISOString, que usa hora UTC). */
function aISO(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** Fecha de hoy como "AAAA-MM-DD". */
function hoyISO() {
  return aISO(new Date());
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD". */
function sumarDias(textoISO, dias) {
  const f = aFecha(textoISO);
  f.setDate(f.getDate() + dias);
  return aISO(f);
}

/** Día de la semana: 0 = domingo, 1 = lunes … 6 = sábado. */
function diaSemana(textoISO) {
  return aFecha(textoISO).getDay();
}

/** Lunes de la semana a la que pertenece la fecha (semana de lunes a domingo). */
function lunesDe(textoISO) {
  const f = aFecha(textoISO);
  const atras = (f.getDay() + 6) % 7; // lunes→0, martes→1 … domingo→6
  f.setDate(f.getDate() - atras);
  return aISO(f);
}

/** "jueves, 3 de diciembre de 2026" */
function fechaLarga(textoISO) {
  const f = aFecha(textoISO);
  return `${DIAS_LARGOS[f.getDay()]}, ${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
}

/** "jue 3 dic" */
function fechaCorta(textoISO) {
  const f = aFecha(textoISO);
  return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
}

/** "3 de diciembre" */
function fechaSinAnio(textoISO) {
  const f = aFecha(textoISO);
  return `${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/** Para títulos: "Hoy", "Mañana", "Ayer" o la fecha corta. */
function fechaRelativa(textoISO) {
  const hoy = hoyISO();
  if (textoISO === hoy) return "Hoy";
  if (textoISO === sumarDias(hoy, 1)) return "Mañana";
  if (textoISO === sumarDias(hoy, -1)) return "Ayer";
  return fechaCorta(textoISO);
}

/** "07:00" → "7:00 a. m." */
function hora(textoHora) {
  const [h, m] = textoHora.split(":").map(Number);
  const periodo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

/** "07:00","08:00" → "7:00 a 8:00 a. m." · "11:00","13:00" → "11:00 a. m. a 1:00 p. m." */
function horario(inicio, fin) {
  const a = hora(inicio);
  const b = hora(fin);
  const mismoPeriodo = a.slice(-5) === b.slice(-5);
  return mismoPeriodo ? `${a.slice(0, -6)} a ${b}` : `${a} a ${b}`;
}

/** "07:00" → 420 (minutos desde medianoche) */
function aMinutos(textoHora) {
  const [h, m] = textoHora.split(":").map(Number);
  return h * 60 + m;
}

/** Horas entre dos horas, con decimales: "07:00","08:30" → 1.5 */
function duracionHoras(inicio, fin) {
  return (aMinutos(fin) - aMinutos(inicio)) / 60;
}

/** 1.5 → "1,5 h" · 2 → "2 h" */
function textoHoras(horas) {
  const redondeado = Math.round(horas * 10) / 10;
  return `${String(redondeado).replace(".", ",")} h`;
}

/** [1,2,3,4,5] → "lun a vie" · [2,4] → "mar y jue" · [6] → "sáb" */
function textoDias(dias) {
  const orden = [...dias].sort((a, b) => a - b);
  const consecutivos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1);
  if (orden.length >= 3 && consecutivos) {
    return `${DIAS_CORTOS[orden[0]]} a ${DIAS_CORTOS[orden[orden.length - 1]]}`;
  }
  const nombres = orden.map(d => DIAS_CORTOS[d]);
  if (nombres.length <= 1) return nombres.join("");
  return nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
}

/**
 * Protege el texto que escribe la usuaria antes de meterlo en el HTML.
 * Sin esto, un nombre como "<b>Ana" rompería la página.
 */
function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Crea un identificador único para cada registro. */
function nuevoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
