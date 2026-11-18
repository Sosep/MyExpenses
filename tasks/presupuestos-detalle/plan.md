# Plan: presupuestos-detalle — V1

Spec: [`SPEC-presupuestos-detalle.md`](../../SPEC-presupuestos-detalle.md) (aprobado 18-nov-2026).
Dos rebanadas, en este orden; la 1 es publicable sin la 2.

## Rebanada 1 — contrato y panel

Dependencias internas: 1.1 y 1.2 son independientes; 1.3 y 1.4 comparten la
noción de "gasto del presupuesto"; 1.5 consume 1.4; 1.6 y 1.7 cierran.

| # | Pieza | Por qué antes |
|---|---|---|
| 1.1 | Validación de `second` por agrupación (0 permitido, rango acotado) | 1.5 navega meses y enero rompe hoy |
| 1.2 | `budgetHistory` 0-based, serie hasta el mes actual | 1.5 pinta el historial |
| 1.3 | Gasto del presupuesto por partes de divididas | 1.4 y la tarjeta deben dar el mismo número |
| 1.4 | `GET /budgets/{id}/breakdown` | contrato que consume 1.5 |
| 1.5 | `BudgetDetailPanel` y botón `Detalle` | UI |
| 1.6 | Mock y switches | QA visual de 1.5 |
| 1.7 | Docs + build de la SPA | cierre |

Puntos delicados:

- **Base de índices**: `MONTH` es 0-11; `WEEK` y `DAY` son 1-based
  (`Grouping.minValue`, `DatabaseConstants.WEEK`/`DAY`). La documentación decía
  0-6 y 0-365: se corrige con el código.
- **Coherencia de cifras**: tarjeta (`progress.spentMinor`), cabecera y filas
  del panel (`totalSpentMinor` y `categories[].spentMinor`) salen de consultas
  distintas; deben recorrer el mismo conjunto de filas (misma selección y
  `splitStrategy=PARTS`). Si divergen, es un fallo.
- **Jerarquía**: el servidor devuelve las categorías del filtro **y sus
  descendientes**; los padres agregan a sus hijas y el total suma solo hojas.
- **Rendimiento**: una llamada a `/breakdown` por panel abierto (no por
  tarjeta). La lista sigue con una llamada de progreso por presupuesto.

## Rebanada 2 — criterios

| # | Pieza | Depende de |
|---|---|---|
| 2.1 | `criteria` en `BudgetDto`/`BudgetWriteDto` + validación de ids | 1.4 (el panel ya muestra el filtro) |
| 2.2 | Persistencia en DataStore (`budgetFilter_<id>`) y ciclo de vida | 2.1 |
| 2.3 | Editor: sección `Filtro`; resumen en el panel | 2.2 |
| 2.4 | Mock y docs | 2.3 |

Puntos delicados:

- La preferencia es **de la app**: clave y JSON idénticos a `FilterPersistence`.
  Si el valor guardado no es representable, no se escribe y se avisa
  (`criteriaUnsupported`).
- Alta + persistencia del filtro: si la persistencia falla, se deshace el alta.
- Duplicado y borrado tocan la preferencia del id nuevo/borrado.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El número del presupuesto cambia en la app y el widget (por partes) | Probarlo con una dividida real; anotarlo en `AGENTS.md` |
| Escribir mal la preferencia deja la app sin filtro | Round-trip en dispositivo; no pisar criterios compuestos; validar el JSON con `Criterion` |
| Divergencia tarjeta/panel | Una sola fuente por cifra y test de invariantes |
| El provider no corre en JVM | Pruebas SQL en dispositivo, checklist en `AGENTS.md` |
| Docs y assets desincronizados | 1.7 y 2.4 en el mismo commit de su rebanada |

## Checkpoints

1. Tras 1.1-1.2: `:webui:testDebugUnitTest` en verde y enero/historial probados
   contra el móvil.
2. Tras 1.4: tests del contrato; `curl` de los tres casos (dentro/fuera/enero).
3. Tras 1.5-1.6: `npm test`, `npm run build`, QA visual 1440×900 y 390×844.
4. Tras 2.2: ciclo en dispositivo (crear → app → editar → duplicar → borrar).
5. Cierre: `ktlintCheck` (+ baseline si toca), docs y `AGENTS.md`.

## Commits previstos

1. `fix(webui): mes 0-based en progreso e historial de presupuestos`
2. `feat(webui): gasto del presupuesto por partes de divididas`
3. `feat(webui): reparto por categoría del presupuesto`
4. `feat(webapp): panel de detalle del presupuesto`
5. `feat(webui): criterios del presupuesto por HTTP`
6. `feat(webapp): edición del filtro del presupuesto`
7. `docs(webui): contrato, diseño y QA de presupuestos`
