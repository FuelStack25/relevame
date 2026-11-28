/* ==========================================================
   cabina.js — Modo Cabina (pantalla para el estudio)
   ----------------------------------------------------------
   Pantalla completa pensada para un televisor o tableta en la
   cabina: luz AL AIRE, reloj, programa y presentador actual,
   cuenta regresiva y lo que viene después. Se actualiza cada
   segundo y pide que la pantalla no se apague.
   Siempre oscura, como una consola de radio.
   ========================================================== */

const Cabina = { reloj: null, despierta: null, volverA: null };

// Lo que queda detrás de la cabina: se vuelve "inerte" (ni clic ni teclado) mientras está abierta
const FONDO_CABINA = ["header.cabecera", ".barra", "#aviso-ejemplo", "#contenido"];

function cabinaAbierta() {
  return !document.getElementById("cabina").hidden;
}

function prepararCabina() {
  document.getElementById("cabina-salir").addEventListener("click", cerrarCabina);
  // Sin pantalla completa, Esc llega a la página y cierra la cabina
  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && cabinaAbierta()) cerrarCabina();
  });
  // Con pantalla completa, el navegador usa Esc para salir de ella: entonces se cierra también la cabina
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && cabinaAbierta()) cerrarCabina();
  });
}

/** Abre la cabina AL INSTANTE; la pantalla completa es un extra que no la bloquea. */
function abrirCabina() {
  const cabina = document.getElementById("cabina");
  if (cabinaAbierta()) return;
  Cabina.volverA = document.activeElement;
  pintarCabina();
  cabina.hidden = false;
  FONDO_CABINA.forEach(s => document.querySelector(s)?.setAttribute("inert", ""));
  document.body.classList.add("con-cabina");
  document.getElementById("cabina-salir").focus();
  Cabina.reloj = setInterval(pintarCabina, 1000);

  // Pantalla completa de la cabina misma (si el navegador no lo permite, se ve igual dentro de la ventana)
  cabina.requestFullscreen?.().catch(() => {});
  // Que la pantalla no se apague mientras está en la cabina (si el navegador lo permite)
  navigator.wakeLock?.request("screen").then(l => { Cabina.despierta = l; }).catch(() => {});
}

function cerrarCabina() {
  if (!cabinaAbierta()) return;
  document.getElementById("cabina").hidden = true;
  clearInterval(Cabina.reloj);
  FONDO_CABINA.forEach(s => document.querySelector(s)?.removeAttribute("inert"));
  document.body.classList.remove("con-cabina");
  Cabina.despierta?.release().catch(() => {});
  Cabina.despierta = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  Cabina.volverA?.focus?.();
}

/** Quién presenta un programa en una fecha, teniendo en cuenta los relevos. */
function presentadorDe(programa, fecha) {
  const relevo = datos.relevos.find(r => r.programaId === programa.id && r.fecha === fecha);
  const titular = nombrePersona(datos, programa.titularId);
  if (!relevo) return { estado: "normal", nombre: titular, nota: "" };
  const falta = nombrePersona(datos, relevo.titularId);
  if (relevo.estado === "cubierto") return { estado: "cubierto", nombre: nombrePersona(datos, relevo.relevoId), nota: `cubre a ${falta}` };
  if (relevo.estado === "pendiente") return { estado: "pendiente", nombre: "Sin presentador confirmado", nota: `falta ${falta}` };
  return { estado: "sin-cubrir", nombre: "No sale al aire", nota: `falta ${falta}` };
}

/** Los próximos `cuantos` programas desde este momento (hoy y los días siguientes). */
function proximosProgramas(ahora, cuantos) {
  const hoy = aISO(ahora);
  const hora = horaAhora();
  const lista = [];
  for (let i = 0; i < 8 && lista.length < cuantos; i++) {
    const fecha = sumarDias(hoy, i);
    for (const programa of programasDelDia(datos, fecha)) {
      if (fecha === hoy && programa.inicio <= hora) continue;
      lista.push({ programa, fecha });
      if (lista.length === cuantos) break;
    }
  }
  return lista;
}

/** 1394 s → "23:14" · 4000 s → "1:06:40" */
function cuentaRegresiva(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dos = n => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

function pintarCabina() {
  const ahora = new Date();
  const hoy = aISO(ahora);
  const segundosHoy = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds();
  const dos = n => String(n).padStart(2, "0");
  const aire = alAireAhora(datos, ahora);

  // Programa al aire
  let centro;
  if (aire) {
    const { programa } = aire;
    const quien = presentadorDe(programa, hoy);
    const inicio = aMinutos(programa.inicio) * 60;
    const fin = aMinutos(programa.fin) * 60;
    const avance = (segundosHoy - inicio) / (fin - inicio);
    const encendidos = Math.max(1, Math.round(avance * 24));
    const leds = Array.from({ length: 24 }, (_, i) =>
      `<span class="${i < encendidos ? `on${i >= 20 ? " alto" : i >= 15 ? " medio" : ""}` : ""}"></span>`).join("");
    const iconoQuien = { normal: "i-mic", cubierto: "i-mic", pendiente: "i-alerta", "sin-cubrir": "i-mic-off" }[quien.estado];

    centro = `
      <div class="cabina__ahora cabina__ahora--${quien.estado}">
        <p class="cabina__etiqueta">Ahora · <span class="mono">${programa.inicio}–${programa.fin}</span></p>
        <h2 class="cabina__programa">${esc(programa.nombre)}</h2>
        <p class="cabina__persona">${icono(iconoQuien)} <span>${esc(quien.nombre)}</span>
          ${quien.nota ? `<small>${esc(quien.nota)}</small>` : ""}</p>
        <div class="vu cabina__vu" aria-hidden="true">${leds}</div>
        <div class="cabina__tiempo">
          <span class="mono">${programa.inicio}</span>
          <span>termina en <strong class="mono">${cuentaRegresiva(fin - segundosHoy)}</strong></span>
          <span class="mono">${programa.fin}</span>
        </div>
      </div>`;
  } else {
    const [siguiente] = proximosProgramas(ahora, 1);
    let cuando = "";
    if (siguiente && siguiente.fecha === hoy) {
      cuando = `en ${cuentaRegresiva(aMinutos(siguiente.programa.inicio) * 60 - segundosHoy)}`;
    } else if (siguiente) {
      cuando = `${fechaRelativa(siguiente.fecha).toLowerCase()} a las ${siguiente.programa.inicio}`;
    }
    centro = `
      <div class="cabina__ahora cabina__ahora--fuera">
        <p class="cabina__etiqueta">Ahora</p>
        <h2 class="cabina__programa">Fuera del aire</h2>
        <p class="cabina__persona">${siguiente
          ? `Sigue «${esc(siguiente.programa.nombre)}» <small class="mono">${cuando}</small>`
          : "No hay programas en la parrilla."}</p>
      </div>`;
  }

  // Lo que viene
  const siguientes = proximosProgramas(ahora, 3).map(({ programa, fecha }) => {
    const quien = presentadorDe(programa, fecha);
    const dia = fecha === hoy ? "" : `<small>${fechaRelativa(fecha)}</small>`;
    return `
      <li class="cabina__fila cabina__fila--${quien.estado}">
        <span class="cabina__hora mono">${dia}${programa.inicio}</span>
        <span class="cabina__nombre">${esc(programa.nombre)}</span>
        <span class="cabina__quien">${quien.estado === "pendiente" || quien.estado === "sin-cubrir" ? icono("i-alerta") : ""}${esc(quien.nombre)}
          ${quien.nota ? `<small>${esc(quien.nota)}</small>` : ""}</span>
      </li>`;
  }).join("");

  document.getElementById("cabina-cuerpo").innerHTML = `
    <header class="cabina__arriba">
      <div class="luz${aire ? " luz--on" : ""}"><span class="luz__punto"></span>${aire ? "Al aire" : "Fuera del aire"}</div>
      <div class="cabina__reloj">
        <span class="mono">${dos(ahora.getHours())}:${dos(ahora.getMinutes())}<span class="cabina__seg">:${dos(ahora.getSeconds())}</span></span>
        <small>${fechaLarga(hoy).replace(/ de \d{4}$/, "")}</small>
      </div>
    </header>
    ${centro}
    ${siguientes ? `
      <section class="cabina__siguientes">
        <h3>A continuación</h3>
        <ol>${siguientes}</ol>
      </section>` : ""}`;
}
