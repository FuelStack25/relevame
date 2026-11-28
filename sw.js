/* ==========================================================
   sw.js — Service worker (modo sin conexión)
   ----------------------------------------------------------
   Guarda una copia de los archivos del sitio en el teléfono o
   computador. Así la bitácora abre aunque no haya internet.
   Cada vez que se cambie algún archivo, sube el número de
   VERSION para que los usuarios reciban la versión nueva.
   ========================================================== */

const VERSION = "relevame-v9";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/formato.js",
  "./js/almacen.js",
  "./js/reglas.js",
  "./js/datos-ejemplo.js",
  "./js/ui.js",
  "./js/whatsapp.js",
  "./js/formulario.js",
  "./js/ausencia.js",
  "./js/ficha.js",
  "./js/guia.js",
  "./js/resolver.js",
  "./js/cabina.js",
  "./js/voz.js",
  "./js/xlsx.js",
  "./js/informe.js",
  "./js/asistente.js",
  "./lib/jspdf.umd.min.js",
  "./lib/jspdf.plugin.autotable.min.js",
  "./js/vistas/hoy.js",
  "./js/vistas/parrilla.js",
  "./js/vistas/bitacora.js",
  "./js/vistas/reportes.js",
  "./js/vistas/ajustes.js",
  "./js/app.js",
  "./icons/icono.svg",
  "./icons/icono-192.png",
  "./icons/icono-512.png",
];

// Al instalar: guarda todos los archivos
self.addEventListener("install", evento => {
  evento.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// Al activar: borra las copias de versiones viejas
self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys().then(claves => Promise.all(claves.filter(c => c !== VERSION).map(c => caches.delete(c))))
  );
  self.clients.claim();
});

// Al pedir un archivo: primero intenta internet (para tener lo último);
// si no hay conexión, usa la copia guardada.
self.addEventListener("fetch", evento => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    fetch(evento.request)
      .then(respuesta => {
        const copia = respuesta.clone();
        if (respuesta.ok || respuesta.type === "opaque") {
          caches.open(VERSION).then(cache => cache.put(evento.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(evento.request, { ignoreSearch: true }))
  );
});
