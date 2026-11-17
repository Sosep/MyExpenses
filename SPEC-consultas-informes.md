# Spec: consultas-informes — 500 en filtros, drill-down y todas las cuentas — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md)
Scope: consultas de lectura de `:webui` sobre el provider. Sin cambios de contrato.

## Objetivo

Que ninguna consulta de lectura devuelva 500 con parámetros válidos. Hoy fallan
tres rutas que la SPA usa en pantalla: los filtros de la lista, el detalle de un
grupo de informe y la agregación de todas las cuentas.

## Comportamiento actual (evidencia del QA)

| Petición | Resultado |
|---|---|
| `GET /transactions?accountId=1&categoryId=1` | **500** `internal_error` (también con la cuenta vacía) |
| `GET /transactions?accountId=1&tagId=1` | **500** |
| `GET /reports/transactions?accountId=1&by=payee&id=0&type=expense` | **500** (igual con `category`, `method`, `tag`) |
| `GET /reports/summary?accountId=all` | **500** |
| `GET /reports/breakdown?accountId=all&by=category` | **500** |
| `GET /reports/grouped?accountId=all` | 400 (`accountId` debe ser número) |

Funcionan: `payeeId`, `methodId`, `by=payee`, `by=method`, `reports/summary` por
cuenta y `reports/grouped` por cuenta.

## Sospechas a confirmar

1. **Alias de la vista extendida.** `ApiQueries.transactionSelection`
   (`webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt:553-575`) y
   `queryReportTransactions` (`ApiQueries.kt:216-260`) referencian
   `$VIEW_EXTENDED.$KEY_ROWID` (`transactions_extended._id`) dentro de la
   selección. Si el provider ejecuta la selección sobre otra tabla/alias, SQLite
   lanza y `StatusPages` lo convierte en 500. Explica filtros de etiqueta,
   subconsulta de categoría y drill-down por etiqueta. No explica payee/method.
2. **Parámetro de cuenta ausente en el drill-down.** El listado construye la URI
   con `DataBaseAccount.uriBuilderForTransactionList(accountId, extended = true)`;
   el drill-down consulta `TransactionProvider.EXTENDED_URI` sin el parámetro de
   cuenta. Si el provider lo exige, cualquier `by` revienta, que es justo lo
   observado.
3. **`accountId=all`**: `querySummary`/`queryBreakdown` usan `KEY_DISPLAY_AMOUNT`
   con `accountId` nulo. Sospecha: la vista/consulta de importe equivalente falla
   cuando no hay filtro de cuenta o cuando falta la divisa base.

## Comportamiento nuevo

- Las cinco peticiones de la tabla responden 200 con datos coherentes.
- La causa raíz se corrige en la capa que la provoca (selección, URI o consulta),
  no tragando la excepción ni devolviendo listas vacías.
- Se mantiene el 400 de `/reports/grouped?accountId=all` (no soportado por
  contrato) y se documenta junto a las otras dos rutas.

## Ficheros

- `webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt`
- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`
- `webui/API.md` (nota de `accountId=all` por endpoint)

## Estrategia de verificación

- `ApiRoutesTest`: casos de 200 para `categoryId`, `tagId`, drill-down por cada
  `by` y `accountId=all`, con el `WebApiDataSource` falso. Estos tests fijan el
  contrato HTTP, no el SQL.
- El SQL real se verifica en dispositivo con los `curl` del informe de QA y con
  el log de la app (`IWebInputService.report`), que es donde aparece la excepción
  de SQLite.
- Regresión en la SPA: abrir la lista con un chip de categoría y pulsar un grupo
  del informe sin banner de error.

## Límites

- Always: los errores de SQL deben verse en el log del dispositivo, no silenciarse.
- Ask first: tocar el esquema o los triggers del provider.
- Never: convertir un 500 en 200 con lista vacía.

## Criterios de éxito

- Las cinco peticiones de la tabla devuelven 200 en el móvil real.
- El detalle de un grupo de informe lista exactamente las transacciones del grupo.
- `accountId=all` en resumen y reparto coincide con la suma de cuentas convertida
  a la divisa base.
- `ApiRoutesTest` cubre cada ruta con su caso feliz y con `accountId` desconocido.

## Fuera de alcance

- Optimizar el rendimiento de estas consultas.
- Agregar `accountId=all` a `/reports/grouped` o al drill-down.
