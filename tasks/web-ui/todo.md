# Tasks: My Expenses Web UI — V1

Plan: [`plan.md`](./plan.md)
Specs: [`SPEC-web-ui-v1.md`](../../SPEC-web-ui-v1.md) y los cuatro `SPEC-web-ui-*.md`

Los tres primeros módulos se hacen en un worktree y se rebasan cuando el otro agente
commitee. Ningún módulo toca Kotlin, `API.md` ni el keystore.

## Módulo 0 — Herramientas de test

- [x] **T0 — Vitest + jsdom + axe-core**
  - Acceptance: `npm test` ejecuta Vitest con entorno jsdom; existe al menos un test de
    `format` que pasa; `npm test` falla si un test falla; no se toca `webui/src/main/assets`.
  - Verify: `npm test`; `npm run build` sigue funcionando.
  - Files: `webui/webapp/package.json`, `webui/webapp/vite.config.ts`,
    `webui/webapp/src/test/setup.ts`, `webui/webapp/src/format.test.ts`

## Módulo `web-ui-defects`

- [x] **T1 — Gráfica a prueba de huecos**
  - Acceptance: con los fixtures actuales las 12 columnas muestran barra de ingreso y de
    gasto con altura > 0; un grupo con `expensesMinor` ausente no vacía la gráfica; el estado
    vacío solo aparece si todo es 0. `expenses` e `incomes` del mock tienen la misma longitud.
  - Verify: `npm test -- Chart`; mock a 1440 con la gráfica visible.
  - Files: `src/components/Chart.tsx`, `src/components/Chart.test.tsx`, `dev/mock-server.mjs`

- [x] **T2 — Topbar que no desborda**
  - Acceptance: a 360 y 390 `scrollWidth === clientWidth`; el botón de cerrar sesión se ve
    entero; la marca ocupa una línea.
  - Verify: `?metrics=1` a 360 y 390; inspector sobre `.topbar`.
  - Files: `src/styles/app.css`, `src/components/Shell.tsx`

- [x] **T3 — Copy traducido y errores con código**
  - Acceptance: ninguna cadena en inglés en las siete pantallas con `?locale=es`; `ApiError`
    transporta un `code` y la UI lo traduce; `npm run i18n:compile` pasa en estricto.
  - Verify: recorrido con `?locale=es`; `npm run i18n:compile`; búsqueda de literales JSX.
  - Files: `src/components/TransactionPanel.tsx`, `src/components/Reports.tsx`,
    `src/components/Transactions.tsx`, `src/api.ts`, `src/locales/{en,es}/messages.po`

- [x] **T4 — QA switches fiables y theme-color**
  - Acceptance: `?theme=dark` cambia el tema con `es` y con `en`; `?panel=split` y
    `?panel=transfer` abren el panel correcto; `theme-color` sigue al tema; ambos switches
    documentados.
  - Verify: los cuatro casos contra el mock; diff de `README.md` y `AGENTS.md`.
  - Files: `dev/mock-server.mjs`, `index.html`, `README.md`, `AGENTS.md`

## Módulo `web-ui-a11y`

- [x] **T5 — Foco, contraste y altura táctil**
  - Acceptance: `--focus-ring` sólido con ≥3:1 sobre las cuatro superficies; cabeceras y chips
    ≥4.5:1 en claro; `.tag` con borde en oscuro; `--control-h` 36/44 según `pointer`; botones,
    campos, iconos y segmentados lo consumen; `DESIGN.md` §11 pasa a 44 y §4.1 documenta el foco.
  - Verify: contraste calculado y anotado en el PR; emulación táctil en DevTools; captura dark.
  - Files: `src/styles/tokens.css`, `src/styles/app.css`, `webui/DESIGN.md`

- [x] **T6 — Foco atrapado y devuelto**
  - Acceptance: con un panel abierto, `Tab` no alcanza `header`/`main`/`nav`; `Esc` cierra y
    devuelve el foco al disparador; la fila de tabla enfocada lleva inset de 2 px en `--accent`.
  - Verify: recorrido de teclado en detalle, editor simple, dividida y presupuesto.
  - Files: `src/components/TransactionPanel.tsx`, `src/components/TransactionEditor.tsx`,
    `src/components/BudgetEditor.tsx`, `src/components/ReportPanel.tsx`, `src/styles/app.css`

- [x] **T7 — axe en las pantallas clave**
  - Acceptance: Login, Shell y el panel de detalle montados con fixtures no arrojan
    violaciones *serious* ni *critical*; el test corre dentro de `npm test`.
  - Verify: `npm test`.
  - Files: `src/test/a11y.test.tsx`

## Módulo `web-ui-density`

- [x] **T8 — Topbar de una línea, chips de contexto y crumb fuera**
  - Acceptance: a 390 el topbar es `Σ` + nombre de la vista + `⋯`; cuenta e idioma viven en un
    menú; cuenta y mes aparecen como chips en el contenido; el crumb desaparece.
  - Verify: mock 390 y 1440; `?metrics=1`; navegación a las cinco vistas.
  - Files: `src/components/Shell.tsx`, `src/styles/app.css`

- [x] **T9 — Resumen 2×2**
  - Acceptance: a 390 los KPIs ocupan ≤220 px y el hero va a ancho completo; a 1440 se mantiene
    hero + tres tarjetas.
  - Verify: `?metrics=1` 390 y 1440.
  - Files: `src/components/Dashboard.tsx`, `src/styles/app.css`

- [x] **T10 — Transacciones: filtros plegados y CTA flotante**
  - Acceptance: a 390 la primera fila empieza en y ≤ 380; los filtros se abren tras un botón
    con contador; el alta es un botón flotante sobre la barra inferior; a 1440 no cambia.
  - Verify: `?metrics=1`; inspector sobre la primera fila.
  - Files: `src/components/Transactions.tsx`, `src/styles/app.css`

- [x] **T11 — Informes: toolbar y KPIs compactas**
  - Acceptance: a 390 la tarjeta de desglose empieza en y ≤ 700; los controles caben en dos
    filas; a 1440 se separan por divisores y la cuarta KPI lleva `--tint-sky`.
  - Verify: `?metrics=1` 390 y 1440; captura en ambos temas.
  - Files: `src/components/Reports.tsx`, `src/styles/app.css`

- [x] **T12 — Presupuestos: pie de tarjeta y barra de resumen**
  - Acceptance: el pie cabe en una línea con dos acciones de 44 px; el resumen muestra
    porcentaje y relleno semántico; el periodo sigue visible en cada tarjeta.
  - Verify: mock 390 y 1440; un presupuesto excedido del fixture.
  - Files: `src/components/Budgets.tsx`, `src/styles/app.css`

- [x] **T13 — Ficheros y anchos de escritorio**
  - Acceptance: en móvil el nombre muestra la extensión (dos líneas o truncado por el centro);
    a 1440 la tabla no supera ~760 px de ancho útil.
  - Verify: mock 390 y 1440.
  - Files: `src/components/Files.tsx`, `src/styles/app.css`

- [x] **T14 — Escala tipográfica a 14 px**
  - Acceptance: no queda ninguna regla con `font-size` de 13, 15 o 17 px; el cuerpo mide 14;
    las filas de tabla siguen a 44 px; nada desborda a 390.
  - Verify: `grep` de `font-size`; mock 390 y 1440; capturas antes/después.
  - Files: `src/styles/app.css`, `webui/DESIGN.md`

## Módulo `web-ui-features` (después del otro agente)

- [x] **T15 — Filtros de transacciones (F1)**
  - Acceptance: chips de filtro activo con quitar y limpiar todo; filtros en la URL; estado
    vacío que nombra la causa; `↑`/`↓` desplazan la opción resaltada.
  - Verify: `?view=transactions&filter=groceries` y un `filter=none`; recarga con la URL.
  - Files: `src/components/Transactions.tsx`, `src/components/SearchSelect.tsx`,
    `src/styles/app.css`, `dev/mock-server.mjs`, `README.md`

- [x] **T16 — Presupuestos por periodo (F2)**
  - Acceptance: “›” no pasa del mes actual; “‹” se detiene en el primero; el resumen solo
    aparece con divisa y periodo comunes; el pie es de una línea.
  - Verify: `?view=budgets&budgetMonth=-1` y `+1`; presupuesto excedido.
  - Files: `src/components/Budgets.tsx`, `dev/mock-server.mjs`

- [x] **T17 — Gráficos de presupuesto (F3)**
  - Acceptance: histórico con color y texto por estado; barras por categoría con importe
    gastado/asignado; pista visible en ambos temas; el panel se abre con teclado y cierra con
    `Esc`.
  - Verify: `?view=budgets&history=1` con un mes excedido; captura dark.
  - Files: `src/components/BudgetHistoryPanel.tsx`, `src/components/Budgets.tsx`,
    `src/styles/app.css`

- [x] **T18 — Divisas mixtas (F4)**
  - Acceptance: un solo total en la divisa base, formateado con `data.currency`/
    `data.fractionDigits` (hoy usa `account.currency`, `Reports.tsx:256`); sin subtotales por
    divisa; el drill-down sigue desactivado con `All accounts`.
  - Verify: fixture con dos divisas; mismo total que la app Android para el mismo periodo.
  - Files: `src/components/Reports.tsx`, `dev/mock-server.mjs`

## Notas de cierre (2026-11-17)

- T0–T18 hechos en la rama `web-ui-defects`, en commits por módulo.
- T16: “‹” queda libre porque el API no expone el primer periodo con presupuesto; el
  criterio se ajustó en `SPEC-web-ui-features.md` (lo aprobado era “se detiene antes del
  primer presupuesto”).
- T8 y T11 se ajustaron al medir: la cuenta se queda en el topbar (el menú `⋯` lleva idioma,
  tema y sesión) y los controles de Informes quedan en tres filas, no dos.
- Pendiente: revisión visual en dispositivo real (en esta sesión el panel del navegador dejó
  de dibujarse y bloquea capturas y clics) y cerrar la pregunta de si `AGENTS.md` debe
  listar los filtros en la URL (ya documentado en README).


## Módulo Tailwind (migración por capas)

- [x] **Primitivas**: `btn`, `input`, `card`, `table`, `segmented`, `kpi`, campos y cabeceras de tarjeta como `@apply` sobre tokens; paridad medida contra el build anterior.
- [x] **Layout compartido**: `page-head`, `kpis`, `hero`, `filter-bar`, `summary-strip`, `month-nav`, `overlay`, `panel` y `load-more`.
- [x] **Login**: contenedor, tarjeta, marca, formulario y botón con utilidades; paridad exacta (380×367 a 1440).
- [x] **Ficheros**: tarjeta de 760 px, acción compacta y nombre envuelto en móvil con utilidades; paridad exacta.
- [x] Resto de pantallas: Shell, Dashboard/chart, Transacciones/filtros, Informes, Presupuestos, editores, paneles y PWA migrados a `@apply`; paridad computada en 20 rutas × desktop/móvil, claro/oscuro.
- Verificación por pantalla: 1440×900 y 390×844, claro/oscuro, `npm test`, `npm run build` e `i18n:compile --strict`.
