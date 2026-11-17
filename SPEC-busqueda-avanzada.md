# Spec: busqueda-avanzada — criterios como en la app Android — V1

Status: approved (2026-11-18) — hereda los límites de
[`SPEC-transacciones-v1.md`](./SPEC-transacciones-v1.md)
Scope: SPA (`webui/webapp`) y `GET /api/v1/transactions`. Sin cambios en la app
Android.

## Objetivo

Poder buscar en la lista como en el móvil: texto, importe, fechas, tipo,
categorías, beneficiarios, etiquetas, métodos y estado, combinando criterios y
quitándolos de uno en uno. Hoy hay cuatro filtros simples y un `type`.

## Comportamiento actual (medido)

- `Transactions.tsx` ofrece cuatro `SearchSelect` (`categoryId`, `payeeId`,
  `tagId`, `methodId`) y un `type` (`both|expense|income`); todo AND, en la URL
  y como chips.
- API: `transactionSelection` en `ApiQueries.kt` acepta **un** valor por
  dimensión; no hay texto, importe, estado ni transferencias.
- La app Android tiene un criterio por dimensión (`provider/filter/`) y los
  combina con AND; `CommentCriterion` y `FtsCriterion` cubren el texto y
  `AmountCriterion` el importe con signo y operación.

## Comportamiento nuevo

Criterios, todos opcionales y combinados con AND:

| Criterio | Semántica (como la app) | Parámetros |
|---|---|---|
| Texto | Comentario, nombre del beneficiario y referencia, sin distinguir mayúsculas (los acentos requieren FTS, fuera de este corte) | `q` |
| Fechas | desde / hasta / entre; presets de la app (hoy, esta semana, este mes, este año) | `from`, `to` |
| Importe | mínimo y máximo sobre el valor absoluto, con signo opcional (solo gastos / solo ingresos) | `amountMin`, `amountMax`, `type` |
| Tipo | gastos, ingresos, ambos; transferencias incluidas o excluidas | `type`, `transfer` |
| Categorías | una o varias por id; una dividida entra si alguna parte la tiene (las hijas de una categoría padre quedan para cuando el API exponga el árbol) | `categoryId` (repetido o lista) |
| Beneficiarios | uno o varios | `payeeId` |
| Etiquetas | una o varias; coincide con cualquiera | `tagId` |
| Métodos | uno o varios | `methodId` |
| Estado | conciliado / no conciliado / anulado | `status` |

1. **Valores múltiples**: los parámetros repetidos (`?categoryId=1&categoryId=2`)
   se aceptan además de la forma actual de un solo valor; dentro de una
   dimensión los valores se suman con OR, entre dimensiones con AND.
2. **Panel de búsqueda** en la SPA con esos campos (hoja lateral en escritorio,
   pantalla completa en móvil), con las mismas etiquetas que el resto de la UI y
   `SearchSelect` para las listas.
3. **Chips** por criterio activo, con su «×», más «Quitar filtros»; la URL lleva
   el estado completo y recargar lo conserva.
4. **Compatibilidad**: los enlaces con `categoryId=…` de hoy siguen funcionando;
   `type` mantiene sus valores.
5. **Estados**: sin resultados («No hay transacciones con estos criterios»),
   error de red y recuento del total del servidor (`total`), nunca calculado en
   el cliente.
6. **Rendimiento**: la consulta usa los índices existentes; el texto se resuelve
   con `LIKE` sobre comentario/beneficiario/referencia (la app usa FTS cuando
   está disponible; en la web no hay FTS expuesto y se documenta).

## Ficheros

- `webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt`
  (`transactionSelection`, `codeParam`)
- `webui/src/main/java/org/totschnig/webui/api/ApiRoutes.kt` (parámetros)
- `webui/webapp/src/api.ts`, `src/filters.ts`, `src/components/Transactions.tsx`
- nuevo `webui/webapp/src/components/SearchPanel.tsx`
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`
- `webui/API.md`, `webui/DESIGN.md`, `webui/webapp/README.md`, `AGENTS.md`

## Estrategia de verificación

- `ApiRoutesTest`: cada parámetro por separado y una combinación de tres;
  valores múltiples y valor desconocido (400/422 con mensaje claro).
- `WebQueryReproTest` (SQLite real): texto con acentos, importe con signo,
  categoría padre con hijas, etiqueta múltiple y estado; es donde se rompen las
  consultas (ver `SPEC-consultas-informes.md`).
- SPA: test de serialización URL ↔ criterios, y de que quitar un chip no toca
  los demás.
- Manual: buscar por texto, acotar por importe y estado, comprobar el recuento
  con `curl` y la lista en 1440×900 y 390×844.

## Límites

- Always: los criterios se combinan con AND; la paginación y el orden no cambian.
- Always: los importes viajan en unidades menores; el texto se escapa en las
  consultas.
- Ask first: añadir FTS al servidor o tocar índices.
- Never: filtrar en el cliente resultados ya paginados (el `total` y los grupos
  serían falsos).

## Criterios de éxito

- Una búsqueda por texto con acentos encuentra las mismas transacciones que la
  app para el mismo término.
- `amountMin=10&amountMax=20&type=expense` devuelve solo gastos entre 10 y 20.
- Dos categorías devuelven la unión; una categoría con hijas incluye sus hijas.
- Quitar el último criterio deja la URL limpia y la lista completa.
- El `total` del servidor coincide con el número de filas al cargar todo.

## Fuera de alcance

- FTS real en el servidor (se usa `LIKE`; la app lo tiene, la web no lo expone).
- Filtros por adjuntos y por cuenta: la lista ya es por cuenta y los adjuntos no
  están en el DTO (se reevalúan cuando el API los exponga).
- Búsquedas guardadas o alertas.
