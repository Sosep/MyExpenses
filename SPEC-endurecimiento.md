# Spec: endurecimiento — transporte, cabeceras, intentos e importes — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md)
Scope: configuración Ktor, cabeceras, límite de intentos y validación de importes.

## Objetivo

Reducir el riesgo y el coste de servir la SPA desde el móvil en una red local:
comprimir los assets, enviar cabeceras de seguridad básicas, limitar los intentos
de contraseña y acotar los importes que acepta la API.

## Comportamiento actual (evidencia del QA)

- `GET /app/assets/index-*.js` → 387 117 bytes **sin gzip** aunque se envíe
  `Accept-Encoding: gzip`; ninguna respuesta lleva `Content-Encoding`.
- Sin `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` ni
  `Permissions-Policy`. `/app` y `/api/v1` viajan por HTTP en claro (la cookie
  `SameSite=Strict; HttpOnly` va sin `Secure` porque el servidor es HTTP).
- `POST /api/v1/session` con contraseña incorrecta: 6 intentos seguidos → 6×401,
  sin retardo ni bloqueo.
- `POST /api/v1/transactions` acepta `amountMinor: -1000000000000000` (201) y lo
  aplica al saldo.
- Positivo que no debe perderse: `/app` con `no-cache`, assets con
  `public, max-age=31536000, immutable`, API con `no-store`, `401` en toda la
  API sin cookie, traversal en `/files` bloqueado con 404.

## Comportamiento nuevo

1. **Compresión**: se instala `Compression` de Ktor (gzip) para `text/*`,
   `application/json`, `application/javascript` y `image/svg+xml`, con umbral
   razonable (≥ 1 KiB). Los assets ya comprimidos no se recomprimen.
2. **Cabeceras**: las respuestas de `/app` y `/api/v1` incluyen
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
   `Permissions-Policy` mínima y una CSP compatible con la SPA actual (sin
   `unsafe-eval`; `script-src 'self'`, `style-src 'self' 'unsafe-inline'` por los
   estilos inline del index, `connect-src 'self'`, `img-src 'self' data:`).
   Si la CSP rompe el arranque, se ajusta con evidencia y se documenta.
3. **Intentos de sesión**: máximo 5 fallos por IP en 60 s; a partir de ahí `429`
   con `Retry-After`. Un acierto reinicia el contador. No se registra la
   contraseña en ningún log.
4. **Importes acotados**: `amountMinor` (simple, transferencia, dividida, partes
   y presupuesto) se valida contra un rango explícito, por ejemplo
   `|amount| ≤ 10^12` unidades menores, con `422 validation_failed` y campo
   `amountMinor`. El límite se documenta en `API.md`.

## Ficheros

- `webui/src/main/java/org/totschnig/webui/WebInputService.kt` (módulo Ktor,
  `:290-349`; `StatusPages` en `:312`)
- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
  (validación de importes: `requireNonZero` en :313, :374, :429, :528, :698, :750)
- `webui/src/main/java/org/totschnig/webui/api/ApiRoutes.kt` (`/session`)
- `webui/API.md` (límites y códigos nuevos)
- `AGENTS.md` (nota de cabeceras y compresión)

## Estrategia de verificación

- `ApiRoutesTest`: 401/429 en `/session` tras N fallos (con reloj inyectable o
  ventana corta), y 422 para importes fuera de rango en cada endpoint de escritura.
- Transporte: `curl -H 'Accept-Encoding: gzip' -D -` comprobando
  `Content-Encoding: gzip` en el JS y cabeceras de seguridad en `/app` y `/api/v1`.
- SPA: `npm run build` + mock; abrir en el móvil y confirmar que la CSP no rompe
  el arranque, el service worker ni las fuentes.

## Límites

- Always: la sesión sigue siendo cookie `HttpOnly; SameSite=Strict`; no se
  introducen tokens en `localStorage`.
- Always: el `429` no revela si la contraseña era correcta o no.
- Ask first: cualquier cabecera que obligue a HTTPS (HSTS) o a cambiar el
  certificado por defecto.
- Never: desactivar la validación de importes de la app por comodidad.

## Criterios de éxito

- El JS principal se sirve con `Content-Encoding: gzip` y baja de forma clara de
  tamaño en `curl`.
- `/app` y `/api/v1` responden con las cabeceras acordadas y la SPA arranca sin
  errores de consola en el móvil.
- El sexto intento fallido en un minuto recibe `429`; el primero correcto entra.
- Un importe de 10^15 unidades menores se rechaza con 422 y no altera el saldo.

## Fuera de alcance

- HTTPS obligatorio, HSTS y gestión de certificados (hoy el TLS es opcional).
- CORS: la SPA es mismo origen.
- Auditoría de dependencias del frontend.
