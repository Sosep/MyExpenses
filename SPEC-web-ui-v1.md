# Capability Map: My Expenses Web UI — V1

Status: approved (2026-11-17) — cuatro módulos, en el orden indicado
Origen: revisión de UI/UX de la SPA `webui/webapp` (snapshot `4b81d483` + cambios sin
commitear de Presupuestos/Filtros). Hay otro agente trabajando en el mismo árbol; este
mapa y los specs describen lo observado, no un estado congelado.

## Objetivo de la iniciativa

Cerrar la brecha entre `webui/DESIGN.md` y la SPA: que ninguna pantalla tenga defectos que
rompan la confianza en los datos, que el contraste y el foco cumplan AA, y que en móvil el
dato principal aparezca sin media pantalla de controles por delante. No añade producto
nuevo: hace que lo que ya existe cumpla su propia guía.

## Supuestos

1. Los specs son para la SPA (`webui/webapp`), no para Android ni para Ktor.
2. La verificación es el mock a 1440×900 y 390×844, en claro y oscuro, con `es` y `en`.
3. Vitest + jsdom + axe-core entran como `devDependencies` (decisión 7); `npm test` forma
   parte de la verificación de cada módulo.
4. `DESIGN.md` es normativo: si el código y la guía discrepan, se corrige el código o se
   cambia la guía en el mismo PR, nunca se ignora.
5. El trabajo de Filtros, Presupuestos por periodo, gráficos de presupuesto y divisas
   mixtas lo está aterrizando el otro agente; este agente aplica `web-ui-features` sobre su
   código cuando commitee.
6. La migración a Tailwind de las pantallas antiguas queda fuera de esta V1 (refactor sin
   cambio visible).

## Mapa de capacidades

| id | Responsabilidad | Cubre | Depende de | Toca |
|---|---|---|---|---|
| `web-ui-defects` | Defectos que rompen datos o la primera pantalla | Gráfica de 12 meses vacía, desbordamiento del topbar, textos sin traducir, QA switches mentirosos | — | `Chart.tsx`, `TransactionPanel.tsx`, `Reports.tsx`, `api.ts`, `mock-server.mjs`, `app.css` |
| `web-ui-a11y` | Contraste AA, foco visible y objetivos táctiles | Anillo de foco, muted sobre sunken, chips en oscuro, altura de controles, foco atrapado y devuelto | — | `tokens.css`, `app.css`, `DESIGN.md`, paneles |
| `web-ui-density` | Que el dato mande en 1440 y en 390, y que la tipografía vuelva a la escala | Topbar de una línea, KPIs 2×2, filtros plegados, CTA flotante, columnas y anchos de escritorio, 14 px de cuerpo | `web-ui-a11y` (tokens de altura) | `app.css`, `Shell.tsx`, `Dashboard.tsx`, `Transactions.tsx`, `Reports.tsx`, `Budgets.tsx`, `Files.tsx` |
| `web-ui-features` | Criterios de aceptación de lo que está en marcha | Filtros, periodo e histórico de presupuestos, divisas mixtas, lectura de gráficas | El otro agente aterrice sus commits | `Transactions.tsx`, `Budgets.tsx`, `BudgetHistoryPanel.tsx`, `Reports.tsx`, `api.ts` |

Orden de construcción: `web-ui-defects` → `web-ui-a11y` → `web-ui-density` →
`web-ui-features`. Los cuatro los ejecuta este agente; el último espera a que el otro
agente commitee las pantallas de filtros y presupuestos.

## Coordinación con el agente en paralelo

- Los cuatro módulos tocan `app.css`, y tres tocan `Budget*`/`Transactions`. No se empieza
  ninguno hasta que el otro agente commitee su tanda, o se hace en un worktree y se rebasa.
- `web-ui-features` se aplica aquí, pero después: sus criterios describen el código que el
  otro agente escribe ahora. El spec es el contrato con el que se revisa lo que aterrice.

## Éxito de la iniciativa

- Las siete pantallas (Resumen, Transacciones, Informes, Presupuestos, Ficheros, Login y
  los tres editores) pasan la checklist de `DESIGN.md` §16 en 1440×900 y 390×844, claro y
  oscuro, `es` y `en`.
- Sin scroll horizontal en 360, 390, 560, 768, 1024, 1280 y 1440 px.
- Ningún texto visible en inglés con la interfaz en español.
- Contraste AA en todo el texto y en el anillo de foco.

## Comandos (compartidos por los cuatro módulos)

```
Build SPA:        cd webui/webapp && npm run build      # escribe webui/src/main/assets/webapp
Tests SPA:        cd webui/webapp && npm test           # Vitest + jsdom + axe-core
Mock:             cd webui/webapp && npm run mock       # http://localhost:4173/app/
Mock en otro puerto: MOCK_PORT=4174 npm run mock
i18n extraer:     cd webui/webapp && npm run i18n:extract
i18n estricto:    cd webui/webapp && npm run i18n:compile
Kotlin (sólo si se toca):  docker compose run --rm android-build :webui:compileDebugKotlin
Lint Kotlin:      docker compose run --rm android-build :webui:ktlintCheck
```

QA: `?metrics=1`, `?theme=dark`, `?locale=es`, `?login=1`, y los switches de cada
pantalla que ya documenta `webui/webapp/README.md`.

## Fuera de alcance (aplazado)

- Migrar las pantallas antiguas a Tailwind (refactor grande, sin cambio visible).
- Modo densidad compacta global, virtualización de tablas, router con deep links.
- Adoptar shadcn/ui, TanStack Table, Recharts o React Hook Form.
- Tipos de cambio nuevos: se usan los que ya guarda la cuenta, como la app Android.
- Cualquier cambio en Kotlin, API o esquema.

## Decisiones tomadas

1. **Aprobado** el mapa de cuatro módulos, en orden `defects → a11y → density → features`.
   Los cuatro los ejecuta este agente; `web-ui-features` espera a que el otro agente
   commitee las pantallas que describe.
2. **Cuerpo de 14 px** (lo que dice `DESIGN.md` §4.2). Se normaliza el CSS: desaparecen los
   13, 15 y 17 px sueltos; `web-ui-density` los lleva a la escala 11/12/14/16/20/28/40.
3. **Objetivos táctiles de 44 px** con `pointer: coarse` (36 px con ratón). `DESIGN.md` §11
   se actualiza en el mismo commit.
4. **Divisas mixtas:** se resuelven como en la app Android. El servidor ya agrega con
   `KEY_DISPLAY_AMOUNT`, es decir convierte cada importe a la divisa base con el tipo de
   cambio de la cuenta y, si falta, usa 1 (`DbConstants.kt:1074-1091`). No hay subtotales por
   divisa ni tipos nuevos: la UI muestra el total en la divisa base y el código de divisa que
   ya devuelve el API.
5. **Fuera el crumb** del topbar: repetía el H1. La app no tiene subpáginas, así que no se
   sustituye por un breadcrumb.
6. **El periodo se queda en cada tarjeta de presupuesto**, siempre visible. La redundancia con
   la cabecera se acepta a cambio de que cada tarjeta se lea sola.
7. **Se añaden Vitest y axe-core** como `devDependencies`. `npm test` pasa a formar parte de
   la verificación de cada módulo.

## Preguntas abiertas

Ninguna. Las cuatro pendientes se resolvieron el 2026-11-17.

## Índice

- [SPEC-web-ui-defects.md](./SPEC-web-ui-defects.md)
- [SPEC-web-ui-a11y.md](./SPEC-web-ui-a11y.md)
- [SPEC-web-ui-density.md](./SPEC-web-ui-density.md)
- [SPEC-web-ui-features.md](./SPEC-web-ui-features.md)
