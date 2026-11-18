# Spec Delta: categorias-recursivas — una categoría incluye su rama — V1

Status: implemented (18-nov-2026). Pendiente: QA en dispositivo (tarea 1.7 de
[`tasks/categorias-recursivas/todo.md`](./tasks/categorias-recursivas/todo.md)).

Originales:
[`SPEC-busqueda-avanzada.md`](./SPEC-busqueda-avanzada.md) (dejó las hijas
"para cuando el API exponga el árbol"; su criterio de éxito las exigía) y
[`SPEC-presupuesto-movimientos.md`](./SPEC-presupuesto-movimientos.md)
(implementado: el drill-down de una fila debe sumar lo mismo que la fila).

Alcance: `GET /api/v1/transactions`, la SPA (`webui/webapp`), el mock y las
docs. Sin cambios de esquema, sin cambios en la app Android.

## 1. Objetivo

Que buscar por una categoría se comporte como en la app Android: al elegir
`Alimentación` entran también `Supermercado`, `Restaurantes` y cualquier nieta,
sin tener que marcar cada hoja a mano. Hoy la app lo hace (su
`CategoryCriterion` expande el árbol con un CTE recursivo) y la web no, así que
la misma búsqueda da totales distintos en el móvil y en la web.

Usuario: el dueño de los datos, filtrando movimientos en escritorio o móvil y
comparando con el presupuesto de esa rama.

## 2. Comportamiento actual (medido)

- App Android: `CategoryCriterion.getSelection()` genera
  `cat_id IN (WITH Tree AS (…semilla… UNION ALL …hijos…) SELECT _id FROM Tree)`;
  la semilla son los ids elegidos y el CTE baja por `parent_id`. Vale para la
  lista de movimientos y para el gasto de un presupuesto.
- `GET /transactions`: `transactionSelection` (`ApiQueries.kt`) compara
  `cat_id IN (?,…)` exacto, más la misma comparación sobre las partes de una
  dividida. No hay descendientes.
- Presupuestos: el filtro se guarda como `Criterion` en
  `budgetFilter_<id>` y el gasto se suma con `getSelectionForParts()`
  (`RepositoryBudget.sumLoaderForBudget`), es decir **ya es recursivo**; el
  desglose ya recorre descendientes y suma la madre (`budgetBreakdown`).
- El detalle del presupuesto compensa la diferencia en el cliente:
  `BudgetDetailPanel.drilldownUrl` recorre `breakdown.categories` y añade un
  `categoryId` por nodo del subárbol. Funciona, pero contradice el límite de
  `SPEC-presupuesto-movimientos` ("el cliente no filtra ni suma") y deja la
  lista dependiente de que el árbol venga en otra respuesta.
- `GET /reports/transactions?by=category&id=` sigue siendo exacto: devuelve los
  movimientos de esa fila del informe, no una búsqueda por rama.

## 3. Comportamiento nuevo

1. **`categoryId` significa la rama**: el id elegido más todos sus
   descendientes, a cualquier profundidad. Varios `categoryId` devuelven la
   unión de las ramas, sin duplicados aunque una rama contenga a otra.
2. **Dirección**: se baja, no se sube. Elegir `Supermercado` no trae
   `Alimentación` ni `Restaurantes`.
3. **Divididas**: la expansión se aplica igual al padre y a las partes; una
   dividida entra si alguna parte cae en la rama.
4. **Sin cambios en lo demás**: `uncategorized` sigue sin poder combinarse con
   `categoryId` (`400 invalid_filter`), los ids ≤ 0 siguen siendo
   `400 invalid_categoryId`, y el AND entre dimensiones y el OR dentro de
   categorías no cambian.
5. **Un solo sitio**: la expansión se hace en el servidor. La SPA manda los ids
   que el usuario marcó (los de la URL y los chips) y no calcula el árbol.
   El drill-down del presupuesto manda **una** `categoryId` y borra el recorrido
   manual de `BudgetDetailPanel`.
6. **Seña en la UI**: el selector de categorías de la búsqueda de movimientos y
   el del filtro del presupuesto indican una vez que la categoría incluye sus
   subcategorías (texto nuevo por Lingui, `en`/`es`).
7. **Mock**: filtra igual, con el árbol de sus fixtures; el QA switch
   `?view=transactions&categoryId=1` (madre con hijas) se documenta en
   `webui/webapp/README.md` y en `AGENTS.md`.

## 4. Decisiones y supuestos

- **Paridad, no opción.** Se asume que `categoryId` incluye la rama siempre, sin
  parámetro nuevo ni interruptor por búsqueda: es lo que hace la app y lo que
  pide el usuario. Un `includeSubcategories` sería un contrato más ancho y dos
  comportamientos que documentar. → Corregir ahora si se prefiere opt-in.
- **Presupuestos: no cambia la semántica.** El gasto ya es recursivo; este
  corte lo verifica, lo documenta y retira el rodeo del cliente. No se toca el
  JSON guardado en `budgetFilter_<id>`.
- **Informes: fuera.** `by=category&id=` sigue exacto para que el drill-down
  cuadre con la fila y su `count`.
- **Mecanismo.** Preferencia por expandir en Kotlin sobre el árbol que ya
  devuelve `repository.queryCategories()` (`id`, `parentId`) y dejar la
  selección SQL en un `IN (?,…)` plano: se prueba en JVM con
  `:webui:testDebugUnitTest`, no duplica el CTE de la app ni obliga a replicar
  SQL en `WebQueryReproTest`. Coste: una consulta de categorías por página de
  lista (árbol de decenas/cientos de nodos). Si el plan prefiere el CTE
  recursivo, la spec no cambia, solo el "cómo".
- **Rendimiento.** Sin índices nuevos; el `IN` expandido puede llevar más
  placeholders, pero acotado por el tamaño del árbol.

## 5. Ficheros

- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
  (`transactionPage`: expandir antes de consultar).
- `webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt` (helper puro de
  descendientes y/o `transactionSelection`).
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt` (contrato de
  parámetros y errores; la expansión vive en el datasource, así que el fake no
  la ve).
- `webui/webapp/src/components/Transactions.tsx`,
  `BudgetFilterFields.tsx`, `BudgetDetailPanel.tsx`.
- `webui/webapp/dev/mock-server.mjs`.
- `webui/API.md`, `AGENTS.md`, `webui/webapp/README.md`,
  `webui/DESIGN.md` solo si cambia el patrón de los selectores.

## 6. Estrategia de verificación

- JVM (`:webui:testDebugUnitTest`): helper de descendientes con árbol de tres
  niveles, id repetido, rama que contiene a otra, id sin hijas, id inexistente
  (se queda solo) y árbol vacío.
- `ApiRoutesTest`: `categoryId` repetido sigue llegando como lista; `400` de
  `invalid_categoryId` y del `uncategorized` + `categoryId`. La expansión no
  pasa por el fake (vive en el datasource) y la cubre `CategoryBranchTest`.
- Dispositivo (el SQL y el provider no corren en JVM): cuenta con
  `Alimentación > Supermercado > …` y una dividida; `GET /transactions` con la
  madre devuelve la rama, el `total` cuadra con el recuento, y la misma consulta
  da los mismos importes que la app. Presupuesto con la madre en el filtro: el
  detalle, el desglose y la lista del drill-down cuadran; la URL del enlace
  lleva una sola `categoryId`.
- SPA (`npm test`, `npm run build`): chips y URL intactos al elegir madre; el
  drill-down del presupuesto ya no enumera ids.
- Mock a 1440×900 y 390×844: `?view=transactions&categoryId=1` trae
  `Groceries`/`Restaurants`/`Treats`; sin errores de consola ni overflow.
- `ktlintCheck` y `:webui:compileDebugKotlin` en Docker.

## 7. Límites (delta sobre los originales)

- Always: la expansión y el `total` salen del servidor; el cliente no filtra
  resultados paginados ni suma importes.
- Always: importes en unidades menores y fechas ISO; el resto de criterios
  sigue en AND.
- Ask first: cambiar el formato guardado del filtro del presupuesto, añadir
  índices o un CTE recursivo nuevo (si no se reutiliza el de la app).
- Never: reescribir un filtro con `criteriaUnsupported`, tocar la app Android o
  editar a mano los assets generados.

## 8. Criterios de éxito

- `GET /transactions?accountId=1&categoryId=<madre>` devuelve los movimientos de
  la madre y de toda su descendencia, divididas incluidas, y su `total` coincide
  con las filas al paginar hasta el final.
- Filtrar por una hija no trae movimientos de la madre ni de sus hermanas.
- Dos ids, uno dentro del otro, no duplican filas ni suman dos veces.
- Elegir la madre en la web y en la app con la misma cuenta y rango da el mismo
  recuento y el mismo total.
- El presupuesto con la madre en el filtro abre su lista con **una** `categoryId`
  y los importes cuadran con la fila del reparto.
- `API.md` describe la rama; `AGENTS.md` y el README recogen el QA switch; el
  criterio de éxito pendiente de `SPEC-busqueda-avanzada` queda cumplido.

## 9. Fuera de alcance

- Roll-up por categoría en `GET /budgets/{id}/allocations`: hoy sus importes por
  fila no aplican el filtro del presupuesto (el desglose sí). Es una
  inconsistencia distinta; se decide en su propia rebanada.
- Informe por categoría con jerarquía (filas de madre sumando hijas).
- FTS, búsquedas guardadas, filtros por adjuntos.
- Cambios en la app Android o en el formato de `Criterion`.

## 10. Preguntas abiertas (resueltas en la implementación)

1. La seña «incluye subcategorías» va como línea corta bajo el selector, en
   Transacciones y en el filtro del presupuesto.
2. `/budgets/{id}/allocations` queda para su rebanada; no se toca aquí.
3. La expansión se hace en Kotlin sobre `queryCategories()`; el SQL sigue plano.
