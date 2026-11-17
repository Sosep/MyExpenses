# Plan: My Expenses Web UI — V1

Spec: [`SPEC-web-ui-v1.md`](../SPEC-web-ui-v1.md) (aprobado 2026-11-17)
Módulos: `SPEC-web-ui-defects.md`, `SPEC-web-ui-a11y.md`, `SPEC-web-ui-density.md`,
`SPEC-web-ui-features.md`
Alcance: SPA (`webui/webapp`) y assets generados. Sin Kotlin ni API.

## Goal

Dejar la SPA conforme a su propia guía: sin defectos que falseen datos, con contraste y foco
AA, y con el dato principal visible en 390×844 y bien jerarquizado en 1440×900. Cuatro
entregas verificables por separado.

## Contexto de ejecución

Hay otro agente trabajando en el mismo árbol sobre `Transactions.tsx`, `Budgets.tsx`,
`api.ts`, `mock-server.mjs` y `app.css`. Los tres primeros módulos comparten `app.css` con
él, así que se trabaja en un worktree y se rebasa cuando su tanda aterrice; `web-ui-features`
no empieza hasta que commitee.

## Componentes y dependencias

| Módulo | Qué produce | Depende de |
|---|---|---|
| Herramientas de test | `npm test` con Vitest + jsdom + axe-core; `Chart.test.tsx` y los primeros casos de formato | — |
| `web-ui-defects` | Chart saneado, topbar sin desbordar, copy traducido, switches de QA fiables, `theme-color` por tema | Herramientas de test |
| `web-ui-a11y` | `--focus-ring` sólido, `--control-h` (44/36), contraste de cabeceras y chips, foco atrapado y devuelto, `DESIGN.md` §11 a 44 px | Herramientas de test |
| `web-ui-density` | Topbar de una línea, chips de cuenta/mes, KPIs 2×2, filtros plegados, FAB, pie de presupuesto, ficheros, escala tipográfica a 14 px | `web-ui-a11y` (consume `--control-h`) |
| `web-ui-features` | Criterios y ajustes de borde en filtros, periodo/histórico de presupuestos y divisas mixtas | Commits del otro agente + `web-ui-density` |

## Orden y paralelismo

0. **Herramientas de test** — primero y en una sola tarea: sin `npm test` los módulos
   siguientes no tienen verificación automática.
1. **`web-ui-defects`** — después, porque el mock y `Transactions.tsx` se comparten y porque
   una gráfica vacía contamina cualquier revisión posterior.
2. **`web-ui-a11y`** — en paralelo con el anterior sólo si se tocan ficheros distintos; si no,
   después.
3. **`web-ui-density`** — después de a11y, porque usa los tokens de altura y de foco.
4. **`web-ui-features`** — al final y condicionado al otro agente; se aplica aquí sobre su
   código cuando commitee.

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Conflictos con el agente en paralelo en `app.css` | Worktree por módulo; rebase antes de abrir el PR; cambios de CSS agrupados por selector y no por archivo completo |
| El build commiteado se pisa entre agentes | Regenerar `webui/src/main/assets/webapp` al final de cada módulo, nunca a mitad |
| Cambiar 13→14 px rompe filas de tabla y tarjetas | Verificar primero en Transacciones y Presupuestos a 390; ajustar `line-height`, no el padding |
| `?metrics=1` no mide lo que creemos | Comparar `scrollWidth/clientWidth` y la posición de la primera fila, no impresiones |
| El foco atrapado rompe atajos (`N`, `/`, `Esc`) | Probar el recorrido completo con teclado en cada panel antes de dar por cerrado a11y |
| El histórico de presupuestos cambia mientras se especifica | Congelar los criterios de F3 y aplicarlos cuando aterrice; no reabrir el diseño |
| axe-core en jsdom no evalúa contraste ni layout | El contraste se comprueba con la matemática de los tokens en el propio test; axe cubre semántica, roles y nombres |

## Puntos de verificación

Al cerrar cada módulo, con el mock en 4173:

1. `npm test` en verde (Vitest + axe).
2. `npm run build` y captura 1440×900 y 390×844, claro y oscuro, `es` y `en`.
3. `?metrics=1`: sin scroll horizontal; posición de la primera fila y de la tarjeta de
   desglose dentro del criterio del módulo.
4. Recorrido de teclado por la pantalla tocada.
5. `npm run i18n:compile` en modo estricto.
6. `git status` limpio de `node_modules` y del keystore; assets regenerados y commiteados.

## Entregables por módulo

- `web-ui-defects`: 5 arreglos + fixtures del mock + dos switches documentados.
- `web-ui-a11y`: tokens nuevos, `DESIGN.md` §4.1/§11, foco en paneles y filas.
- `web-ui-density`: shell y las seis pantallas de datos; escala tipográfica.
- `web-ui-features`: criterios aplicados + switches de QA nuevos (vacío, mes futuro, divisas).

## Fuera de este plan

- Migración de `app.css` a Tailwind (aplazada a V2).
- Router, virtualización, modo compacto, Storybook.
- Cualquier cambio de contrato en `/api/v1`.
