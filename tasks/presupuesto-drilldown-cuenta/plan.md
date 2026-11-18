# Plan: presupuesto-drilldown-cuenta — V1

Spec: [`SPEC-presupuesto-drilldown-cuenta.md`](../../SPEC-presupuesto-drilldown-cuenta.md)
(aprobada el 18-nov-2026, opción A).
Sin cambios de esquema, de API ni en Kotlin.

## Orden

| # | Pieza | Por qué antes |
|---|---|---|
| 1.1 | Helpers puros: `accountFromUrl`/`searchWithAccount` y `budgetDrilldownSearch` + tests | son la regla; el componente y `App` solo los llaman |
| 1.2 | `App`: cuenta desde la URL (arranque, `navigate`, `popstate`) y `replaceState` al cambiar | sin esto el enlace lleva `accountId` pero nadie lo lee |
| 1.3 | `BudgetDetailPanel`: el enlace sale del helper con la cuenta del `breakdown` | cierra el fallo |
| 1.4 | Mock: `data-budget-id` y `?detail=<id>` | QA visual del caso real (otra cuenta) |
| 1.5 | Tests, `npm run build` (assets) e i18n si hiciera falta | verificación |
| 1.6 | Docs (`AGENTS.md`, README, spec) | cierre |
| 1.7 | Commit y merge en `fork-master` | entrega |

## Decisiones

- La cuenta viaja como `accountId` (coherente con el DTO y con la API) y la URL
  manda: al arrancar gana a `localStorage`, y `localStorage` sigue siendo la
  memoria entre visitas.
- Un único efecto escribe la cuenta en la URL con `replaceState` cuando cambia
  (selector o caída a la primera cuenta): ni entradas de historial de más ni URL
  que contradiga al selector.
- Sin `accountId` en la URL no se toca la cuenta actual: atrás hacia una entrada
  anterior no devuelve la cuenta vieja, se queda en la última mirada.
- El constructor del enlace sale del componente a una función pura (sin
  `window`) para poder probarlo sin montar el panel.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `replaceState` mientras un panel de historial está abierto | se conserva `history.state`, así que `useHistoryPanel` sigue cerrando con atrás |
| Id de cuenta borrada en un enlace compartido | el efecto de siempre cae en `accounts[0]` y la URL se reescribe con la cuenta válida |
| El drill-down deja de sumar como la fila | mismo rango, misma rama y mismos criterios; solo se añade la cuenta, que ya era la del presupuesto |
| Assets generados a mano | `npm run build` y commit de `webui/src/main/assets/webapp/` |

## Puntos de control

1. Tras 1.1: `npm test` (helpers).
2. Tras 1.3: `npm run build` y mock `?view=budgets&detail=3`.
3. Visual 1440×900 y 390×844, claro/oscuro, en/es, y atrás/adelante.
4. Merge en `fork-master` solo con el árbol de tests y build en verde.
