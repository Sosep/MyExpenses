# Tasks: Transacciones como la app Android — V1

Plan: [`plan.md`](./plan.md)
Specs: [`SPEC-transacciones-v1.md`](../../SPEC-transacciones-v1.md),
[`SPEC-agrupacion-rango.md`](../../SPEC-agrupacion-rango.md),
[`SPEC-busqueda-avanzada.md`](../../SPEC-busqueda-avanzada.md)

## Módulo `agrupacion-rango`

- [x] **T1 — Periodos en la API**
  - Acceptance: `GroupDto` incluye `periodStart` y `periodEnd` (ISO) para
    `DAY/WEEK/MONTH/YEAR`, calculados con las reglas de la app (`Grouping`,
    inicio de semana y de mes de `DatabaseConstants`); `NONE` devuelve un único
    grupo sin fechas o con el rango completo.
  - Verify: `ApiRoutesTest` con `MONTH` y `WEEK`; `WebQueryReproTest` comprobando
    que un domingo cae en la semana que toca.
  - Files: `ApiDtos.kt`, `ApiQueries.kt`, `ApiRoutesTest.kt`,
    `WebQueryReproTest.kt`, `API.md`

- [x] **T2 — Estado de la lista: agrupación y rango en la URL**
  - Acceptance: `grouping` (`NONE/DAY/WEEK/MONTH/YEAR`, por defecto `MONTH`) y
    rango (`preset=todo|mes|3m|año` o `from`/`to`) viven en la URL; se recuerdan
    en `localStorage`; `month` deja de usarse; los filtros actuales siguen
    leyéndose.
  - Verify: tests de serialización; abrir enlaces antiguos y nuevos.
  - Files: `TransactionState` en `src/filters.ts`, `Transactions.tsx`

- [x] **T3 — Lista agrupada con cabeceras y resumen**
  - Acceptance: cada periodo se abre con título, ingresos, gastos,
    transferencias (si ≠ 0) y nº de movimientos; plegable; los importes vienen de
    `/reports/grouped` del rango activo, no de las filas cargadas.
  - Verify: con el mock (varios meses) los subtotales cuadran con `grouped`;
    plegar/desplegar no recarga la lista.
  - Files: `Transactions.tsx`, nuevo `TransactionGroups.tsx`, `src/api.ts`,
    `app.css`, `DESIGN.md`

- [x] **T4 — Fuera la tira de KPIs y «cargar más» dentro de grupos**
  - Acceptance: no queda tira global; «cargar más» añade la siguiente página y
    los grupos se rellenan sin duplicar cabeceras ni filas; estados vacío,
    cargando y error con los textos actuales.
  - Verify: mock con >100 movimientos; scroll y carga repetida.
  - Files: `Transactions.tsx`, `TransactionGroups.tsx`

- [x] **T5 — Docs, mock y QA**
  - Acceptance: `API.md` (periodStart/End), `DESIGN.md` (cabecera de grupo y
    selector), `README` (switches `grouping`, `preset`), `AGENTS.md`; el mock
    sirve varios meses y respeta `grouping`.
  - Verify: `npm run mock` en 1440×900 y 390×844; móvil real con 6 meses.
  - Files: `API.md`, `DESIGN.md`, `README.md`, `AGENTS.md`,
    `dev/mock-server.mjs`

## Módulo `busqueda-avanzada`

- [x] **T6 — Parámetros nuevos y múltiples**
  - Acceptance: `q`, `amountMin`, `amountMax`, `status`, `transfer` y valores
    repetidos en `categoryId/payeeId/tagId/methodId`; OR dentro de la dimensión,
    AND entre dimensiones; validación con mensajes claros; los enlaces de hoy
    siguen funcionando.
  - Verify: `ApiRoutesTest` por parámetro y una combinación de tres.
  - Files: `ApiRoutes.kt`, `ApiQueries.kt`, `ApiRoutesTest.kt`, `API.md`

- [x] **T7 — SQL de los criterios**
  - Acceptance: texto sin distinguir mayúsculas ni acentos en comentario,
    beneficiario y referencia; importe sobre valor absoluto con signo; categoría
    padre incluye hijas; etiqueta cualquiera de las elegidas; estado y
    transferencias.
  - Verify: casos nuevos en `WebQueryReproTest` (SQLite real).
  - Files: `ApiQueries.kt`, `WebQueryReproTest.kt`

- [x] **T8 — Panel de búsqueda y chips**
  - Acceptance: hoja con los criterios (fechas con presets, importe, tipo,
    estado, y selección múltiple de categorías/beneficiarios/etiquetas/métodos);
    cada criterio activo es un chip con «×»; «Quitar filtros»; estado en la URL.
  - Verify: tests de URL ↔ criterios; manual en 1440 y 390.
  - Files: nuevo `SearchPanel.tsx`, `MultiSearchSelect.tsx`, `filters.ts`,
    `Transactions.tsx`, `app.css`, `DESIGN.md`

- [x] **T9 — Docs, mock y QA de búsqueda**
  - Acceptance: `README` documenta los criterios y el mock los soporta (texto,
    importe, estado, múltiples); `API.md` con la tabla de parámetros.
  - Verify: `npm test`, `i18n:compile`, mock y móvil real.
  - Files: `README.md`, `API.md`, `dev/mock-server.mjs`, `AGENTS.md`

## Notas de implementación

- **Periodos**: en vez de calcular `periodStart`/`periodEnd`, la API devuelve
  `firstDate` (primera transacción del periodo). Con grupos ordenados y
  disjuntos, el cliente asigna cada fila al último grupo cuyo `firstDate` no sea
  posterior: no reimplementa inicios de mes ni de semana. El provider solo
  proyecta la columna cuando se le pide (`firstDate=1`), así no cambia la
  proyección posicional de la app.
- **Agrupación**: el resumen vive en cada cabecera (ingresos, gastos y
  transferencias distintas de cero); la tira global desapareció.
- **Búsqueda**: los ids múltiples son OR dentro de la dimensión y AND entre
  dimensiones; el texto usa `LIKE` (acentos pendientes de FTS) y las categorías
  son por id exacto (hijas pendientes de que el API exponga el árbol).
