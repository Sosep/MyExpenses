# Spec: presupuestos-detalle — ver el reparto de un presupuesto sin editarlo — V1

Status: aprobado (2026-11-18)
Scope: `/budgets*` en la API, los criterios del presupuesto en las preferencias
de la app, la pantalla de presupuestos de la SPA, el mock y las docs. Sin cambios
de esquema. Hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md) y completa
lo abierto en [`SPEC-contrato-meses.md`](./SPEC-contrato-meses.md) y
[`SPEC-presupuestos-escritura.md`](./SPEC-presupuestos-escritura.md).

Dos rebanadas dentro de esta misma pasada, publicables por separado:

1. **Contrato y panel** (§3.1-§3.3): leer un presupuesto en detalle, con las
   correcciones de periodo, historial y divididas. Es prerequisito de la 2.
2. **Criterios** (§3.4): crear y editar desde la web el mismo filtro que la app
   Android, para que un presupuesto creado en la web no acabe midiendo toda la
   cuenta.

## 1. Objetivo

Poder abrir un presupuesto y ver, sin entrar al editor: su progreso del periodo,
**en qué categorías se está yendo el dinero**, el importe que rige ese periodo y
los últimos 12 meses. Hoy esa información no está en ninguna vista de lectura y
el botón `Historial` solo muestra la serie mensual (y en el móvil siempre falla).

Y que un presupuesto creado o editado desde la web pueda limitarse **igual que
en la app Android**: categorías, beneficiarios, métodos, etiquetas y estado.

Usuario: el dueño de los datos, en escritorio y en móvil, revisando el mes en
curso y los anteriores.

## 2. Comportamiento actual (evidencia del QA sobre el móvil, 18-nov-2026)

App 4.1.4, bundle `index-Dp5CajhT.js` (el repo ya compila `index-CfcOVCJO.js`).

| Prueba | Resultado |
|---|---|
| `GET /budgets/18` (2 - Supermercado) | `spentMinor 15123`, `allocatedMinor 36000` |
| `GET /budgets/18/allocations?year=2026&second=10` | 33 categorías, **todas `allocatedMinor: 0`** |
| `GET /budgets/14/allocations` vs `GET /budgets/19/allocations` | **idénticas byte a byte** |
| `GET /budgets/{id}/history` (12) en los 6 presupuestos | **500 `internal_error`** |
| `GET /budgets/{id}/history?months=1` | 200, pero devuelve **diciembre** |
| `GET /budgets/{id}?year=2026&second=0` (enero) | **400** `year and second must be positive` |
| `GET /budgets/{id}?year=2026&second=12` | **500** |
| `periodAllocationMinor` en el progreso | **ausente** en el build del móvil |

Consecuencias para una vista de detalle:

- `spentMinor` por categoría de `/allocations` **no es del presupuesto**: es el
  gasto de la cuenta en el periodo, igual para todos. Usarlo mostraría
  "Alojamiento 852,90 €" dentro del presupuesto "6 - Bus".
- Lo que sí cuadra: el gasto del presupuesto es la suma de las categorías de su
  filtro. "2 - Supermercado" = Supermercado 132,24 € + Útiles 18,99 € = 151,23 €,
  que es exactamente su `spentMinor`. "1 - Gastos Mensuales" = las 12 categorías
  con gasto menos Alojamiento = 415,41 €.
- Ese filtro **no está en la base**: se guarda en preferencias
  (`FilterPersistence(dataStore, prefNameForCriteria(budget.id))`,
  `RepositoryBudget.kt:97-100`), y es lo que aplica `BudgetViewModel2`
  (`BudgetViewModel2.kt:164-201`) para dibujar el árbol de categorías de la app
  Android. La API no lo expone: ninguna ruta devuelve hoy las categorías del
  presupuesto.

### Criterios del presupuesto

- `BudgetWriteDto` (`ApiDtos.kt:255`) no tiene filtro y `createBudget`
  (`AndroidWebApiDataSource.kt:800`) no escribe ninguno: **un presupuesto creado
  desde la web mide toda la cuenta**, mientras los de la app se limitan por
  categorías, beneficiarios, métodos, etiquetas y estado.
- El filtro no está en la base: se guarda en DataStore con la clave
  `budgetFilter_<id>` (`BudgetViewModel.prefNameForCriteria`) como JSON del
  `Criterion` (`FilterPersistence.kt`, kotlinx.serialization). Por eso la web no
  lo ve hoy: no hay columna, ni ruta, ni DTO que lo exponga.
- Consecuencia para el detalle: el reparto de un presupuesto creado en la web
  listaría todas las categorías con gasto. Es la verdad de un presupuesto sin
  filtro, pero no lo que el usuario cree haber creado.

### Causas de los fallos de contrato

- **Historial 500 / un mes por delante:** `AndroidWebApiDataSource.kt:975-987`
  pasa `date.monthValue` (1-12) como `second`, que el provider interpreta 0-11
  (`dateFilterClause` → `month = second`). Noviembre se pide como 11 (diciembre)
  y, cuando la ventana alcanza un mes con `monthValue = 12`, el índice 12 revienta
  la consulta. Con 12 meses eso pasa siempre.
- **Enero 400:** la ruta exige `second >= 1` (`ApiRoutes.kt:208`) mientras la SPA
  manda `monthNumber - 1` (`Budgets.tsx:78`). Enero = 0 es imposible.
- **`second=12` 500:** el rango no se valida; el fallo sale del provider.
- **`periodAllocationMinor` ausente:** el campo existe en `ApiDtos.kt:251` y en
  `API.md`, pero no llegó en la respuesta del móvil (build anterior). El panel
  depende de él para saber si el importe es del periodo o heredado, así que la
  V1 lo fija en el contrato con test.

## 3. Comportamiento nuevo

### 3.1 API

1. `second` es 0-based en `/budgets*`, como ya dice `API.md` §4.5:
   - `second = 0` (enero) → **200**.
   - `second` fuera del rango del `grouping` (`MONTH` 0-11, `WEEK` 0-6,
     `DAY` 0-365, `YEAR` 0-11, `NONE` solo 0) → **400 `invalid_period`**, nunca 500.
   - Un solo parámetro de los dos → **400 `invalid_period`** (igual que hoy).
2. `GET /budgets/{id}/history?months` devuelve `months` periodos mensuales,
   **del más antiguo al actual**, con el actual al final. `budgetHistory` traduce
   a índice 0-based (`monthValue - 1`) y no puede generar índices inválidos.
   `months` se mantiene en 1-24 (`months=0` documentado como 1).
3. **Nueva ruta** `GET /budgets/{id}/breakdown?year&second`:

```json
{
  "budgetId": 18,
  "accountId": 1,
  "title": "2 - Supermercado",
  "currency": "EUR",
  "fractionDigits": 2,
  "grouping": "MONTH",
  "periodYear": 2026,
  "periodSecond": 10,
  "periodDescription": "noviembre de 2026",
  "periodStart": "2026-11-01",
  "periodEnd": "2026-11-30",
  "totalAllocatedMinor": 36000,
  "totalSpentMinor": 15123,
  "categories": [
    {
      "categoryId": 33,
      "label": "Supermercado",
      "level": 2,
      "parentId": 25,
      "allocatedMinor": 0,
      "spentMinor": 13224,
      "rolloverPreviousMinor": 0,
      "rolloverNextMinor": 0
    },
    {
      "categoryId": 169,
      "label": "Utiles",
      "level": 1,
      "parentId": null,
      "allocatedMinor": 0,
      "spentMinor": 1899,
      "rolloverPreviousMinor": 0,
      "rolloverNextMinor": 0
    }
  ]
}
```

   - `categories` son **las del presupuesto y sus descendientes**: las que
     cumplen su filtro guardado más las hijas con gasto, igual que
     `categoryTreeWithSum(..., whereFilter)` en el móvil. Así el detalle hila
     más fino (una hija con gasto se ve) sin salirse de su categoría madre.
     No se reutiliza `/allocations` (devuelve el árbol de la cuenta y el gasto
     de la cuenta).
   - `spentMinor` es el gasto del presupuesto en el periodo, no el de la cuenta.
     En una fila con descendientes es la **suma de la categoría y sus hijas**;
     la hija sigue contando bajo la madre.
   - Invariante: la suma de `spentMinor` de las filas **sin descendientes** =
     `totalSpentMinor`, con las partes de las divididas (§3.3). Los padres son
     agregados y no se suman aparte: el total nunca cuenta dos veces.
   - `allocatedMinor` es la asignación por categoría si existe fila
     (`budget_allocations`), `0` si no. No cambia la semántica de
     `/budgets/{id}/allocations`, que sigue sirviendo al editor con el árbol
     completo.
   - `NONE`: sin `year`/`second`, el periodo son las fechas del presupuesto.
   - 404 `budget_not_found`; 400 `invalid_period`; el resto como `/budgets/{id}`.
4. `BudgetProgressDto.periodAllocationMinor` viaja siempre que haya fila exacta
   del periodo (`null` si se usa una anterior o la de por defecto), y queda
   cubierto por test.

### 3.2 SPA

- El botón `Historial` de cada tarjeta pasa a ser **`Detalle`**
  (`data-action="budget-detail"`); `Editar` no cambia.
- `BudgetDetailPanel` (nuevo, patrón `panel` de `DESIGN.md`, 380-420 px; página
  completa por debajo de 768 px) sustituye a `BudgetHistoryPanel`:

```text
┌ 2 - Supermercado                          ✕ ┐
│ Presupuesto        Presupuesto · Mensual    │
│ noviembre de 2026                           │
│ 151,23 € de 360,00 €        Quedan 208,77 € │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░  42 % usado        │
│ Quedan 13 días                              │
├─────────────────────────────────────────────┤
│ GASTO POR CATEGORÍA                         │
│ Supermercado        132,24 €   ▓▓▓▓▓▓░░ 87% │
│ Utiles               18,99 €   ▓▓░░░░░░ 13% │
│ (si el filtro nombra una madre, ella arriba  │
│  con su total y las hijas debajo, sangradas) │
├─────────────────────────────────────────────┤
│ IMPORTE DEL PERIODO        360,00 €          │
│ Heredado del periodo anterior · por defecto  │
│ 250,00 €                                     │
├─────────────────────────────────────────────┤
│ ÚLTIMOS 12 MESES                            │
│ dic  ▓░░░░░░░░░░   40,00 / 200,00            │
│ …                                            │
├─────────────────────────────────────────────┤
│                            Editar   Cerrar   │
└──────────────────────────────────────────────┘
```

  - Cabecera: título, cuenta · agrupación, periodo, cierre y la línea de filtro
    del presupuesto (§3.4).
  - Progreso: gastado / asignado, restante o exceso, barra, % usado y días
    restantes (se omite si `currentDay` cae fuera del periodo, como hoy).
  - **Gasto por categoría**: una fila **solo** por categoría con gasto en el
    periodo, con sangría por `level` (`parentId`), importe gastado y barra con
    el % del gasto total del presupuesto (`spentMinor / totalSpentMinor`,
    calculado sobre importes del servidor). Las categorías a 0 no aparecen y
    **no se anuncia cuántas quedan fuera**: sin nota, sin contador. Si ninguna
    tiene gasto, no se pinta la sección (ni el rótulo), para no dejar un
    encabezado huérfano.
  - **Jerarquía**: si el filtro nombra una madre, se pinta la madre con su total
    y debajo, con sangría, las hijas con gasto. La cifra de la madre ya incluye
    a las hijas: no se suma dos veces y sirve para ver el peso de la rama
    completa.
  - **Importe del periodo**: el que rige ese mes y de dónde sale — del periodo
    (`periodAllocationMinor`), heredado de uno anterior, o el de por defecto
    (`budget.allocationMinor`). Es lo que hoy no se puede ver en ningún sitio:
    la tarjeta dice 1.200 € y el editor 690 €.
  - **Últimos 12 meses**: la serie del historial con su barra, etiquetas
    `MMM AA` y `Over` cuando corresponda (lo que hoy hace
    `BudgetHistoryPanel`).
  - Pie: `Editar` (abre el editor existente con esta entrada) y `Cerrar`.
  - Estados: carga, error con `Reintentar`, sin historial, sin categorías,
    sobregiro. `Esc` cierra, foco atrapado y devuelto al disparador.
- El mock sirve `/breakdown`, historial en 0-11 y enero; añade
  `?view=budgets&detail=1` (documentado en `README.md` y `AGENTS.md`).

### 3.3 Transacciones divididas y el total

Cómo se guarda una dividida: una fila **padre** con la categoría pseudo
`SPLIT_CATID`, el importe total y `parent_id` nulo, más una fila por **parte**
con su categoría real y `parent_id` apuntando al padre. **La categoría vive en
la parte; el padre no tiene ninguna.**

De ahí el problema, confirmado leyendo el provider (no en el QA, no hay
divididas en los datos del móvil):

- La suma del presupuesto (`sumLoaderForBudget` → `TRANSACTIONS_SUM_URI`) sigue
  la preferencia global `SPLIT_TRANSACTIONS_AS_TOTAL`
  (`BaseTransactionProvider.kt:630`, por defecto **TOTAL**). Con TOTAL la
  consulta agrega **padres** (`WHERE_NOT_SPLIT_PART`, `parent_id IS NULL`), y el
  criterio de categoría se aplica a esas filas: el padre no lleva categoría, no
  casa, y **la dividida desaparece** del gasto del presupuesto sin avisar.
- El árbol por categorías (`categoryTreeWithSum`, `DbConstants.kt:207-215`)
  suma siempre `catid = tree.rowid` sobre la vista completa: solo casan las
  **partes**. El reparto sí ve la dividida.
- Con la preferencia por defecto, tarjeta y detalle dan números distintos y el
  presupuesto se queda corto justo en las divididas. Si el usuario apaga la
  preferencia, las dos cifras coinciden: la diferencia no es del panel, es de la
  suma del presupuesto.

Regla para V1: **los presupuestos agregan siempre por partes (`splitStrategy=PARTS`)**,
porque el presupuesto se define sobre categorías y la categoría está en la parte.
No cambia la preferencia global ni el resto de la app.

1. `sumLoaderForBudget` añade `splitStrategy=PARTS` al URI de la suma
   (`TransactionProvider.QUERY_PARAMETER_SPLIT_STRATEGY`, ya soportado por
   `resolveSplitStrategy`). Una línea, en la capa de dominio.
2. `/breakdown` reutiliza `categoryTreeWithSum` con **la misma selección** que la
   suma (cuenta, fechas, criterios del presupuesto, no anuladas) para que las dos
   consultas recorran el mismo conjunto de filas.
3. Una parte fuera del filtro no suma en las filas ni en el total: un presupuesto
   de "Supermercado" no debe cargarse la parte de "Restaurante" de la misma
   dividida. Si todas las partes entran, la suma coincide con el total del padre,
   que es lo que se espera de una dividida.
4. El padre no se selecciona nunca con PARTS, así que no hay doble conteo.
5. Consecuencia asumida: para quien tenga "divididas como total" activado, el
   gasto del presupuesto cambia en la web **y también en la lista de presupuestos
   y el widget de la app Android** (`loadBudgetProgress` es compartido). Es el
   mismo error allí y el mismo arreglo; se comprueba en dispositivo.
6. Invariantes: (a) suma de filas sin descendientes = `totalSpentMinor`;
   (b) `totalSpentMinor` = `progress.spentMinor` del mismo presupuesto y periodo;
   (c) una dividida de 30 € en 10 + 20 suma 30, ni 60 ni dos veces 30;
   (d) con la parte de 20 fuera del filtro, suma 10.

### 3.4 Criterios del presupuesto (paridad con la app)

#### Contrato

`BudgetDto.criteria` (lectura) y `BudgetWriteDto.criteria` (escritura):

```json
"criteria": {
  "categoryIds": [33, 169],
  "payeeIds": [],
  "methodIds": [],
  "tagIds": [],
  "statuses": ["CLEARED"]
}
```

- AND entre dimensiones, OR dentro de cada lista, igual que los filtros de
  Transacciones. Lista vacía o campo ausente = sin restricción en esa dimensión;
  todo vacío o `criteria: null` = toda la cuenta (lo que hoy hace la web).
- `statuses` usa `CrStatus`: `UNRECONCILED`, `CLEARED`, `RECONCILED`, `VOID`.
- Las cuentas quedan fuera: el chip de cuentas está oculto en la app
  (`one_budget.xml:152-157`), así que la web tampoco lo ofrece.
- Ids inexistentes o estado desconocido → 422 `validation_failed` con `fields`.

#### Persistencia

El filtro no va a una columna: se guarda en DataStore con la clave
`budgetFilter_<id>` como JSON del `Criterion`, que es exactamente lo que lee la
app Android. La web escribe y lee ese mismo valor, así que el filtro creado en la
web aparece en el móvil sin tocar la app.

- **Leer:** `FilterPersistence(dataStore, "budgetFilter_<id>")` y mapa a DTO. Si
  el valor guardado no es representable (criterio compuesto `Or`/`Not`, o una
  dimensión que la web no ofrece), se devuelve `criteria: null` +
  `criteriaUnsupported: true` y el editor no guarda: nunca se pisa a ciegas.
- **Escribir:** `AndCriterion` de `SimpleCriterion` por dimensión; `criteria`
  vacío borra la clave.
- **Crear:** se persiste tras el alta; si falla, se borra el presupuesto recién
  creado y se responde 500 `save_failed` (no quedan presupuestos a medias).
- **Editar:** `criteria` presente reemplaza; ausente o nulo conserva (como
  `description`); un objeto con todas las listas vacías borra el filtro.
- **Duplicar:** la copia hereda el filtro (clave nueva, mismo JSON).
- **Borrar:** elimina `budgetFilter_<id>` (la clave legacy ya no se escribe).

#### Interfaz

- Editor: sección `Filtro` entre `Importe` y `Nota`, con cinco selectores —
  categorías (con jerarquía), beneficiarios, métodos, etiquetas y estado —
  reutilizando `MultiPicker`/`SearchSelect` como en los filtros de Transacciones.
  Resumen en una línea: `Sin filtro: toda la cuenta` o `3 filtros`.
- Detalle: bajo la cabecera, `Filtro: Comida, Supermercado · Conciliado`, o
  `Sin filtro`. Explica por qué el reparto es el que es.
- El mock devuelve `criteria` en sus fixtures y lo acepta en el alta y la
  edición; el switch `?view=budgets&edit=1` ya abre el editor con el filtro.

#### Riesgo y comprobación

Escribir en la misma preferencia que la app es lo más delicado del corte: un
JSON mal formado o una clave equivocada deja el presupuesto de la app sin filtro.
Por eso el round-trip no se da por bueno con el datasource falso:

- `ApiRoutesTest`: el DTO viaja y vuelve tal cual con el datasource falso.
- **Dispositivo:** crear desde la web con dos categorías y un estado → abrir el
  presupuesto en la app Android y comprobar que muestra ese filtro y el mismo
  gasto; editar sin `criteria` y ver que se conserva; duplicar y comprobar que
  la copia lo hereda; borrar y comprobar que no queda basura.
- Si la app guardó un criterio compuesto, la web lo detecta y no guarda.

## 4. Comandos

```bash
cd webui/webapp && npm test                 # vitest de la SPA
cd webui/webapp && npm run build            # regenera webui/src/main/assets/webapp
cd webui/webapp && npm run mock             # http://localhost:4173/app/
docker compose run --rm android-build :webui:compileDebugKotlin
docker compose run --rm android-build :webui:testDebugUnitTest
docker compose run --rm android-build :webui:ktlintCheck
```

## 5. Ficheros

- `webui/API.md` §4.5 (ruta nueva, `second` 0-based, historial, `periodAllocationMinor`).
- `webui/src/main/java/org/totschnig/webui/api/ApiRoutes.kt` (validación de
  `second` por `grouping`, ruta `/breakdown`).
- `…/api/ApiDtos.kt` (`BudgetBreakdownDto`, `BudgetBreakdownCategoryDto`).
- `…/api/AndroidWebApiDataSource.kt` (`budgetHistory`, `budgetBreakdown`).
- `…/api/ApiQueries.kt` (árbol de categorías del presupuesto con su filtro y su
  suma del periodo).
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`.
- `myExpenses/src/main/java/org/totschnig/myexpenses/db2/RepositoryBudget.kt`
  (`loadBudgetProgress`, `sumLoaderForBudget`: gasto con partes).
- `myExpenses/src/main/java/org/totschnig/myexpenses/provider/TransactionProvider.java`
  o `DbConstants.kt`, si la suma con partes necesita SQL nuevo.
- `webui/webapp/src/components/Budgets.tsx` (botón y estado del panel).
- `webui/webapp/src/components/BudgetDetailPanel.tsx` (nuevo; sucede a
  `BudgetHistoryPanel.tsx`, que se elimina).
- `webui/webapp/src/components/BudgetEditor.tsx` y un `BudgetFilterFields`
  nuevo (los cinco selectores del filtro).
- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
  (leer/escribir `budgetFilter_<id>` con `FilterPersistence`, alta, edición,
  duplicado y borrado).
- `webui/webapp/src/api.ts`, `webui/webapp/src/types.ts`.
- `webui/webapp/src/locales/{en,es}/messages.po`.
- `webui/webapp/dev/mock-server.mjs`.
- `webui/DESIGN.md` (patrón del panel de detalle), `webui/webapp/README.md`,
  `AGENTS.md`.
- `webui/src/main/assets/webapp/**` (build de la SPA, se commitea).

## 6. Estrategia de verificación

- **JVM** (`ApiRoutesTest`, datasource falso):
  - `GET /budgets/1?year=2026&second=0` → 200 con `periodStart` 2026-01-01.
  - `second=12` y `second=-1` en `MONTH` → 400 `invalid_period`.
  - `history` 12 → 200, 12 puntos, el último es el periodo actual, `second`
    del mes actual (noviembre = 10).
  - `history` 24 → 200 (incluye un diciembre, `second` 11, sin 500).
  - progreso con fila exacta del periodo → `periodAllocationMinor` presente.
  - `breakdown`: solo categorías del presupuesto y sus descendientes con gasto;
    suma de filas sin descendientes = `totalSpentMinor`; 404 desconocido; 400
    periodo inválido; `NONE` sin `year`/`second`.
  - Jerarquía: madre en el filtro con una hija con gasto → dos filas, la madre
    con la suma de las dos y el total contando la hija una sola vez.
  - Divididas: una de 30 € en 10 (categoría del filtro) + 20 (otra del filtro)
    devuelve filas 10 y 20, total 30, y el progreso del mismo periodo también
    30; con la parte de 20 fuera del filtro, filas y total quedan en 10.
- **Repositorio/provider**: el provider no se ejecuta en el entorno JVM
  (`AGENTS.md`), así que la regla de partes se comprueba **en dispositivo**:
  crear una dividida de 30 € con partes de 10 y 20 en dos categorías del
  presupuesto (tarjeta = detalle = 30), repetirla con la parte de 20 en una
  categoría fuera del presupuesto (10) y comprobar que la lista y el widget de
  la app dan lo mismo. Se anota en `AGENTS.md` y en `webui/webapp/README.md`.
  Si aparece un hueco de test JVM razonable para el SQL, se añade.
- **SPA** (`npm test`): `series.test.ts`/`format.test.ts` siguen en 0-11; test
  nuevo de la derivación del origen del importe (periodo / heredado / defecto)
  y del % por categoría con importes del servidor; test del resumen del filtro
  (`Sin filtro` / `n filtros`) y de que el editor no envía `criteria` si no se
  toca.
- **Criterios**: `ApiRoutesTest` (datasource falso) comprueba que `criteria`
  viaja en alta y edición y que un id inexistente da 422 con `fields`. El
  round-trip real con DataStore y la app Android es manual (§3.4).
- **Mock**: `/breakdown` con las mismas fixtures que `/allocations`, historial
  0-11 y `?view=budgets&detail=1`; un test de vitest que valide la forma del
  mock contra `API.md`.
- **Manual** (mock y móvil real): 1440×900 y 390×844, tema claro y oscuro,
  `es`/`en`; abrir detalle de un presupuesto al día, uno excedido, uno sin
  reparto; "Mes anterior" hasta **enero**; comprobar que el panel muestra el
  mismo gastado que la tarjeta y que el historial no da error.

## 7. Límites

- Always: `second` 0-based en toda frontera con la API; importes del servidor;
  la ruta nueva se documenta en `API.md` antes de la UI; todo el texto pasa por
  Lingui.
- Always: el reparto por categoría sale del filtro guardado del presupuesto,
  nunca del árbol completo de la cuenta.
- Always: el filtro se escribe con la clave `budgetFilter_<id>` y el mismo JSON
  de `Criterion` que usa la app; si el valor guardado no se puede representar,
  no se guarda.
- Never: inventar una segunda ubicación para los criterios (columna, fichero o
  clave nueva) ni duplicar la lógica de filtrado en la web.
- Ask first: tocar `budget_allocations` o el filtro guardado del presupuesto;
  cualquier migración.
- Never: sumar transacciones en el cliente para obtener el gasto; cambiar la
  semántica de `/allocations` que usa el editor; romper `Historial` sin
  actualizar `README.md` y `AGENTS.md` en el mismo commit.

## 8. Criterios de éxito

- Abrir `Detalle` muestra, sin editar, el gasto por categoría del presupuesto y
  cuadra con el gastado de la tarjeta (151,23 € = 132,24 + 18,99 en el caso real).
- El detalle de "6 - Bus" no muestra Alojamiento ni ninguna categoría ajena.
- `Historial` (dentro del panel) responde 200 en los 6 presupuestos del móvil y
  la última barra es el mes en curso.
- Navegar a enero funciona; `second` fuera de rango da 400, nunca 500.
- El importe del periodo se distingue de la asignación por defecto sin abrir el
  editor.
- Con una dividida dentro del presupuesto, la tarjeta, la cabecera del panel y
  la suma de filas dan el mismo gasto; ninguna parte se cuenta dos veces.
- Con una madre en el filtro y gasto en sus hijas, el panel pinta la rama con
  sangría y el total no suma la madre y las hijas a la vez.
- Un presupuesto creado desde la web con dos categorías y un estado aparece en
  la app Android con ese mismo filtro y el mismo gasto; editarlo sin envíar
  `criteria` lo conserva; duplicarlo lo hereda; borrarlo no deja restos.
- `npm test`, `:webui:testDebugUnitTest`, `ktlintCheck` en verde; docs
  actualizadas en el mismo commit.

## 9. Fuera de alcance (V2)

- Saltar del panel a los **movimientos** de una categoría y un mes (drill-down a
  Transacciones). V1 muestra importes agregados, no transacciones.
- Editar el reparto desde el panel (el botón `Editar` sigue siendo el camino).
- Rollover por categoría en la web (sigue en la app Android).
- Reparto por beneficiario, método o etiqueta dentro del presupuesto.
- Criterio de cuentas (oculto en la app) y criterios compuestos (`Or`/`Not`
  guardados por la app): se detectan y no se reescriben.
- Preferencia "agregar neutrales" por presupuesto: sigue solo en la app.
- Corregir el script inline de tema bloqueado por CSP y el `currentDay` negativo
  de periodos futuros: son hallazgos del QA, fuera de este corte.
- Cambiar la app Android o el esquema de datos.

## 10. Preguntas abiertas

Ninguna. Pendiente solo de aprobación.

## 11. Decisiones cerradas

- Categorías con 0 gasto: **no se muestran y no se anuncia cuántas quedan
  fuera** (variante A sin nota, 18-nov-2026).
- `Historial` desaparece: una sola entrada, `Detalle`, con todo dentro
  (18-nov-2026).
- Nivel de detalle: categoría **y** subcategorías, con la hija bajo su madre y
  la cifra de la madre ya agregada; el total no cuenta dos veces (18-nov-2026).
- Saltar a los movimientos del presupuesto: **V2** (18-nov-2026).
- Criterios con paridad respecto a la app (categorías, beneficiarios, métodos,
  etiquetas y estado) al crear y editar: **dentro de esta pasada** (18-nov-2026).
- Enero y el historial se corrigen **en esta misma rebanada** (18-nov-2026).
- El reparto es sensible a transacciones divididas y el total se ajusta a las
  partes (§3.3), también en esta rebanada.
