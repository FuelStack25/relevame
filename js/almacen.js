/* ==========================================================
   almacen.js — Guardar y leer los datos (localStorage)
   ----------------------------------------------------------
   Todo se guarda en UNA sola clave como texto JSON:
   {
     presentadores: [{ id, nombre, activo }],
     programas:     [{ id, nombre, dias:[1..6], inicio, fin, titularId }],
     relevos:       [{ id, fecha, programaId, inicio, fin, titularId,
                       relevoId, motivo, observaciones, estado, creadoEn }],
     esEjemplo:     true | false
   }
   Se guardan los ID de las personas (no sus nombres) para que,
   si alguien cambia de nombre, la bitácora no se rompa.
   ========================================================== */

const CLAVE_ALMACEN = "ondaviva.bitacora.v1";

const Almacen = {
  /** Estructura vacía, para "empezar de cero". */
  vacio() {
    return { presentadores: [], programas: [], relevos: [], esEjemplo: false };
  },

  /** Lee los datos. Devuelve null si no hay nada guardado o si está dañado. */
  cargar() {
    try {
      const texto = localStorage.getItem(CLAVE_ALMACEN);
      if (!texto) return null;
      const datos = JSON.parse(texto);
      if (!Almacen.esValido(datos)) return null;
      return datos;
    } catch (error) {
      console.warn("No se pudieron leer los datos guardados:", error);
      return null;
    }
  },

  /** Guarda los datos. Devuelve true si funcionó. */
  guardar(datos) {
    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(datos));
      return true;
    } catch (error) {
      console.error("No se pudieron guardar los datos:", error);
      return false;
    }
  },

  /** Revisa que un objeto tenga la forma correcta (también sirve para restaurar copias). */
  esValido(datos) {
    return Boolean(
      datos &&
      Array.isArray(datos.presentadores) &&
      Array.isArray(datos.programas) &&
      Array.isArray(datos.relevos)
    );
  },
};
