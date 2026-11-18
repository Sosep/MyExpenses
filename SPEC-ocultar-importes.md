# Spec: ocultar-importes — dos botones de privacidad para las cifras — V1

Status: approved (2026-11-18)
Scope: solo SPA (`webui/webapp`). Sin cambios en `/api/v1`, en la app Android, en
la cookie de sesión ni en el service worker.

## Objetivo

Poder tapar las cifras de dinero de un toque, para mirar la app en público, en
una pantalla compartida o con alguien al lado. Hay dos gestos independientes
porque las dos cosas se ocultan por motivos distintos:

- **Totales**: el patrimonio, los KPIs del mes, los resúmenes de informes y los
  agregados de presupuesto (los «números grandes»).
- **Transacciones**: los importes de las filas, las partes de una dividida, los
  subtotales de periodo y el resto de importes de listas.

La estructura de la pantalla no cambia: se sigue navegando, filtrando y abriendo
detalles sin revelar cuánto dinero hay.

Historias:

- Como usuario, pulso el botón de totales y el patrimonio y los KPIs quedan
  tapados; pulso el de transacciones y desaparecen los importes de las filas.
- Como usuario, cada botón recuerda su estado al recargar y al cambiar de
  pantalla.
- Como usuario, la app sigue siendo usable tapada: puedo moverme, filtrar, abrir
  una transacción y ver su fecha, categoría y descripción.

## Comportamiento actual (medido)

- Todas las cifras pasan por `formatMoney()` de `webui/webapp/src/format.ts`
  (33 llamadas en 9 componentes: Dashboard, Transactions, Chart, Reports,
  ReportPanel, Budgets, BudgetDetailPanel, TransactionPanel, TransactionEditor).
  `formatPercent()` tiene 6 llamadas y no es dinero.
- El patrimonio vive en `Dashboard.tsx` (`.hero` → `.hero-value`, 40 px) con
  `account.currentBalanceMinor`; los KPIs del mes son `.kpi-value` (20 px). La
  cabecera de cada periodo en Transacciones pinta ingresos, gastos y
  transferencias en `.group-sums`. Los paneles laterales usan `.panel-amount`
  y `.parts-table`. Presupuestos e informes muestran importes sueltos y en
  frases (`t`… ${formatMoney(…)} …``).
- El gráfico de barras no tiene eje de valores: el único importe absoluto está
  en el `title` de cada columna («… — income X, expenses Y»).
- Preferencias de cliente ya existentes: tema (`myexpenses.theme`) e idioma
  (`myexpenses.locale`), ambas en `localStorage`. No hay ningún estado global
  de importes.
- `DESIGN.md` §12 ya manda que el dinero lo formatee un primitivo `Money`
  («Ninguna página formatea a mano»), pero hoy se llama a `formatMoney` directo.
- La barra superior (48 px) tiene, en escritorio, idioma + tema + sesión en
  `.top-inline`; por debajo de 760 px eso se pliega en el menú `⋯`
  (`.more-menu`). `src/test/a11y.test.tsx` renderiza `Shell`.

## Comportamiento nuevo

### 1. Dos botones, dos estados

- En `.top-inline`, como primeros controles (antes del idioma):
  1. Ojo (`IconEye` / `IconEyeOff`) → **totales**.
  2. Filas con importes (`IconRows` / `IconRowsOff`) → **transacciones**.
- Cada uno es un `icon-btn` con `aria-pressed` y `title`/`aria-label` con la
  acción siguiente («Hide totals» / «Show totals», «Hide transaction amounts» /
  «Show transaction amounts»). El icono tachado indica el estado oculto.
- En ≤760 px, los dos van al menú `⋯` como `menu-item` con texto e icono, entre
  el tema y «Sign out».
- Estado global, por navegador, en `localStorage`:
  `myexpenses.hideTotals` y `myexpenses.hideTransactions` (`'1'` / `'0'`).
  Por defecto, visibles. No se envía al servidor ni se sincroniza con el móvil.
- Se refleja en `document.documentElement.dataset.hiddenTotals` /
  `dataset.hiddenTransactions` (`'1'` / `'0'`).

### 2. Qué tapa cada botón

| Pantalla | Totales | Transacciones |
|---|---|---|
| Panel | patrimonio, ingresos, gastos, ahorro | filas de últimas transacciones |
| Transacciones | — | importes de fila, sumas de cabecera de periodo, chip de rango de importes |
| Panel de detalle | — | importe, partes y total de partes, caras de una transferencia |
| Gráfico | `title` de cada mes (ingresos y gastos) | — |
| Informes | KPIs, «N groups · X total», filas del desglose | — |
| Drill-down de informe | — | importe de cada transacción |
| Presupuestos | resumen «All budgets» (gastado, asignado, restante) | tarjetas (gastado de asignado, restante), filas por categoría |
| Detalle de presupuesto | progreso, importe del periodo, histórico | — |

Regla para clasificar un importe nuevo: si está en una fila o es el valor de un
movimiento concreto → **transacciones**; si es un resumen o un destacado que se
lee de un vistazo → **totales**. Un importe siempre pertenece a uno de los dos;
nunca a los dos.

### 3. Qué sigue visible (a propósito)

- Porcentajes (`formatPercent`), barras de progreso y la altura de las barras
  del gráfico: son proporciones, no importes absolutos.
- Fechas, descripciones, beneficiarios, categorías, etiquetas, cuentas,
  divisas y estados.
- Contadores y paginación («12 transactions»), tamaños de fichero.
- **Los editores abiertos**: el campo de importe, el saldo pendiente de una
  dividida y la lista de partes que se está editando. Estás escribiendo ese
  número; taparlo haría la edición imposible. Se documenta como excepción.

### 4. Cómo se tapa (sin filtrar el valor)

- El texto se **sustituye**, no se difumina ni se pone transparente: en el DOM
  no queda ningún dígito mientras está oculto, así que una captura, un
  «copiar» o un lector de pantalla no lo recuperan.
- Máscara: símbolo de la divisa + cuatro puntos, p. ej. `€ ••••` (JPY:
  `¥ ••••`). Sale de `maskedMoney()` con `currencySymbol()` de `format.ts`, sin
  `Intl` de importes. Sin signo.
- Accesibilidad: los puntos van `aria-hidden` y un `sr-only` dice «Amount
  hidden», de modo que el lector anuncia que hay una cifra y que está tapada.
- Estilo `.money` / `.money-masked`: `tabular-nums`; la máscara añade un
  `letter-spacing` leve para que el hueco no salte. Hereda color semántico
  (`amount-pos` / `amount-neg`) y tamaño del contenedor. Sin tokens nuevos.

### 5. Piezas de código

- `src/privacy.tsx` (nuevo):
  - `AmountsProvider` (lee `localStorage`, escribe `dataset.hidden*`,
    `useState` para no parpadear), `useAmounts()` → `{ totals, transactions,
    toggle(scope) }`.
  - `useMoney(scope = 'transactions')` → función compatible con
    `formatMoney(amountMinor, currency, fractionDigits, showSign?)` que devuelve
    la máscara cuando ese ámbito está oculto. Es la vía para los importes
    interpolados en macros de Lingui.
  - `<Money scope amountMinor currency fractionDigits showSign className? />`
    para los casos de JSX simple; por dentro, el mismo núcleo.
- `format.ts`: `maskedMoney(currency)` puro y testeable, junto a
  `currencySymbol()`.
- `App.tsx`: envuelve el árbol en `AmountsProvider`; `Shell` consume el contexto
  con `useAmounts()` (sin props nuevas), así que el default del contexto
  (`visible`) deja los tests existentes intactos.
- `Icons.tsx`: `IconEye`, `IconEyeOff`, `IconRows`, `IconRowsOff` con el mismo
  trazo 1,6 / 24 px que el resto.
- Los 8 componentes que hoy llaman a `formatMoney` (todos menos
  `TransactionEditor`, que queda sin tapar) pasan a `useMoney(scope)` o a
  `<Money scope=…>`; ningún sitio nuevo formatea a mano.

### 6. Pruebas y QA

- `src/privacy.test.tsx` (nuevo): `maskedMoney` con EUR y JPY; `<Money>` oculto
  no deja dígitos en el DOM y anuncia «Amount hidden»; cada ámbito se oculta por
  separado; el estado se escribe y se lee de `localStorage`.
- `a11y.test.tsx`: `Shell` con `AmountsProvider` en los cuatro estados, sin
  violaciones graves.
- Mock: `?hidden=1` oculta los dos; `?hidden=totals` y
  `?hidden=transactions` solo uno (el script de `<head>` escribe
  `localStorage` antes de montar, como hace con el tema).
- Comprobación visual en el mock a 1440×900 y 390×844, claro y oscuro, en y es:
  héroe, KPIs, tabla, cabecera de grupo, panel, presupuesto, informe; las cuatro
  combinaciones; recargar; menú `⋯` en móvil; foco visible.
- `npm test`, `npm run build`, `npm run i18n:extract` + `msgstr` en español.

## Criterios de éxito

1. El botón de totales tapa el patrimonio y los KPIs del panel, los KPIs de
   informes, el resumen y el detalle de presupuesto y el `title` del gráfico;
   con él apagado, esos importes vuelven.
2. El botón de transacciones tapa los importes de las filas de Transacciones y
   del panel, las partes, las sumas de cabecera de periodo, el chip de rango,
   las filas del desglose y las tarjetas y categorías de presupuesto.
3. Los dos estados son independientes: ocultar uno deja el otro como estaba, y
   ambos se recuerdan al navegar y al recargar. En un navegador limpio están
   apagados.
4. Con un ámbito oculto, `document.querySelector('.main').innerText` no contiene
   ningún dígito de importe formateado de ese ámbito; solo puntos y el símbolo
   de la divisa.
5. No hay saltos de layout perceptibles al alternar (misma altura de fila y de
   tarjeta) ni scroll horizontal a 390 px.
6. Lectores de pantalla: la cifra tapada se anuncia como cantidad oculta, no
   como cuatro puntos; axe no reporta violaciones graves en ningún estado.
7. `npm test` y `npm run build` pasan; los assets de
   `webui/src/main/assets/webapp` se regeneran con el build, nunca a mano.
8. En el mismo commit: `webui/DESIGN.md`, `webui/webapp/README.md`, `AGENTS.md`
   y este spec.

## Fuera de alcance (V2)

- Un tercer botón «ocultar todo» que junte los dos ámbitos de un clic.
- Ocultar también porcentajes, barras y el propio gráfico.
- PIN, biometría u ocultación automática al perder el foco o tras unos minutos.
- Preferencia persistida en el móvil (tabla de preferencias) y sincronizada.
- Atajo de teclado dedicado.
- Patrimonio sumado de todas las cuentas: hoy el héroe es el saldo de la cuenta
  elegida y «All accounts» existe solo en Informes. Es otra rebanada.

## Límites

- **Siempre**: la máscara sustituye el texto (nada de `opacity`, `blur` ni
  `color: transparent`); los importes ocultos no se quedan en atributos
  visibles (`title`, `aria-label`, `data-*`); el dinero se sigue formateando con
  `Intl` para el estado visible; docs y traducciones en el mismo commit.
- **Preguntar antes**: añadir un token o un patrón de componente nuevo a
  `DESIGN.md`; tocar `/api/v1`, la app Android o el contrato de escritura.
- **Nunca**: mandar el estado al servidor, guardar importes en la URL, editar a
  mano `webui/src/main/assets/webapp`, formatear dinero con concatenación de
  símbolos, ni poner la máscara dentro de los campos de edición.

## Decisiones (18-11-2026)

1. **Dos botones separados** (totales / transacciones), no uno global.
2. **Máscara con divisa** (`€ ••••`), no solo puntos.
3. **Porcentajes y barras siguen visibles.**
4. **Editores abiertos sin tapar** (propuesta aceptada; pendiente de confirmar si
   se quiere lo contrario, sería una línea en `TransactionEditor`).
5. **Botones al principio de la derecha**, antes del idioma; en móvil, al menú
   `⋯`.
