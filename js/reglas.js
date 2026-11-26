/* ==========================================================
   reglas.js — Las reglas del negocio de Onda Viva
   ----------------------------------------------------------
   Aquí NO se toca el HTML. Solo se reciben datos y se
   responde: ¿es válido?, ¿quién puede cubrir?, ¿cuántos
   relevos lleva cada quien? Así las reglas se pueden probar
   y explicar por separado.
   ========================================================== */

const LIMITE_SEMANAL = 3;

const ESTADOS = {
  "pendiente":  { texto: "Pendiente",  icono: "i-reloj",   ayuda: "Aún no hay quien cubra." },
  "cubierto":   { texto: "Cubierto",   icono: "i-check",   ayuda: "Alguien del equipo tomó el micrófono." },
  "sin-cubrir": { texto: "Sin cubrir", icono: "i-mic-off", ayuda: "Nadie cubrió: el programa no salió al aire." },
};

const MOTIVOS = ["Enfermedad", "Cita médica", "Permiso", "Calamidad", "Otro"];

/* ---------- Búsquedas rápidas ---------- */

function buscarPersona(datos, id) {
  return datos.presentadores.find(p => p.id === id) || null;
}

function buscarPrograma(datos, id) {
  return datos.programas.find(p => p.id === id) || null;
}

function nombrePersona(datos, id) {
  const p = buscarPersona(datos, id);
  return p ? p.nombre : "—";
}

function nombrePrograma(datos, id) {
  const p = buscarPrograma(datos, id);
  return p ? p.nombre : "Programa borrado";
}

/** ¿Se cruzan dos franjas horarias? (07:00–08:00 y 07:30–09:00 → sí) */
function seCruzan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA;
}

/** Un programa "retirado" (activo: false) sigue en la bitácora pero ya no sale al aire. */
function programaActivo(programa) {
  return programa.activo !== false;
}

/**
 * ¿Qué tan lista está la bitácora para usarse?
 * Para registrar un relevo hacen falta al menos 2 personas activas
 * (titular y relevo deben ser distintas) y al menos 1 programa al aire.
 */
function estadoConfiguracion(datos) {
  const presentadores = datos.presentadores.filter(p => p.activo).length;
  const programas = datos.programas.filter(programaActivo).length;
  return {
    presentadores,
    programas,
    relevos: datos.relevos.length,
    puedeRegistrar: presentadores >= 2 && programas >= 1,
  };
}

/** Programas que salen al aire en una fecha, ordenados por hora. */
function programasDelDia(datos, fechaISO) {
  const dia = diaSemana(fechaISO);
  return datos.programas
    .filter(p => programaActivo(p) && p.dias.includes(dia))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Relevos ordenados del más reciente al más antiguo (Requisito 04). */
function relevosOrdenados(relevos) {
  return [...relevos].sort((a, b) =>
    b.fecha.localeCompare(a.fecha) ||
    b.inicio.localeCompare(a.inicio) ||
    (b.creadoEn || "").localeCompare(a.creadoEn || "")
  );
}

/* ---------- Regla de las 3 por semana (Requisito 03) ---------- */

/**
 * Cuántos relevos CUBIERTOS hace una persona en la semana (lunes a domingo)
 * de la fecha dada. `ignorarId` sirve al editar: el relevo que se está
 * editando no se cuenta contra sí mismo.
 */
function relevosEnSemana(datos, personaId, fechaISO, ignorarId = null) {
  const semana = lunesDe(fechaISO);
  return datos.relevos.filter(r =>
    r.relevoId === personaId &&
    r.estado === "cubierto" &&
    r.id !== ignorarId &&
    lunesDe(r.fecha) === semana
  ).length;
}

/* ---------- Choques de horario ---------- */

/**
 * ¿La persona ya está ocupada en esa fecha y horario?
 * Está ocupada si (a) su propio programa está al aire a esa hora,
 * o (b) ya está cubriendo otro relevo a esa hora.
 * Devuelve el motivo en texto, o null si está libre.
 */
function motivoOcupado(datos, personaId, fechaISO, inicio, fin, ignorarId = null) {
  // (a) Su propio programa como titular
  for (const prog of programasDelDia(datos, fechaISO)) {
    if (prog.titularId !== personaId) continue;
    if (!seCruzan(inicio, fin, prog.inicio, prog.fin)) continue;
    // Si ese día alguien la está relevando en su programa, no está ocupada allí
    const laEstanRelevando = datos.relevos.some(r =>
      r.id !== ignorarId && r.programaId === prog.id && r.fecha === fechaISO && r.titularId === personaId
    );
    if (!laEstanRelevando) {
      return `está al aire en «${prog.nombre}» (${horario(prog.inicio, prog.fin)})`;
    }
  }
  // (b) Otro relevo que ya está cubriendo
  const otro = datos.relevos.find(r =>
    r.id !== ignorarId &&
    r.relevoId === personaId &&
    r.estado === "cubierto" &&
    r.fecha === fechaISO &&
    seCruzan(inicio, fin, r.inicio, r.fin)
  );
  if (otro) {
    return `ya cubre «${nombrePrograma(datos, otro.programaId)}» a esa hora`;
  }
  return null;
}

/**
 * Choque de un relevo ya guardado (Nivel 3): ¿la persona que cubre
 * quedó en dos lugares a la vez? Devuelve el texto del choque o null.
 */
function choqueDeRelevo(datos, r) {
  if (r.estado !== "cubierto" || !r.relevoId) return null;
  return motivoOcupado(datos, r.relevoId, r.fecha, r.inicio, r.fin, r.id);
}

/* ---------- Validaciones del formulario (Requisito 02) ---------- */

/**
 * Revisa un relevo y devuelve un objeto { campo: "mensaje" }.
 * Si el objeto queda vacío, el relevo es válido.
 */
function validarRelevo(datos, r, ignorarId = null) {
  const errores = {};
  const programa = r.programaId ? buscarPrograma(datos, r.programaId) : null;

  if (!r.programaId) errores.programaId = "Elige el programa.";
  else if (!programa) errores.programaId = "Ese programa ya no existe. Elige otro.";

  if (!r.fecha) {
    errores.fecha = "Escribe la fecha del relevo.";
  } else if (diaSemana(r.fecha) === 0) {
    errores.fecha = "Los domingos Onda Viva no transmite. Revisa la fecha.";
  } else if (programa && !programa.dias.includes(diaSemana(r.fecha))) {
    errores.fecha = `«${programa.nombre}» no sale ese día (sale ${textoDias(programa.dias)}).`;
  }

  if (!r.inicio || !r.fin) {
    errores.inicio = "Escribe la hora en que empieza y termina.";
  } else if (r.fin <= r.inicio) {
    errores.inicio = "La hora de fin debe ser después de la hora de inicio.";
  }

  if (!r.titularId) errores.titularId = "Elige quién falta.";

  if (!r.estado || !ESTADOS[r.estado]) errores.estado = "Elige el estado del relevo.";

  if (r.estado === "cubierto") {
    if (!r.relevoId) {
      errores.relevoId = "Si está cubierto, elige quién lo cubrió.";
    } else if (r.relevoId === r.titularId) {
      errores.relevoId = "El titular y el relevo deben ser personas distintas.";
    } else if (r.fecha && !errores.fecha) {
      const nombre = nombrePersona(datos, r.relevoId);
      const enSemana = relevosEnSemana(datos, r.relevoId, r.fecha, ignorarId);
      if (enSemana >= LIMITE_SEMANAL) {
        errores.relevoId = `${nombre} ya tiene ${LIMITE_SEMANAL} relevos esa semana. Nadie puede hacer más de ${LIMITE_SEMANAL}.`;
      } else if (r.inicio && r.fin && !errores.inicio) {
        const ocupado = motivoOcupado(datos, r.relevoId, r.fecha, r.inicio, r.fin, ignorarId);
        if (ocupado) errores.relevoId = `${nombre} ${ocupado}.`;
      }
    }
  }

  // Evita registrar dos veces el mismo programa, el mismo día, a la misma hora
  if (!errores.programaId && !errores.fecha && !errores.inicio && buscarRepetido(datos, r, ignorarId)) {
    errores.fecha = "Ya hay un relevo de este programa en esa fecha y hora.";
  }

  return errores;
}

/** Otro relevo ya guardado del mismo programa, mismo día y horario que se cruza (o null). */
function buscarRepetido(datos, r, ignorarId = null) {
  if (!r.programaId || !r.fecha || !r.inicio || !r.fin) return null;
  return datos.relevos.find(x =>
    x.id !== ignorarId &&
    x.programaId === r.programaId &&
    x.fecha === r.fecha &&
    seCruzan(r.inicio, r.fin, x.inicio, x.fin)
  ) || null;
}

/* ---------- Sugerir quién puede cubrir (Requisito 05) ---------- */

/**
 * Devuelve a todo el equipo activo con su disponibilidad:
 * [{ persona, disponible, razon, semana, mes }]
 * Primero los disponibles, ordenados por quién ha cubierto menos
 * en el mes (para repartir la carga de forma justa).
 */
function sugerirRelevos(datos, { fecha, inicio, fin, titularId, ignorarId = null }) {
  if (!fecha || !inicio || !fin) return [];
  const mes = fecha.slice(0, 7); // "2026-12"

  return datos.presentadores
    .filter(p => p.activo)
    .filter(p => p.id !== titularId)
    .map(persona => {
      const semana = relevosEnSemana(datos, persona.id, fecha, ignorarId);
      const delMes = datos.relevos.filter(r =>
        r.relevoId === persona.id && r.estado === "cubierto" && r.id !== ignorarId && r.fecha.startsWith(mes)
      ).length;

      let razon = null;
      if (semana >= LIMITE_SEMANAL) razon = `ya tiene ${LIMITE_SEMANAL} relevos esa semana`;
      else razon = motivoOcupado(datos, persona.id, fecha, inicio, fin, ignorarId);

      return { persona, disponible: !razon, razon, semana, mes: delMes };
    })
    .sort((a, b) =>
      (b.disponible - a.disponible) ||
      (a.mes - b.mes) ||
      (a.semana - b.semana) ||
      a.persona.nombre.localeCompare(b.persona.nombre)
    );
}

/* ---------- Resolver pendientes de una vez ---------- */

/** Pendientes que todavía no terminan (aún se puede buscar quién los cubra). */
function pendientesPorVenir(datos, ahora = new Date()) {
  const hoy = aISO(ahora);
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  return datos.relevos
    .filter(r => r.estado === "pendiente" && (r.fecha > hoy || (r.fecha === hoy && r.fin > hora)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio));
}

/** ¿La persona falta ese día? (es titular de algún relevo registrado en esa fecha) */
function faltaEseDia(datos, personaId, fechaISO) {
  return datos.relevos.some(r => r.titularId === personaId && r.fecha === fechaISO);
}

/**
 * Propone quién cubre cada pendiente, en orden de fecha.
 * Trabaja sobre una COPIA de los datos: cada asignación propuesta cuenta
 * para las siguientes, así nadie pasa de 3 por semana ni queda en dos
 * programas a la vez dentro de la misma propuesta. Usa el mismo orden
 * justo que las sugerencias (primero quien ha cubierto menos en el mes)
 * y nunca propone a quien también falta ese día (incapacidad, vacaciones…):
 * si no queda nadie, el pendiente queda sin propuesta para decidirlo a mano.
 * Devuelve [{ relevo, persona | null, semana }]: `semana` = cuántos
 * relevos tendría esa persona esa semana si se acepta.
 */
function proponerRelevos(datos, pendientes) {
  const simulado = { ...datos, relevos: datos.relevos.map(r => ({ ...r })) };
  return pendientes.map(pendiente => {
    const elegido = sugerirRelevos(simulado, { ...pendiente, ignorarId: pendiente.id })
      .find(s => s.disponible && !faltaEseDia(simulado, s.persona.id, pendiente.fecha));
    if (!elegido) return { relevo: pendiente, persona: null, semana: 0 };
    const copia = simulado.relevos.find(r => r.id === pendiente.id);
    copia.estado = "cubierto";
    copia.relevoId = elegido.persona.id;
    return { relevo: pendiente, persona: elegido.persona, semana: elegido.semana + 1 };
  });
}

/* ---------- Contador por persona (Requisito 07) ---------- */

/**
 * Para cada presentador: cuántos relevos hizo, cuántas veces lo
 * relevaron, cuántas horas cubrió, cuántos lleva esta semana y su
 * saldo de equidad (hechos − recibidos).
 * Si se pasa `mes` ("2026-11"), solo cuenta ese mes.
 */
function contarPorPersona(datos, mes = null) {
  const semanaActual = lunesDe(hoyISO());
  const filas = datos.presentadores.map(p => ({
    persona: p,
    hechos: 0,
    recibidos: 0,
    horas: 0,
    semana: 0,
    saldo: 0,
  }));
  const porId = Object.fromEntries(filas.map(f => [f.persona.id, f]));

  for (const r of datos.relevos) {
    if (r.estado !== "cubierto") continue;
    if (mes && !r.fecha.startsWith(mes)) continue;
    const quienCubre = porId[r.relevoId];
    const quienFalta = porId[r.titularId];
    if (quienCubre) {
      quienCubre.hechos += 1;
      quienCubre.horas += duracionHoras(r.inicio, r.fin);
      if (lunesDe(r.fecha) === semanaActual) quienCubre.semana += 1;
    }
    if (quienFalta) quienFalta.recibidos += 1;
  }

  filas.forEach(f => { f.saldo = f.hechos - f.recibidos; });

  return filas
    .filter(f => f.persona.activo || f.hechos || f.recibidos)
    .sort((a, b) =>
      (b.hechos - a.hechos) || (b.recibidos - a.recibidos) ||
      a.persona.nombre.localeCompare(b.persona.nombre)
    );
}

/* ---------- Ausencia de varios días ---------- */

const MAX_DIAS_AUSENCIA = 62;

/**
 * Todos los programas que una persona presenta entre dos fechas.
 * Devuelve [{ fecha, programa, existe }]: `existe` es true si ya hay
 * un relevo registrado para ese programa ese día (no se duplica).
 */
function programasDeAusencia(datos, personaId, desde, hasta) {
  const lista = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    for (const programa of programasDelDia(datos, fecha)) {
      if (programa.titularId !== personaId) continue;
      const existe = datos.relevos.some(r =>
        r.programaId === programa.id && r.fecha === fecha && seCruzan(r.inicio, r.fin, programa.inicio, programa.fin)
      );
      lista.push({ fecha, programa, existe });
    }
  }
  return lista;
}

function validarAusencia(datos, { personaId, desde, hasta }) {
  const errores = {};
  if (!personaId) errores.persona = "Elige quién falta.";
  else if (!datos.programas.some(p => programaActivo(p) && p.titularId === personaId)) {
    errores.persona = `${nombrePersona(datos, personaId)} no es titular de ningún programa, así que no hay nada que cubrir.`;
  }
  if (!desde || !hasta) errores.desde = "Elige la fecha de inicio y de fin.";
  else if (hasta < desde) errores.desde = "La fecha final debe ser igual o posterior a la inicial.";
  else if (diasEntre(desde, hasta) > MAX_DIAS_AUSENCIA) errores.desde = `El rango máximo es de ${MAX_DIAS_AUSENCIA} días.`;
  return errores;
}

/** Días entre dos fechas "AAAA-MM-DD". */
function diasEntre(desde, hasta) {
  return Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);
}

/* ---------- Validar un programa (Ajustes) ---------- */

function validarPrograma(datos, p, ignorarId = null) {
  const errores = {};
  const nombre = (p.nombre || "").trim();
  if (!nombre) errores.nombre = "Escribe el nombre del programa.";
  else if (datos.programas.some(x => x.id !== ignorarId && programaActivo(x) && x.nombre.toLowerCase() === nombre.toLowerCase())) {
    errores.nombre = "Ya existe un programa con ese nombre.";
  }
  if (!p.dias || p.dias.length === 0) errores.dias = "Marca al menos un día.";
  if (!p.inicio || !p.fin) errores.inicio = "Escribe la hora en que empieza y termina.";
  else if (p.fin <= p.inicio) errores.inicio = "La hora de fin debe ser después de la hora de inicio.";
  if (!p.titularId) errores.titularId = "Elige quién lo presenta.";

  // Una emisora solo transmite un programa a la vez
  if (!errores.dias && !errores.inicio) {
    const cruce = datos.programas.find(x =>
      x.id !== ignorarId && programaActivo(x) &&
      x.dias.some(d => p.dias.includes(d)) &&
      seCruzan(p.inicio, p.fin, x.inicio, x.fin)
    );
    if (cruce) {
      const dias = cruce.dias.filter(d => p.dias.includes(d));
      errores.inicio = `Se cruza con «${cruce.nombre}» (${textoDias(dias)}, ${horario(cruce.inicio, cruce.fin)}).`;
    }
  }
  return errores;
}

/* ---------- Resumen de un mes (Nivel 2) ---------- */

function resumenDelMes(datos, mes) {
  const relevos = datos.relevos.filter(r => r.fecha.startsWith(mes));
  const cubiertos = relevos.filter(r => r.estado === "cubierto");
  return {
    relevos,
    total: relevos.length,
    cubiertos: cubiertos.length,
    pendientes: relevos.filter(r => r.estado === "pendiente").length,
    sinCubrir: relevos.filter(r => r.estado === "sin-cubrir").length,
    horas: cubiertos.reduce((suma, r) => suma + duracionHoras(r.inicio, r.fin), 0),
    porResolver: relevosOrdenados(relevos.filter(r => r.estado !== "cubierto")).reverse(),
  };
}

/**
 * Semanas (lunes a domingo) que tocan un mes, con sus relevos de ESE mes:
 * [{ lunes, cubierto, pendiente, "sin-cubrir", total }]
 * La usan la gráfica de Reportes, el PDF y el Excel.
 */
function semanasDelMes(datos, mes) {
  const [anio, numMes] = mes.split("-").map(Number);
  const ultimoDia = aISO(new Date(anio, numMes, 0));
  const semanas = [];
  for (let lunes = lunesDe(`${mes}-01`); lunes <= ultimoDia; lunes = sumarDias(lunes, 7)) {
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
  return semanas;
}

/* ---------- ¿Qué está al aire ahora? ---------- */

/**
 * Devuelve { programa, relevo } del programa que está sonando en este
 * momento, o null si Onda Viva está fuera del aire.
 */
function alAireAhora(datos, ahora = new Date()) {
  const fecha = aISO(ahora);
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const programa = programasDelDia(datos, fecha)
    .find(p => p.inicio <= horaActual && horaActual < p.fin);
  if (!programa) return null;
  const relevo = datos.relevos.find(r =>
    r.programaId === programa.id && r.fecha === fecha && r.inicio <= horaActual && horaActual < r.fin
  ) || null;
  return { programa, relevo };
}
