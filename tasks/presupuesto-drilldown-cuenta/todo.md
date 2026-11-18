# Tareas: presupuesto-drilldown-cuenta — V1

Plan: `tasks/presupuesto-drilldown-cuenta/plan.md`
Spec: `SPEC-presupuesto-drilldown-cuenta.md`

- [x] **1.1 Helpers puros y tests**
  - Acepta: `budgetDrilldownSearch` devuelve `view`, `preset=custom`, `from`,
    `to`, `accountId`, la categoría (o `uncategorized=true`) y los criterios;
    `accountFromUrl` lee un id válido e ignora vacío/0/no numérico;
    `searchWithAccount` escribe y quita sin perder `view`, filtros ni rango.
  - Verifica: `npm test` (2 ficheros nuevos en verde).
  - Ficheros: `src/navigation.ts`, `src/budgetUi.ts`, `src/navigation.test.ts`,
    `src/budgetUi.test.ts`

- [x] **1.2 La cuenta en la URL desde `App`**
  - Acepta: al arrancar gana `?accountId=` a `localStorage`; `navigate` y
    `popstate` la aplican; al cambiar de cuenta con el selector la URL se
    reescribe con `replaceState` (sin entrada nueva).
  - Verifica: mock, cambiar de cuenta en Transacciones y recargar.
  - Ficheros: `src/App.tsx`

- [x] **1.3 El enlace del panel lleva la cuenta**
  - Acepta: pulsar una fila abre Transacciones en la cuenta del presupuesto
    (`breakdown.accountId`), con el mismo rango, rama y criterios de antes.
  - Verifica: mock `?view=budgets&detail=3` (Fuel, Joint) con la app en Everyday.
  - Ficheros: `src/components/BudgetDetailPanel.tsx`

- [x] **1.4 Mock: abrir el detalle de un presupuesto por id**
  - Acepta: `?view=budgets&detail=3` abre Fuel; `detail=1` sigue abriendo el
    primero; `history=1` no cambia.
  - Verifica: `npm run mock` y el enlace de arriba.
  - Ficheros: `dev/mock-server.mjs`, `src/components/Budgets.tsx`

- [x] **1.5 Build y catálogos**
  - Acepta: sin textos nuevos; `npm run build` regenera `assets` y los deja
    commiteables.
  - Verifica: `npm test`, `npm run build`.
  - Ficheros: `webui/src/main/assets/webapp/**`

- [x] **1.6 Documentación**
  - Acepta: AGENTS.md (Current state y QA switches), README (fila del switch),
    spec con `Status: implementado`.
  - Verifica: lectura y `git diff --stat`.
  - Ficheros: `AGENTS.md`, `webui/webapp/README.md`,
    `SPEC-presupuesto-drilldown-cuenta.md`

- [x] **1.7 Commit y merge**
  - Acepta: commit convencional `fix(webapp): …` y `fork-master` con el fix.
  - Verifica: `git log --oneline` y árbol limpio.
  - Ficheros: —
