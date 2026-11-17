# Tasks: Corrección de hallazgos QA web — V1

Plan: [`plan.md`](./plan.md)
Specs: [`SPEC-web-qa.md`](../../SPEC-web-qa.md) y los cinco `SPEC-*.md` del mapa

Se ejecuta en orden. Cada módulo se commitea con sus docs y sus assets si toca la SPA.

## Módulo `contrato-meses`

- [x] **T1 — Tests rojos de la convención 0-11**
  - Acceptance: `npm test` falla hoy con fixtures de mes 0-11 (noviembre = `10`,
    diciembre = `11`, enero = `0`) y un caso que compara el cursor `YYYY-MM` con el
    `second` del servidor; el fallo es el que se ve en producción (serie a cero).
  - Verify: `cd webui/webapp && npm test` → rojo por esos casos, no por el entorno.
  - Files: `webui/webapp/src/series.test.ts`, `webui/webapp/src/format.test.ts`

- [x] **T2 — `fillSeries` con índice 0-11**
  - Acceptance: el cursor `2026-11` casa con `second = 10`; el relleno de meses
    vacíos publica `second` 0-11; diciembre → enero pasa a `second = 0`.
  - Verify: T1 en verde; test añadido del cruce de año.
  - Files: `webui/webapp/src/series.ts`

- [x] **T3 — Formato de mes: dos helpers y un solo límite**
  - Acceptance: `formatMonth`/`formatMonthShort` reciben 0-11; nuevo
    `formatMonthKey('2026-11')` para lo que la UI guarda como `YYYY-MM`; todos los
    callers tipados compilan sin conversiones sueltas.
  - Verify: `npx tsc --noEmit` (o el `npm run build`) sin errores; tests de
    `format` en verde.
  - Files: `webui/webapp/src/format.ts`, `webui/webapp/src/components/Dashboard.tsx`,
    `Reports.tsx`, `Transactions.tsx`, `Budgets.tsx`, `Chart.tsx`,
    `BudgetHistoryPanel.tsx`

- [x] **T4 — Presupuestos pide el mes correcto**
  - Acceptance: `getBudgetProgress`/`getBudgetAllocations` reciben `monthNumber - 1`;
    la cabecera y el historial etiquetan noviembre como noviembre.
  - Verify: con el mock, `?view=budgets` y `?view=budgets&budgetMonth=-1` muestran
    el mes que corresponde; test de unidad del mapeo.
  - Files: `webui/webapp/src/components/Budgets.tsx`,
    `webui/webapp/src/components/BudgetHistoryPanel.tsx`

- [x] **T5 — Mock alineado con la API**
  - Acceptance: `reports/grouped`, `budgets/{id}`, `.../history` y `.../allocations`
    devuelven `second` 0-11; los switches de QA siguen funcionando; el mes en curso
    de `grouped` coincide con `reports/summary` (la pata de transferencia no cuenta
    como gasto).
  - Verify: `curl` al mock con noviembre devuelve `second: 10`; `npm run mock` y
    las pantallas de T4.
  - Files: `webui/webapp/dev/mock-server.mjs`

- [x] **T6 — Contrato, docs y assets**
  - Acceptance: `ApiRoutesTest` fija que la ruta no desplaza `second` (un grupo con
    `10` sale `10`); `API.md` documenta 0-11 y corrige los ejemplos de
    `periodSecond`/`second`; `README` y `AGENTS.md` lo mencionan; assets
    regenerados.
  - Verify: `:webui:testDebugUnitTest`, `npm run build`, `git status` sin assets a
    medias.
  - Files: `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`,
    `webui/API.md`, `webui/webapp/README.md`, `AGENTS.md`,
    `webui/src/main/assets/webapp/**`

- [ ] **T7 — Verificación en el móvil real**
  - Acceptance: con un movimiento del mes, el dashboard muestra INGRESOS/GASTOS/
    AHORRADO iguales a `/reports/summary` y el gráfico dibuja el mes; un presupuesto
    mensual muestra el gasto del mes y "‹" va al mes anterior correcto.
  - Verify: checklist con `curl` + capturas 1440×900 y 390×844.
  - Files: ninguno (evidencia en el PR)

## Módulo `presupuestos-escritura` + `divididas`

- [ ] **T8 — Diagnóstico único de `cat_id = 0`**
  - Acceptance: con el log del dispositivo se identifica la restricción exacta que
    lanza `SQLiteConstraintException` en el alta de presupuesto y de dividida;
    queda escrito en el PR si es la misma causa.
  - Verify: `POST /budgets` y `POST /split-transactions` reproducen; log con la
    sentencia y la tabla.
  - Files: ninguno (diagnóstico)

- [ ] **T9 — Alta y edición de presupuesto**
  - Acceptance: ciclo crear → asignaciones con rollover → historial → editar →
    borrar → **crear otra vez** termina en 201; `PUT /allocations` devuelve lo
    guardado.
  - Verify: `curl` del ciclo + `ApiRoutesTest` de las rutas.
  - Files: `AndroidWebApiDataSource.kt`, `ApiQueries.kt`, `RepositoryBudget.kt`,
    `ApiRoutesTest.kt`

- [ ] **T10 — Alta de dividida**
  - Acceptance: `POST /split-transactions` con dos partes que suman el padre
    devuelve 201; `PUT` añade/quita partes; el borrado deja el saldo intacto.
  - Verify: `curl` + SPA: crear, reabrir, editar y borrar en el móvil.
  - Files: `AndroidWebApiDataSource.kt` (y provider si el diagnóstico lo pide)

## Módulo `consultas-informes`

- [ ] **T11 — 200 en las cinco rutas**
  - Acceptance: `categoryId`, `tagId`, drill-down por los cuatro `by` y
    `accountId=all` responden 200; la causa raíz corregida, no silenciada.
  - Verify: los cinco `curl` del informe + `ApiRoutesTest` con casos felices.
  - Files: `ApiQueries.kt`, `AndroidWebApiDataSource.kt`, `ApiRoutesTest.kt`,
    `API.md`

## Módulo `endurecimiento`

- [ ] **T12 — gzip y cabeceras**
  - Acceptance: el JS se sirve con `Content-Encoding: gzip`; `/app` y `/api/v1`
    llevan `nosniff`, `Referrer-Policy`, `Permissions-Policy` y CSP que no rompe
    la SPA.
  - Verify: `curl -H 'Accept-Encoding: gzip' -D -`; arranque en el móvil sin
    errores de consola.
  - Files: `WebInputService.kt`, `AGENTS.md`

- [ ] **T13 — Intentos de sesión e importes**
  - Acceptance: 6º fallo en un minuto → `429` con `Retry-After`; importe de 10^15
    unidades menores → `422` en cada endpoint de escritura.
  - Verify: `ApiRoutesTest` para ambos; `curl` contra el móvil.
  - Files: `WebInputService.kt`, `ApiRoutes.kt`, `AndroidWebApiDataSource.kt`,
    `API.md`
