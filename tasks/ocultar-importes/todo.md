# Tasks: ocultar-importes — V1

Plan: `tasks/ocultar-importes/plan.md` · Spec: `SPEC-ocultar-importes.md`

- [x] **T1 — Máscara y contexto**
  - Acceptance: `maskedMoney('EUR')` da `€ ••••`; `AmountsProvider` expone dos
    estados independientes, los persiste en `localStorage` y escribe
    `dataset.hiddenTotals|hiddenTransactions`; `useMoney(scope)` y `<Money>` no
    dejan dígitos en el DOM cuando el scope está tapado.
  - Verify: `npx vitest run src/privacy.test.tsx`.
  - Files: `src/format.ts`, `src/privacy.tsx`, `src/privacy.test.tsx`

- [x] **T2 — Barra superior**
  - Acceptance: dos `icon-btn` con ojo y filas, `aria-pressed` y tooltip en
    escritorio; dos entradas equivalentes en el menú `⋯` a ≤760 px; foco visible.
  - Verify: mock a 1440×900 y 390×844, teclado y lector.
  - Files: `src/components/Icons.tsx`, `src/components/Shell.tsx`, `src/App.tsx`,
    `src/styles/app.css`

- [x] **T3 — Panel y transacciones**
  - Acceptance: totales tapa héroe, KPIs, cabeceras de periodo y tooltip del
    gráfico; transacciones tapa filas, detalle, partes y chip de importe; los
    editores no cambian.
  - Verify: mock con ambos botones en las cuatro combinaciones.
  - Files: `src/components/Dashboard.tsx`, `src/components/Chart.tsx`,
    `src/components/Transactions.tsx`, `src/components/TransactionPanel.tsx`

- [x] **T4 — Informes y presupuestos**
  - Acceptance: totales tapa KPIs, desglose, línea de totales y todo el
    presupuesto; transacciones tapa las filas del drill-down.
  - Verify: mock `?view=reports` y `?view=budgets` con cada botón.
  - Files: `src/components/Reports.tsx`, `src/components/ReportPanel.tsx`,
    `src/components/Budgets.tsx`, `src/components/BudgetDetailPanel.tsx`

- [x] **T5 — Mock, i18n y docs**
  - Acceptance: `?hidden=1|totals|transactions` documentado en la tabla de QA;
    textos nuevos con `msgstr` español; DESIGN/README/AGENTS/spec actualizados.
  - Verify: `npm test`, `npm run build`, `npm run i18n:compile`.
  - Files: `dev/mock-server.mjs`, `src/locales/{en,es}/messages.po`,
    `webui/DESIGN.md`, `webui/webapp/README.md`, `AGENTS.md`,
    `SPEC-ocultar-importes.md`
