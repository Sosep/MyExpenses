# Spec: contrato-meses — índice de mes único — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md)
Scope: contrato de `/reports/grouped` y `/budgets*`, SPA que lo consume, mock y docs.

## Objetivo

Un solo índice de mes en todo el sistema: **0-11** para `MONTH` (enero = 0,
noviembre = 10). Hoy la API real usa 0-11, la SPA y el mock usan 1-12. El
desfase hace que el dashboard muestre KPIs a cero y que los presupuestos se
pidan un mes por delante.

## Comportamiento actual (evidencia del QA)

- API real: `GET /reports/grouped?accountId=1&from=2025-12-01&to=2026-11-30&grouping=MONTH`
  devuelve `{"year":2026,"second":10,...}` para noviembre.
- Mock: la misma petición devuelve `second: 11`
  (`webui/webapp/dev/mock-server.mjs:434`, `date.getMonth() + 1`).
- SPA: `webui/webapp/src/series.ts:11` usa `year * 12 + second` comparando el
  cursor `2026-11` (11) contra el `second` del servidor (10). Resultado:
  `INGRESOS 0,00 €`, `GASTOS 0,00 €` y gráfico vacío con transacciones del mes.
- `webui/webapp/src/format.ts:43-52` interpreta `second` como 1-12
  (`new Date(year, second - 1, 1)`).
- `webui/webapp/src/components/Budgets.tsx:72,78` envía `monthNumber` (1-11) a
  `GET /budgets/{id}?year&second`, así que noviembre (`second=11`) devuelve
  diciembre (`currentDay: -13`, `spentMinor: 0`).
- `webui/webapp/src/components/BudgetHistoryPanel.tsx:67` pasa
  `periodSecond` a `formatMonthShort` con la misma suposición 1-12.
- `webui/API.md:351` (`"periodSecond": 11` con `periodStart: 2026-11-01`) y
  `webui/API.md:421` (`"second": 11` para noviembre) documentan el valor
  incorrecto aunque `webui/API.md:367` remite al enum de la app.

Ojo: la gráfica vacía tiene **dos causas independientes**. `SPEC-web-ui-defects.md`
D1 sanea alturas `NaN` en el mock; esta spec arregla el cruce de índices que deja
todas las series a cero contra el servidor real. Hacen falta las dos.

## Comportamiento nuevo

1. La SPA pasa a 0-11 en todas las fronteras con la API:
   - `series.ts`: el cursor se indexa con `second - 1` (o se construye con
     `Date.getMonth()`), de forma que `2026-11` ↔ `second = 10`.
   - `format.ts`: `formatMonth`/`formatMonthShort` reciben 0-11.
   - `Budgets.tsx`: envía `monthNumber - 1` a `getBudgetProgress` y
     `getBudgetAllocations`.
   - `BudgetHistoryPanel.tsx`: formatea `periodSecond` como 0-11.
   - Ayudantes internos de la SPA que hoy producen 1-12 (navegación de meses,
     `currentMonth()` para peticiones) se ajustan en el punto de llamada, no se
     duplican convenciones.
2. El mock devuelve 0-11 en `reports/grouped`, `budgets/{id}`,
   `budgets/{id}/history` y `budgets/{id}/allocations`.
3. `webui/API.md` fija la convención explícita ("`second` es el índice del
   periodo según `grouping`: 0-11 para `MONTH`, 0-6 para `WEEK`, 0-365 para
   `DAY`, 0-11 para `YEAR` = mes, `NONE` = 0") y corrige los ejemplos.
4. `webui/webapp/README.md` y `AGENTS.md` mencionan la convención junto a los
   switches del mock.

## Ficheros

- `webui/webapp/src/series.ts`, `webui/webapp/src/series.test.ts`
- `webui/webapp/src/format.ts`, `webui/webapp/src/format.test.ts`
- `webui/webapp/src/components/Budgets.tsx`
- `webui/webapp/src/components/BudgetHistoryPanel.tsx`
- `webui/webapp/dev/mock-server.mjs`
- `webui/API.md`, `webui/webapp/README.md`, `AGENTS.md`

## Estrategia de verificación

- **Contrato en JVM** (`webui/src/test/.../ApiRoutesTest.kt`): el DTO de grupo
  conserva el `second` recibido del cursor (`10` para noviembre, sin sumar 1) y
  `/budgets/{id}?year=2026&second=10` resuelve `periodStart` 2026-11-01.
- **Contrato en la SPA** (`series.test.ts`, `format.test.ts`): fixtures en 0-11
  (noviembre = `10`, diciembre = `11`, enero = `0`) y un caso que compara el
  cursor `YYYY-MM` con el `second` del servidor, que es el que falla hoy.
- **Mock**: `dev/mock-server.mjs` con la misma fixture; un test de vitest que
  valide una respuesta del mock contra la forma documentada en `API.md`.
- Manual: dashboard con movimientos del mes (KPIs ≠ 0), presupuesto mensual con
  gasto del mes, "Mes anterior" dos veces y panel de historial.

## Límites

- Always: la API mantiene 0-11; no se introduce un mapeo en el DTO del servidor.
- Never: dejar dos convenciones dentro de la SPA (p. ej. `currentMonth()` en
  1-12 usado sin convertir en una llamada a la API).
- Ask first: si algún consumidor externo (exportaciones, sync) depende de 1-12.

## Criterios de éxito

- Con datos reales, `INGRESOS`, `GASTOS` y `AHORRADO` del dashboard coinciden con
  `/reports/summary` del mismo rango.
- El gráfico de 12 meses dibuja el mes en curso.
- `GET /budgets/{id}?year=<año>&second=<mes-1>` devuelve el periodo pedido en la
  UI y la cabecera del presupuesto dice el mes correcto.
- El historial etiqueta cada periodo con su mes real.
- `npm test` falla antes del cambio (fixtures 0-11) y pasa después.

## Fuera de alcance

- Cambiar `grouping` (`DAY`, `WEEK`, `NONE`): se mantiene como hoy.
- Localización de fechas: ya funciona con el locale activo.
