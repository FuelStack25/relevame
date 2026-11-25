# Relévame · Bitácora de relevos de Onda Viva

Sitio web para registrar, consultar y contar los relevos de presentadores de la emisora Onda Viva.
Hecho solo con **HTML, CSS y JavaScript**, sin librerías.

## Cómo abrirlo
Doble clic en `index.html`. No necesita servidor: se usan `<script>` normales (no módulos)
precisamente para que funcione así. La app instalable y el modo sin conexión se activan
cuando el sitio está publicado en internet (GitHub Pages).

## Estructura
```
index.html               Estructura, íconos SVG y diálogos
manifest.webmanifest     Datos de la app instalable (nombre, ícono, colores)
sw.js                    Service worker: copia local para abrir sin internet
icons/                   Ícono de la app
css/estilos.css          Estilo "Consola de cabina": tema oscuro y claro, celular primero, impresión
js/formato.js            Fechas y horas en español
js/almacen.js            Guardar y leer en localStorage
js/reglas.js             Reglas del negocio (validaciones, 3 por semana, choques, sugerencias, ausencias, contador)
js/datos-ejemplo.js      34 presentadores, 21 programas y relevos ficticios
js/ui.js                 Íconos, insignias, avisos y confirmaciones
js/whatsapp.js           Mensajes listos para pedir relevos por WhatsApp
js/formulario.js         Registrar / editar un relevo
js/ausencia.js           Ausencia de varios días → crea todos los pendientes
js/ficha.js              Ficha de cada presentador
js/guia.js               Guía de primer uso y atajos
js/resolver.js           Proponer quién cubre todos los pendientes de una vez
js/cabina.js             Modo Cabina: pantalla del estudio
js/vistas/*.js           Una pantalla por archivo: hoy, parrilla, bitácora, reportes, ajustes
js/app.js                Arranque, navegación, tema, atajos y app instalable
```

## Decisiones de reglas
| Duda | Decisión |
|---|---|
| ¿Qué es una semana? | De lunes a domingo |
| ¿Qué cuenta para el máximo de 3? | Solo relevos **Cubiertos** donde la persona cubre. Al editar, el relevo no se cuenta a sí mismo |
| Estado y relevo | Cubierto exige relevo; Pendiente y Sin cubrir lo dejan vacío |
| Choques | Nadie puede cubrir si a esa hora está al aire en su programa o ya cubre otro |
| Quitar personas o programas con historial | No se borran: quedan inactivos para no romper la bitácora |
| Domingos | Onda Viva no transmite; no se permiten relevos en domingo |
| Ausencias repetidas | Si un programa ya tiene relevo ese día, la ausencia no lo duplica |

## Requisitos cubiertos
- **Nivel 1:** formulario, validaciones, máx. 3 por semana, lista ordenada, sugerencias + confirmar antes de borrar,
  localStorage, contador por presentador, datos de ejemplo + borrar todo, diseño adaptable.
- **Nivel 2:** filtros (presentador, programa, estado, fechas), resumen del mes, alertas de hoy y mañana,
  administración de presentadores y programas, exportar CSV.
- **Nivel 3:** choques de horario, copia de seguridad y restauración, saldo de equidad,
  reporte mensual imprimible/PDF, gráficas (SVG hecho a mano).

## Ideas propias
- **Pedir relevos por WhatsApp** con el mensaje ya escrito (a una persona o al grupo del equipo).
- **Ausencia de varios días**: incapacidades y vacaciones crean todos los pendientes de una vez, con vista previa.
- **Guía de primer uso** de 5 pasos y botón de ayuda.
- **Ficha del presentador**: cupo, saldo, horas e historial de cada persona.
- **Parrilla semanal** tipo emisora y **medidor VU** del programa que está al aire.
- **Tema oscuro / claro** y **atajos de teclado**: `N` relevo, `A` ausencia, `R` proponer, `C` cabina, `/` buscar, `1`–`5` pantallas, `T` tema, `?` ayuda.
- **App instalable** que funciona sin internet.
- **Nada pendiente se pierde**: los pendientes que ya pasaron siguen en *Hoy* con respuesta en un toque
  (*Se cubrió* / *No salió*, con Deshacer), y la pestaña *Hoy* muestra cuántos hay por resolver.
- **Directo a buscar relevo**: al abrir un pendiente se despliegan solas las sugerencias.
- **No se pierde lo escrito**: si un formulario tiene cambios, se pregunta antes de cerrarlo.
- **Proponer quién cubre** (`R`): reparte todos los pendientes de una vez respetando el máximo de 3, los choques
  y la equidad; cada asignación cuenta para las siguientes. Se revisa, se confirma por WhatsApp y se asigna con Deshacer.
- **Modo Cabina** (`C`): pantalla completa para el televisor del estudio con luz AL AIRE, reloj, cuenta regresiva
  y lo que sigue; mantiene la pantalla encendida.
- **Primeros pasos** al empezar de cero y **pegar la lista** completa de presentadores.

## Publicar en GitHub Pages
1. Crear un repositorio y subir esta carpeta.
2. *Settings → Pages → Branch: main / root → Save.*
3. El sitio queda en `https://<usuario>.github.io/<repositorio>/`.
4. Si se cambia algún archivo, subir el número de `VERSION` en `sw.js`.
