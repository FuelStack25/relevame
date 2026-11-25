/* ==========================================================
   datos-ejemplo.js — Datos ficticios para probar el sitio
   ----------------------------------------------------------
   34 presentadores, 21 programas de lunes a sábado y unos
   40 relevos creados alrededor de la fecha de HOY, para que
   la demo siempre se vea "viva" sin importar cuándo se abra.
   Los relevos de ejemplo pasan por las mismas reglas que los
   reales (validarRelevo), así que nunca rompen el límite de 3.
   ========================================================== */

const NOMBRES_EJEMPLO = [
  "Laura Gómez", "Andrés Pinto", "Sofía Ruiz", "Juan Díaz", "Marta León",
  "Camilo Herrera", "Valentina Ríos", "Felipe Castro", "Daniela Mora", "Santiago Vargas",
  "Paula Rojas", "Mateo Salazar", "Catalina Ortiz", "Nicolás Peña", "Isabela Cárdenas",
  "Julián Navarro", "Mariana Silva", "Tomás Mejía", "Gabriela Duarte", "Sebastián Acosta",
  "Natalia Fuentes", "Diego Becerra", "Carolina Vega", "Alejandro Rincón", "Luisa Molina",
  "Esteban Quintero", "Ana María Prieto", "Ricardo Lozano", "Juliana Cortés", "Óscar Medina",
  "Manuela Arango", "David Torres", "Lucía Bernal", "Martín Ospina",
];

// [nombre, días, inicio, fin]  ·  días: 1 = lunes … 6 = sábado
const PROGRAMAS_EJEMPLO = [
  ["Madrugada Viva",        [1, 2, 3, 4, 5], "05:00", "07:00"],
  ["Despierta Onda",        [1, 2, 3, 4, 5], "07:00", "08:00"],
  ["Café con Noticias",     [1, 2, 3, 4, 5], "08:00", "10:00"],
  ["La Mañana en Casa",     [1, 2, 3, 4, 5], "10:00", "12:00"],
  ["Mediodía Deportivo",    [1, 2, 3, 4, 5], "12:00", "13:00"],
  ["Sobremesa",             [1, 2, 3, 4, 5], "13:00", "14:00"],
  ["Tarde de Clásicos",     [1, 3, 5],       "14:00", "16:00"],
  ["Jazz a Media Tarde",    [2, 4],          "14:00", "16:00"],
  ["Zona Joven",            [1, 2, 3, 4, 5], "16:00", "18:00"],
  ["Noticiero Onda Viva",   [1, 2, 3, 4, 5], "18:00", "19:00"],
  ["Ritmo Latino",          [1, 3, 5],       "19:00", "21:00"],
  ["Cine en la Radio",      [2, 4],          "19:00", "21:00"],
  ["Voces de la Noche",     [1, 2, 3],       "21:00", "23:00"],
  ["Historias de Misterio", [4, 5],          "21:00", "23:00"],
  ["Sábado Verde",          [6],             "07:00", "09:00"],
  ["Cocina al Aire",        [6],             "09:00", "11:00"],
  ["Ciencia para Todos",    [6],             "11:00", "13:00"],
  ["Top 20 Onda",           [6],             "13:00", "15:00"],
  ["Fútbol en Vivo",        [6],             "15:00", "17:00"],
  ["Salsa y Son",           [6],             "17:00", "19:00"],
  ["Noche de Rock",         [6],             "19:00", "21:00"],
];

const OBSERVACIONES_EJEMPLO = [
  "", "", "", "Avisó a las 6:30 a. m.", "Avisó con un día de anticipación.",
  "Dejó el guion listo.", "Avisó por chat a última hora.", "Llamó a la emisora.",
];

/** Generador de números "al azar" que siempre da la misma secuencia (semilla fija). */
function crearAzar(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function crearDatosEjemplo() {
  const azar = crearAzar(2026);
  const elegir = lista => lista[Math.floor(azar() * lista.length)];

  const datos = Almacen.vacio();
  datos.esEjemplo = true;

  datos.presentadores = NOMBRES_EJEMPLO.map(nombre => ({ id: nuevoId(), nombre, activo: true }));

  datos.programas = PROGRAMAS_EJEMPLO.map(([nombre, dias, inicio, fin], i) => ({
    id: nuevoId(), nombre, dias, inicio, fin,
    titularId: datos.presentadores[i].id, // los primeros 21 son titulares
  }));

  const hoy = hoyISO();
  const crearRelevo = (fecha, programa, estado) => {
    const r = {
      id: nuevoId(),
      fecha,
      programaId: programa.id,
      inicio: programa.inicio,
      fin: programa.fin,
      titularId: programa.titularId,
      relevoId: null,
      motivo: elegir(MOTIVOS),
      observaciones: elegir(OBSERVACIONES_EJEMPLO),
      estado,
      creadoEn: new Date().toISOString(),
    };
    if (estado === "cubierto") {
      const opciones = sugerirRelevos(datos, r).filter(s => s.disponible).slice(0, 5);
      if (opciones.length === 0) return null;
      r.relevoId = elegir(opciones).persona.id;
    }
    return Object.keys(validarRelevo(datos, r)).length === 0 ? r : null;
  };

  // Recorre desde hace 5 semanas hasta 8 días adelante
  for (let d = -35; d <= 8; d++) {
    const fecha = sumarDias(hoy, d);
    for (const programa of programasDelDia(datos, fecha)) {
      if (azar() > 0.11) continue; // ~11 % de los programas tienen relevo
      let estado;
      if (d < 0) estado = azar() < 0.88 ? "cubierto" : "sin-cubrir";
      else estado = azar() < 0.55 ? "cubierto" : "pendiente";
      const r = crearRelevo(fecha, programa, estado);
      if (r) datos.relevos.push(r);
    }
  }

  // Garantiza alertas en la pantalla Hoy: un pendiente hoy y otro mañana
  for (const fecha of [hoy, sumarDias(hoy, 1)]) {
    const programas = programasDelDia(datos, fecha);
    const yaHayPendiente = datos.relevos.some(r => r.fecha === fecha && r.estado === "pendiente");
    if (programas.length && !yaHayPendiente) {
      const tarde = programas.filter(p => p.inicio >= "16:00");
      const r = crearRelevo(fecha, elegir(tarde.length ? tarde : programas), "pendiente");
      if (r) datos.relevos.push(r);
    }
  }

  return datos;
}
