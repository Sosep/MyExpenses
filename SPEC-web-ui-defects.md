# Spec: Web UI defects — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-ui-v1.md`](./SPEC-web-ui-v1.md)
Scope: SPA (`webui/webapp`), servidor de mock, catálogos Lingui. Sin Kotlin ni API.

## Objetivo

Que la SPA no muestre datos falsos ni se rompa en la primera pantalla. Son los defectos
que un usuario ve antes que cualquier detalle de diseño: una gráfica sin barras, un topbar
cortado y frases en inglés dentro de una interfaz española.

## Comportamiento actual (medido)

| # | Defecto | Evidencia |
|---|---|---|
| D1 | La gráfica "Ingresos y gastos" se dibuja sin barras | Las 24 barras miden `0px` (computed). `Chart.tsx:12` usa `Math.max(current, Math.abs(incomeMinor), Math.abs(expensesMinor))`; el grupo de octubre llega con `expensesMinor: undefined` (el mock declara 11 ingresos y sólo 10 gastos, `mock-server.mjs:427-428`), el máximo pasa a `NaN`, `max === 0` no se cumple y todas las alturas salen `NaN%` |
| D2 | El topbar desborda en móvil | A 390 px el viewport útil es 375; el botón de cerrar sesión va de x=360 a 392. La marca se parte en dos líneas (100×42). Aparece scroll horizontal |
| D3 | Textos en inglés con la UI en español | `TransactionPanel.tsx:109` ("Retry"), `:232` ("Delete this transaction?"), `:246` ("Cancel"), `:268` ("Delete"); `Reports.tsx:149` ("Try again"); `api.ts:67,106,113,217,227`; `Transactions.tsx:133` |
| D4 | `?theme=dark` no hace nada con `?locale=es` | El mock hace click en `button[aria-label="Switch to dark"]`; la etiqueta real es "Cambiar a oscuro" |
| D5 | `?panel=split` no abre nada | El mock busca la fila con el texto "Split transaction" y cae en `rows[Number('split')-1]` → `rows[NaN]` |
| D6 | `theme-color` fijo en azul | `index.html:7`; en la PWA la barra del navegador va azul sobre un topbar blanco |

## Comportamiento nuevo

- **D1.** `Chart` trata ausente, `null` y `NaN` como 0 y sólo muestra el estado vacío cuando
  no hay ninguna cifra. El máximo se calcula sobre valores saneados.
- **D1.** El fixture del mock declara el mismo número de ingresos que de gastos y el grupo
  de octubre sale completo.
- **D2.** A ≤430 px el topbar cabe en una línea: la marca conserva el símbolo `Σ` y oculta
  el wordmark, o cuenta/idioma pasan a un menú `⋯`. Sin scroll horizontal en 360 y 390.
- **D3.** Todo texto visible pasa por `t`/`<Trans>`. Los errores de red se transportan como
  código (`ApiError.code`) y se traducen al pintar; `api.ts` deja de construir frases.
- **D4/D5.** El mock conmuta el tema con `[data-theme]` sobre `<html>` (no por etiqueta) y
  abre el panel por `data-kind` en la fila (no por texto). Ambos switches se documentan en
  `webui/webapp/README.md` y en `AGENTS.md`.
- **D6.** `theme-color` sigue al tema activo (dos metas con `media`, o actualización por JS
  junto al arranque del tema en `index.html`).

## Estructura (partes relevantes)

```
webui/webapp/src/components/Chart.tsx              -> saneado del máximo y de las alturas
webui/webapp/src/components/TransactionPanel.tsx   -> copy del pie y confirmación
webui/webapp/src/components/Reports.tsx            -> "Try again"
webui/webapp/src/components/Transactions.tsx       -> "Could not load more"
webui/webapp/src/api.ts                            -> ApiError con código, sin frases
webui/webapp/src/locales/{en,es}/messages.po       -> nuevos msgid/msgstr
webui/webapp/dev/mock-server.mjs                   -> fixtures y switches de QA
webui/webapp/index.html                            -> theme-color
webui/src/main/assets/webapp/                      -> build commiteado
```

## Estilo de código

Seguir el patrón existente: utilidades con tokens, copy por Lingui y errores que nombran el
objeto. Ejemplo del saneado esperado:

```ts
const value = (amount?: number | null) => (Number.isFinite(amount) ? Math.abs(amount) : 0)
const max = series.reduce((top, group) => Math.max(top, value(group.incomeMinor), value(group.expensesMinor)), 0)
```

## Estrategia de verificación

La SPA estrena runner: Vitest + jsdom (`npm test`) y axe-core para la pasada de accesibilidad.

1. `npm test` — `Chart.test.tsx` con tres casos: los doce meses con datos, un grupo con
   `expensesMinor` ausente (no vacía la gráfica) y todo a cero (estado vacío).
2. `npm run build && npm run mock`; abrir `?view=transactions&metrics=1`.
3. Resumen a 1440: las 12 columnas tienen barra de ingreso y de gasto con altura > 0.
4. Transacciones a 390×844: `scrollWidth === clientWidth`, el botón de cerrar sesión se ve
   entero, la marca ocupa una línea.
5. `?locale=es`: revisar las siete pantallas y el detalle de transacción; ninguna cadena en
   inglés. `npm run i18n:compile` pasa en modo estricto.
6. `?theme=dark&locale=es` y `?theme=dark&locale=en`: el tema cambia en ambos.
7. `?view=transactions&panel=split` y `?panel=transfer`: abren el panel correcto.

## Límites

- Always: `npm run build` y commitear `webui/src/main/assets/webapp/`; añadir el `msgstr`
  español en el mismo commit que el `msgid`; actualizar `README.md` y `AGENTS.md` si cambia
  un switch de QA.
- Ask first: añadir dependencias de test (Vitest, axe); cambiar el contrato de `/api/v1`.
- Never: tocar Kotlin o `API.md` para arreglar un defecto de presentación; dejar la gráfica
  con estado vacío como sustituto del arreglo; commitear `node_modules`.

## Criterios de éxito

- Con los fixtures actuales, las 24 barras de la gráfica tienen altura > 0.
- Un grupo con un campo ausente no vacía la gráfica.
- A 360 y 390 px no hay scroll horizontal y el topbar ocupa una línea.
- En español no queda ninguna cadena en inglés en Resumen, Transacciones, detalle, Informes,
  Presupuestos, Ficheros y Login.
- Los switches de tema y de panel funcionan con `es` y con `en`, y están documentados.

## Fuera de alcance (aplazado)

- Rediseñar la gráfica (ejes, valores, interacción) — va en `web-ui-density`.
- Mensajes de error traducidos a más de dos idiomas.
- Tests automatizados de la SPA (pendiente de la pregunta 6 del mapa).
