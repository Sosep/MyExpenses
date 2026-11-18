# Tareas: presupuestos-detalle — V1

Plan: `tasks/presupuestos-detalle/plan.md`
Spec: `SPEC-presupuestos-detalle.md`

## Rebanada 1 — contrato y panel

- [x] **1.1 Validar `second` por agrupación y permitir 0**
  - Acepta: `?year=2026&second=0` → 200; `second=12` y `second=-1` en `MONTH`
    → 400 `invalid_period`; un solo parámetro → 400; `/allocations` usa la misma
    regla.
  - Verifica: `docker compose run --rm android-build :webui:testDebugUnitTest`
  - Ficheros: `ApiRoutes.kt`, `ApiRoutesTest.kt`, `API.md`

- [x] **1.2 Historial 0-based y serie hasta el mes actual**
  - Acepta: `history?months=12` → 12 puntos ordenados, el último es el mes
    actual con su `second` real (noviembre = 10); `months=24` no da 500.
  - Verifica: `curl` contra el móvil (el datasource Android no corre en JVM).
  - Ficheros: `AndroidWebApiDataSource.kt` (`budgetHistory`), `API.md`

- [x] **1.3 Gasto del presupuesto por partes de divididas**
  - Acepta: `sumLoaderForBudget` pide `splitStrategy=PARTS`; la tarjeta cuenta
    la suma de las partes; una parte fuera del filtro no cuenta; el padre nunca
    se suma.
  - Verifica: dispositivo con una dividida real (10+20 dentro → 30; 10 dentro y
    20 fuera → 10), nota en `AGENTS.md`.
  - Ficheros: `RepositoryBudget.kt`

- [x] **1.4 `GET /budgets/{id}/breakdown`**
  - Acepta: contrato de §3.1 (solo categorías del filtro y sus hijas, padres
    agregados, `totalSpentMinor` = suma de hojas), 404/400, `NONE` sin
    `year`/`second`.
  - Verifica: `ApiRoutesTest` + `curl` (normal, `NONE`, enero, 404).
  - Ficheros: `ApiRoutes.kt`, `ApiDtos.kt`, `AndroidWebApiDataSource.kt`,
    `ApiQueries.kt`, `API.md`, `ApiRoutesTest.kt`

- [x] **1.5 Panel de detalle en la SPA**
  - Acepta: `Detalle` abre el panel con progreso, gasto por categoría (solo con
    gasto, sin nota, con jerarquía), importe del periodo con su origen,
    historial de 12 meses, pie `Editar`/`Cerrar`; `Historial` desaparece;
    estados de carga/error/vacío; `Esc` y foco.
  - Verifica: `cd webui/webapp && npm test` y QA visual en el mock.
  - Ficheros: `api.ts`, `types.ts`, `BudgetDetailPanel.tsx`, `Budgets.tsx`,
    `BudgetHistoryPanel.tsx` (se elimina), `messages.po`, `app.css`, `DESIGN.md`

- [x] **1.6 Mock y switches**
  - Acepta: `/breakdown` con fixtures coherentes, historial 0-11, enero
    aceptado, `?view=budgets&detail=1` abre el panel.
  - Verifica: `npm run mock` + test de forma.
  - Ficheros: `dev/mock-server.mjs`, `README.md`, `AGENTS.md`

- [x] **1.7 Docs y build de la SPA**
  - Acepta: `API.md`, `DESIGN.md`, `README.md` y `AGENTS.md` describen lo que
    hay; assets regenerados y commiteados.
  - Verifica: `npm run build` y revisar el diff de assets.
  - Ficheros: docs + `webui/src/main/assets/webapp`

## Rebanada 2 — criterios

- [x] **2.1 `criteria` en los DTO y validación**
  - Acepta: lectura y escritura de `categoryIds`, `payeeIds`, `methodIds`,
    `tagIds`, `statuses`; vacío = toda la cuenta; ids o estados inválidos → 422
    con `fields`; `criteriaUnsupported` si el criterio guardado no se puede
    representar.
  - Verifica: `ApiRoutesTest` con el datasource falso.
  - Ficheros: `ApiDtos.kt`, `API.md`, `ApiRoutesTest.kt`

- [x] **2.2 Persistencia del filtro**
  - Acepta: escribe y lee `budgetFilter_<id>` con el JSON de `Criterion`; alta
    deshecha si falla la escritura; edición sin `criteria` conserva; duplicado
    hereda; borrado limpia (también la clave legacy).
  - Verifica: dispositivo (web → app Android → editar → duplicar → borrar).
  - Ficheros: `AndroidWebApiDataSource.kt`, `AGENTS.md`

- [x] **2.3 Editor con filtro**
  - Acepta: sección `Filtro` con cinco selectores y resumen `Sin filtro`/`n
    filtros`; el panel muestra `Filtro: …`.
  - Verifica: `npm test`, QA visual y ciclo en dispositivo.
  - Ficheros: `BudgetEditor.tsx`, `BudgetFilterFields.tsx`,
    `BudgetDetailPanel.tsx`, `messages.po`

- [x] **2.4 Mock y docs de criterios**
  - Acepta: fixtures con `criteria`, alta/edición lo aceptan y devuelven; docs
    al día.
  - Verifica: `npm run mock` + test de forma.
  - Ficheros: `dev/mock-server.mjs`, docs

## Cierre

- [ ] `ktlintCheck` en verde (baseline refrescada si toca).
- [ ] `AGENTS.md` **Estado actual** y **Trabajo abierto** al día.
- [ ] Commits por rebanada, assets incluidos, sin `node_modules`.
