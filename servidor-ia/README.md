# Intermediario de IA de Relévame

La página no puede guardar la clave de la IA (cualquiera la vería en el navegador o en GitHub).
Por eso este pequeño servidor vive en el VPS, guarda la clave y es el único que habla con la IA.

```
Navegador ──POST /api/ia/entender──▶ servidor.js (127.0.0.1:3017) ──▶ API de IA
                    nginx: relevame.developersolutions.org/api/ia/ → 127.0.0.1:3017
```

- **Sin dependencias:** solo Node 18+ (`fetch` viene incorporado).
- Rutas:
  - `GET /api/ia/estado`: dice si la IA está activa (la app muestra u oculta sus funciones de IA).
  - `POST /api/ia/entender`: convierte lo que se escribe o dicta en los datos de un relevo (JSON revisado).
  - `POST /api/ia/chat`: el asistente de ayuda. Lleva un manual de la app y los datos que calcula la app.
- **Cualquier IA con formato de chat de OpenAI:** Google Gemini (tiene plan gratuito), Groq, OpenRouter, OpenAI…
- **Si no hay clave o la IA falla**, la app usa su entendimiento básico (`js/voz.js`) y sigue funcionando.
- Lo que responde la IA **se revisa** antes de usarlo: solo pasan ids del equipo y programas, fechas válidas y estados conocidos.
- Límite: 8 consultas por minuto y 120 por hora por persona, para no agotar la cuota gratuita.

## Configuración: `/etc/relevame-ia.env` (solo root puede leerlo)

```
IA_CLAVE=la-clave-de-la-api
# Opcionales (estos son los valores por defecto, para Google Gemini):
IA_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
IA_MODELO=gemini-3.5-flash-lite
PUERTO=3017
```

Después de cambiarlo: `systemctl restart relevame-ia`.

## Conseguir una clave gratuita (Google Gemini)

1. Entrar a <https://aistudio.google.com/apikey> con una cuenta de Google.
2. *Create API key* y copiarla.
3. En el servidor: `nano /etc/relevame-ia.env`, escribir `IA_CLAVE=...`, guardar y `systemctl restart relevame-ia`.

> En el plan gratuito de Gemini, Google usa lo que se envía para mejorar sus productos.
> Con datos reales del equipo, conviene que la coordinadora lo sepa (la app lo avisa en el formulario).

## Comprobar

```
curl https://relevame.developersolutions.org/api/ia/estado   # {"activa":true,"modelo":"..."}
journalctl -u relevame-ia -n 20                               # registro del servicio
```
