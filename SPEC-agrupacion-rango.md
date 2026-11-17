# Spec: agrupacion-rango — la lista deja de estar atada al mes — V1

Status: approved (2026-11-18) — hereda los límites de
[`SPEC-transacciones-v1.md`](./SPEC-transacciones-v1.md)
Scope: SPA (`webui/webapp`) y `/api/v1/transactions` + `/api/v1/reports/grouped`.
Sin cambios en la app Android.

## Objetivo

Que Transacciones funcione como la lista del móvil: todas las transacciones,
de la más reciente hacia atrás, agrupadas por el periodo que elija el usuario.
Agrupar sirve para situarse; hoy el mes es una jaula (`Transactions.tsx` guarda
`month` y consulta `monthRange(month)`), así que no se puede ver el historial ni
cambiar de agrupación.

## Comportamiento actual (medido)

- `webui/webapp/src/components/Transactions.tsx`: estado `month` con botones
  «‹ ›»; la consulta usa `from`/`to` de `monthRange(month)`; la tira de KPIs
  llama a `/reports/summary` de ese mes. No hay agrupación: la tabla es plana.
- API: `GET /transactions?accountId&from&to&type&categoryId&payeeId&tagId&methodId&limit&offset`
  devuelve filas paginadas; `GET /reports/grouped?accountId&grouping&from&to`
  devuelve `year`, `second` (0-11 para `MONTH`), `incomeMinor`, `expensesMinor`,
  `transfersMinor`, sin fechas de inicio y fin del periodo.
- `DESIGN.md` no describe una cabecera de grupo ni un selector de agrupación.

## Comportamiento nuevo

1. **Selector de agrupación** con los cinco valores de la app (`Ninguna`, `Día`,
   `Semana`, `Mes`, `Año`). Por defecto `Mes`. Se recuerda en `localStorage` y
   se refleja en la URL (`grouping=MONTH`); si la URL trae otro valor, manda la
   URL.
2. **Sin recorte mensual.** La lista arranca en la transacción más reciente y
   pide páginas de 50 con «cargar más» (igual que hoy), sin `from`/`to` salvo
   que el rango esté activo. Desaparecen «‹ ›» como navegación principal.
3. **Cabeceras de periodo con su resumen.** Con agrupación distinta de
   `Ninguna`, cada periodo se abre con una cabecera que muestra, como el móvil:
   título («noviembre de 2026», «12–18 nov», «2026»), **ingresos, gastos y
   transferencias** del periodo (las transferencias solo si no son cero) y, como
   dato secundario, el número de movimientos. Son plegables, por defecto
   abiertas.
4. **Subtotales del servidor.** La cabecera usa `/reports/grouped` para el rango
   activo, nunca la suma de las filas cargadas. Para poder casar filas y grupos
   sin ambigüedad (sobre todo en `WEEK`), `GroupDto` añade `periodStart` y
   `periodEnd` (ISO) calculados con las reglas de agrupación de la app.
5. **Rango como filtro.** Chips de rango: `Todo` (por defecto), `Este mes`,
   `Últimos 3 meses`, `Este año` y `Personalizado` (desde/hasta). Con `Todo` no
   se envían `from`/`to`; el resumen usa un rango abierto explícito
   (`from=1970-01-01`) para que la tira de KPIs siga siendo del servidor.
6. **Sin resumen global.** La tira de KPIs de la cabecera desaparece: el
   resumen vive en cada unidad agrupada, como en la app. Con agrupación
   `Ninguna` no hay cabeceras y por tanto no hay resumen; si más adelante se
   quiere, se decide en otra spec. Esto sustituye a `SPEC-web-ui-features.md` F1
   en lo que respecta a la tira.
7. **URL** con `grouping`, `preset` o `from`/`to`; los filtros de hoy
   (`categoryId`, `payeeId`, `tagId`, `methodId`) se siguen leyendo.
8. **Estados**: sin resultados en el rango, cargando más, error de red y lista
   vacía de la cuenta, con los textos que ya existen.

## Ficheros

- `webui/webapp/src/components/Transactions.tsx` (estado, selector, cabeceras)
- `webui/webapp/src/components/Transactions.tsx` + `src/format.ts` (título y
  rango de cada periodo)
- `webui/webapp/src/api.ts` (`getGrouped` con rango abierto, `getTransactions`
  sin `from`/`to`)
- `webui/webapp/src/styles/app.css` (cabecera de grupo y selector)
- `webui/src/main/java/org/totschnig/webui/api/ApiDtos.kt` (`GroupDto`)
- `webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt` (fechas del grupo)
- `webui/API.md`, `webui/DESIGN.md`, `AGENTS.md`

## Estrategia de verificación

- `ApiRoutesTest`: `GroupDto` con `periodStart`/`periodEnd` para `MONTH` y
  `WEEK`, y `/transactions` sin `from`/`to` devolviendo la página más reciente.
- `WebQueryReproTest` (SQLite real): la consulta semanal respeta el inicio de
  semana de la app (el punto donde un cálculo en el cliente se desviaría).
- SPA: test de `grouping`/`preset` ↔ URL y de la clave de periodo a partir de
  las fechas del servidor.
- Mock: fixtures con más de un mes y `grouping` en los switches de QA.
- Manual en 1440×900 y 390×844: cambiar agrupación con historial largo, plegar
  grupos, «cargar más» dentro de un grupo, rango `Todo` y personalizado.

## Límites

- Always: el orden es fecha descendente; los subtotales vienen del servidor.
- Always: la agrupación no altera el conjunto de resultados (mismo total con
  cualquier agrupación, comprobable con `curl`).
- Ask first: cambiar el tamaño de página o el endpoint de la lista.
- Never: sumar en el cliente importes que el servidor ya devuelve.

## Criterios de éxito

- Con 6 meses de datos, la lista muestra los 6 al hacer «cargar más», agrupados
  por mes, y el resumen de cada cabecera coincide con `/reports/grouped` para ese
  periodo (ingresos, gastos, transferencias).
- No queda ninguna tira de KPIs global en la pantalla; con `Ninguna` no hay
  cabeceras ni resumen.
- Cambiar entre `Día`, `Semana`, `Mes`, `Año` y `Ninguna` no cambia el número
  total de transacciones.
- Recargar la página conserva agrupación y rango.
- `?grouping=WEEK` con un rango que cruza el fin de semana no deja filas fuera
  de ningún grupo ni duplica filas entre dos.

## Fuera de alcance

- «Ir a un periodo» con salto directo (el historial es continuo).
- Preferencia de agrupación por cuenta (viene de la app; requiere API).
