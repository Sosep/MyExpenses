# Spec: Criterios de aceptación de las funciones en marcha — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-ui-v1.md`](./SPEC-web-ui-v1.md)
Scope: filtros de transacciones, periodo e histórico de presupuestos, gráficos de
presupuesto y divisas mixtas. Este spec **no abre producto nuevo**: fija qué significa
“terminado” para lo que ya está aterrizando el otro agente.

## Objetivo

Que las cuatro funciones en curso cumplan la guía en los estados que la demo no enseña:
sin filtros activos, con filtros sin resultados, en un mes futuro, en un mes sobregirado y
con varias divisas. Hoy están implementadas las rutas principales; faltan los bordes.

## Comportamiento actual

- **Filtros.** Cuatro `SearchSelect` (categoría, beneficiario, etiqueta, método) en una fila;
  ocultan las KPIs del mes cuando hay filtros. No hay chips de filtro activo, ni estado
  vacío propio, ni sincronía con la URL. Ocupan 94 px de alto en móvil.
- **Presupuestos.** Navegación de mes, progreso/asignación/periodo por mes y panel de
  histórico de 12 meses. Cada tarjeta repite el mes; el pie se parte en dos líneas; el
  histórico pinta todos los meses del mismo azul y sin valores de porcentaje.
- **Divisas mixtas.** `All accounts` ya agrega con `KEY_DISPLAY_AMOUNT` (importe convertido a la
  divisa base), igual que Android. Falta que la UI deje claro en qué divisa está el total.
- **Gráficas de presupuesto.** Barras por categoría gastado/asignado y el histórico; sin
  etiqueta de importe y sin color por estado.

## Comportamiento nuevo (criterios)

### F1. Filtros de transacciones

- Chips de filtro activo bajo la barra, con “×” individual y “Limpiar todo”; el contador
  aparece en el botón cuando están plegados en móvil.
- Los filtros viven en la URL y se pueden compartir (AGENTS lo exige para filtros).
- Con resultados vacíos, el mensaje nombra la causa y ofrece limpiar: “Ningún movimiento con
  estos filtros · Limpiar filtros”.
- Al navegar con `↑`/`↓` en el combo, la opción resaltada se desplaza a la vista.
- En móvil, los cuatro campos se pliegan tras “Filtros (n)”; el listado no baja de y=380.

### F2. Presupuestos por periodo

- El mes se queda visible en cada tarjeta, siempre (decisión 6 del mapa): la redundancia con
  la cabecera se acepta para que cada tarjeta se lea sola.
- “›” no navega más allá del mes actual y se deshabilita con un título que lo explica. “‹”
  sigue libre: el API no dice cuál es el primer periodo con presupuesto.
- El resumen superior sigue apareciendo sólo si todos los presupuestos comparten divisa y
  periodo; si no, se explica en una nota.
- El pie de la tarjeta es una línea con porcentaje, días restantes y dos acciones táctiles.

### F3. Gráficos de presupuesto

- El histórico colorea por estado: en curso, en riesgo (≥80 %) y excedido (>100 %), y
  muestra el porcentaje de cada mes; los meses excedidos llevan además el chip `Over`.
- Cada barra por categoría lleva importe gastado/asignado legible; la pista de la barra se
  distingue del fondo en claro y en oscuro.
- El panel de histórico se puede abrir con teclado y cierra con `Esc`.

### F4. Divisas mixtas en informes

Se comporta como la app Android, que ya es lo que hace el servidor: cuando `allAccounts`,
las consultas agregan `KEY_DISPLAY_AMOUNT`, el importe convertido a la divisa base con el
tipo de cambio de la cuenta (`ApiQueries.kt:282`) y `1` si no hay tipo guardado
(`DbConstants.kt:1075`).

- Un único total, en la divisa base, con el código de divisa que ya devuelve el API.
- Todos los importes del desglose se formatean con `data.currency`/`data.fractionDigits` del
  API, no con los de la cuenta seleccionada: hoy el subtotal de la tarjeta usa
  `account.currency` (`Reports.tsx:256-261`) y con divisas mixtas etiqueta mal el total.
- Sin subtotales por divisa ni chips de divisa: la app Android no los tiene.
- Sin tipos de cambio nuevos ni históricos por transacción.
- Con `All accounts` y varias divisas, el drill-down sigue desactivado y el título del panel
  lo explica (comportamiento actual, a mantener).
- Un cambio de divisa en la cuenta se refleja en la siguiente carga, no en cliente.

## Estructura (partes relevantes)

```
webui/webapp/src/components/Transactions.tsx        -> chips, plegado, estado vacío
webui/webapp/src/components/Budgets.tsx             -> periodo, pie, resumen
webui/webapp/src/components/BudgetHistoryPanel.tsx  -> estados y etiquetas
webui/webapp/src/components/ReportPanel.tsx         -> divisa y desactivación del detalle
webui/webapp/src/components/SearchSelect.tsx        -> scroll de la opción resaltada
webui/webapp/src/styles/app.css                     -> chips, pie de tarjeta, barras
webui/webapp/dev/mock-server.mjs                    -> fixtures y switches nuevos
webui/API.md                                        -> sólo si cambia un DTO
```

## Estilo de código

Igual que el resto: importes con `Money`/`formatMoney` (nunca concatenados), plurales con
ICU, filtros con `SearchSelect`, escrituras que invalidan caché. Ninguna suma de divisas en
cliente.

## Estrategia de verificación

Con el mock y switches nuevos, documentados en `README.md` y `AGENTS.md`:

- `?view=transactions&filter=groceries` (existente) y un `?view=transactions&filter=none`
  para el vacío.
- `?view=budgets&budgetMonth=-1` y `?view=budgets&budgetMonth=+1` para el tope de mes.
- `?view=budgets&history=1` con un mes excedido en el fixture.
- `?view=reports&allAccounts=1&mixedCurrency=1` para el caso de varias divisas.

Cada criterio se comprueba en 1440×900 y 390×844, en claro y oscuro, y con `es`/`en`.

## Límites

- Always: mantener `API.md` en sincronía si cambia un DTO; conservar los switches de QA
  existentes; no romper el mock para el otro agente.
- Ask first: cualquier cambio de contrato en `/api/v1`; añadir tipos de cambio al servidor.
- Never: sumar monedas distintas en el cliente; mostrar datos obsoletos como actuales;
  desactivar un filtro sin decirlo en la UI.

## Criterios de éxito

- Con filtros activos, la pantalla dice cuáles están puestos y se pueden quitar de uno en uno.
- La lista se puede compartir por URL y llega con los mismos filtros.
- Un mes sin presupuesto o un mes futuro no rompe la navegación ni muestra cifras falsas.
- En el histórico se distingue un mes excedido sin depender del color.
- Con dos divisas, el total de `All accounts` coincide con el que muestra la app Android
  para el mismo periodo (misma divisa base, mismos importes convertidos).

## Fuera de alcance (aplazado)

- Tipos de cambio históricos por fecha de transacción.
- Filtros guardados o vistas favoritas.
- Comparación entre presupuestos o entre meses en una sola vista.
