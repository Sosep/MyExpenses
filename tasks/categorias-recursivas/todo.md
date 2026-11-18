# Tareas: categorias-recursivas — V1

Plan: `tasks/categorias-recursivas/plan.md`
Spec: `SPEC-categorias-recursivas.md`

- [x] **1.1 Helper puro de la rama y tests JVM**
  - Acepta: una madre trae toda su descendencia; una hija no trae madre ni
    hermanas; una hoja se queda sola; dos ramas se unen sin duplicados; un id
    desconocido se conserva; selección vacía devuelve vacío.
  - Verifica: `:webui:testDebugUnitTest` → `CategoryBranchTest` (7 casos).
  - Ficheros: `ApiQueries.kt`, `CategoryBranchTest.kt`

- [x] **1.2 Expandir en la lista de transacciones**
  - Acepta: un `categoryId` con hijas devuelve la rama, divididas incluidas, y
    el `total` cuenta el subárbol; sin `categoryId` no se consulta el árbol y
    la selección queda igual.
  - Verifica: `:webui:testDebugUnitTest` y `:webui:ktlintCheck` en verde.
  - Ficheros: `AndroidWebApiDataSource.kt`

- [x] **1.3 Mock con la misma regla**
  - Acepta: `categoryId=1` trae Food y sus hijas; `categoryId=6` trae Home,
    Utilities y Household; `categoryId=9` trae las divididas con una parte en
    Treats; una hoja no crece.
  - Verifica: `curl` con sesión del mock: Food 30, Home 16, Treats 4 (solo
    divididas), Groceries 15. Con `MOCK_QA_SEED=1`, Food 48 y Treats 4.
  - Ficheros: `dev/mock-server.mjs`

- [x] **1.4 SPA: una sola id en el drill-down y la seña**
  - Acepta: la fila Food del detalle abre
    `?view=transactions&...&categoryId=1` con un único chip «Food»; el selector
    de categorías de Transacciones y del filtro del presupuesto dice «Incluye
    subcategorías».
  - Verifica: mock a 1440×900 (riel lateral) y panel estrecho (barra inferior):
    sin errores de consola, enlaces correctos.
  - Ficheros: `BudgetDetailPanel.tsx`, `Transactions.tsx`,
    `BudgetFilterFields.tsx`

- [x] **1.5 i18n y assets**
  - Acepta: `Includes subcategories` en `en` y `es`; assets regenerados.
  - Verifica: `npm run i18n:extract`; `npm test` (40 en verde);
    `npm run build`.
  - Ficheros: `en/messages.po`, `es/messages.po`,
    `webui/src/main/assets/webapp/**`

- [x] **1.6 Docs**
  - Acepta: `API.md` describe la rama; `AGENTS.md` la recoge en el estado actual
    y en el QA switch; el README documenta `?categoryId=1`; la spec queda
    implementada y la nota antigua de `SPEC-busqueda-avanzada.md` apunta a esta.
  - Verifica: lectura de los cuatro ficheros.
  - Ficheros: `webui/API.md`, `AGENTS.md`, `webui/webapp/README.md`,
    `SPEC-categorias-recursivas.md`, `SPEC-busqueda-avanzada.md`

- [ ] **1.7 QA en dispositivo**
  - Acepta: con una madre con hijas y una dividida, la lista del teléfono da el
    mismo recuento y total que la app; el presupuesto con la madre en el filtro
    cuadra con su drill-down (una sola `categoryId`).
  - Verifica: APK universal de release en el móvil; el SQL y el provider no
    corren en JVM.
  - Ficheros: ninguno (QA)
