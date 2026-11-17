# Plan: Corrección de hallazgos QA web — V1

Spec: [`SPEC-web-qa.md`](../SPEC-web-qa.md) (aprobado 2026-11-17)
Módulos: `SPEC-contrato-meses.md`, `SPEC-consultas-informes.md`,
`SPEC-presupuestos-escritura.md`, `SPEC-divididas.md`, `SPEC-endurecimiento.md`
Origen: QA del entorno real `http://192.168.1.191:9000/app/` (My Expenses 4.1.4)

## Goal

Que las pantallas que hoy muestran datos falsos (dashboard, presupuestos) o error
(informes, divididas, presupuestos) funcionen con el servidor real, y que el
servidor web deje de aceptar peticiones que no puede sostener. Cinco entregas
verificables por separado.

## Contexto de ejecución

- El entorno del móvil está **vacío** (0 transacciones, 0 presupuestos) y sus dos
  escrituras rotas (presupuesto y dividida) fallan igual desde cero: no hace
  falta resetear nada para reproducir; tampoco se puede vaciar más desde la API
  (no hay borrado de cuentas ni masivo).
- Hay otro agente trabajando en la SPA (`SPEC-web-ui-*`). `contrato-meses` toca
  `series.ts`, `format.ts`, `Budgets.tsx`, `mock-server.mjs` y los `format*`
  tests: si su tanda no ha aterrizado, se trabaja en un worktree y se rebasa.
- Ningún módulo de este plan corre en los tests JVM contra SQL real: la
  verificación de las rutas 500/422 es en dispositivo, con los `curl` del informe
  de QA y el log de la app.

## Componentes y dependencias

| Módulo | Qué produce | Depende de |
|---|---|---|
| `contrato-meses` | Mes 0-11 en SPA, mock y docs; test de contrato en vitest y en la ruta JVM | — |
| `consultas-informes` | 200 en filtros `categoryId`/`tagId`, drill-down y `accountId=all` | `contrato-meses` (comparte `API.md`) |
| `presupuestos-escritura` | Alta/edición, asignaciones e historial fiables | — (investiga la causa de `cat_id = 0`) |
| `divididas` | Alta de dividida válida | — (misma investigación que presupuestos) |
| `endurecimiento` | gzip, cabeceras, límite de intentos, importes acotados | — |

## Orden y paralelismo

1. **`contrato-meses`** — primero: es el que explica los KPIs a cero y el mes
   equivocado, y decide la convención que documentan los demás.
2. **`presupuestos-escritura` y `divididas`** — inmediatamente después y
   **juntos**: comparten la sospecha de `cat_id = 0`. Una sola sesión de
   diagnóstico en el dispositivo, dos entregas.
3. **`consultas-informes`** — puede ir en paralelo con el anterior (ficheros
   distintos), pero necesita el log del móvil para confirmar alias/URI.
4. **`endurecimiento`** — al final: toca el módulo Ktor y puede cambiar cómo se
   comporta el móvil ante la CSP; conviene con el resto ya estable.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El 422 de presupuestos y divididas no es la misma causa | El diagnóstico es una tarea propia (T7) con salida escrita antes de tocar código |
| La CSP rompe el arranque de la SPA en el móvil | Se prueba primero en el mock y se abre en el dispositivo antes de commitear |
| Otro agente edita los mismos ficheros de la SPA | Worktree + rebase, como en `tasks/web-ui/plan.md` |
| Cambiar `formatMonth` a 0-11 rompe callers con `YYYY-MM` | Se separa en dos helpers (`formatMonth` 0-11 y `formatMonthKey` para `YYYY-MM`) y el typecheck los encuentra |
| Verificación solo manual en rutas de datos | Checklist por módulo en `tasks/web-qa/todo.md` + `curl` reproducibles |

## Verificación global (antes de dar la iniciativa por cerrada)

```
cd webui/webapp && npm test && npm run build && npm run i18n:compile
docker compose run --rm android-build :webui:testDebugUnitTest
docker compose run --rm android-build :webui:ktlintCheck
cd webui/webapp && npm run mock      # 1440×900 y 390×844
```

Más la pasada en el móvil real de cada checklist. `webui/API.md`,
`webui/webapp/README.md` y `AGENTS.md` se actualizan en el mismo commit que cada
módulo (regla del repo).
