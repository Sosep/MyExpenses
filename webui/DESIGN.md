# Guía de estilos — Web app de MyExpenses

Estado: **v1.0, dirección aprobada**; los detalles abiertos están en §18.
Fecha: 2026-11-17.
Ámbito: la web app de escritorio servida por el servidor Ktor del móvil (`/app`).
Contrato de API: [`API.md`](./API.md).

Esta guía es la fuente de verdad para la interfaz. Los mockups que se
compartieron durante el diseño son exploratorios: si hay conflicto entre un
mockup y este documento, manda este documento.

---

## 1. Decisiones registradas

| Área | Decisión |
|---|---|
| Framework | React + TypeScript + Vite |
| Estilos | Tailwind CSS con tokens en variables CSS; sin hex en componentes |
| Primitivas | Componentes propios sobre Radix (estilo shadcn/ui); por confirmar en la fase 2 |
| Datos de servidor | TanStack Query |
| Tablas | TanStack Table |
| Formularios | React Hook Form + Zod (validación espejo; el servidor manda) |
| Gráficas | Recharts |
| Tipografía | Geist, self-hosted; una sola familia |
| Temas | `Bright` y `Dark`; `data-theme`, `prefers-color-scheme`, persistencia |
| i18n | Lingui con catálogos `.po`; textos fuente en inglés |
| Formato | `Intl.NumberFormat` / `Intl.DateTimeFormat`; dinero en unidades menores |
| Despliegue | Assets estáticos servidos por Ktor en `/app`; sin CDN |
| Autenticación | Sesión por cookie (objetivo); Basic temporal solo para paridad |

---

## 2. Principios

1. **El dinero manda.** La cifra es el elemento principal de cada pantalla; la
   decoración no compite con ella.
2. **Pastel es superficie, no señal.** Los tintes indican el tipo de bloque
   (ingreso, gasto, ahorro, presupuesto); el color semántico se reserva para el
   signo y el estado.
3. **Una sola nota fuerte.** El degradado azul→violeta vive únicamente en la
   marca. Los botones primarios son tinta sólida.
4. **Reglas antes que cajas.** Bordes de 1 px y separación por espacio; no se
   anidan tarjetas ni se sombrea cada fila.
5. **Herramienta, no escaparate.** Densidad de escritorio, teclado, master-detail,
   estados vacíos que invitan a actuar.
6. **El oscuro se diseña, no se invierte.** Elevación por luminosidad y borde,
   tintes profundos, contraste verificado.
7. **La textura no entra en las tarjetas.** La trama de puntos es del lienzo; las
   superficies donde se lee dinero quedan limpias.
8. **Nada se formatea a mano.** Importes, fechas y porcentajes pasan por
   componentes y `Intl`.

---

## 3. Identidad

- Nombre visible: **My Expenses**.
- Marca: cuadrado redondeado de 24-28 px con la sigma (`Σ`) en blanco sobre
  `linear-gradient(135deg, var(--accent), var(--accent-2))`.
- Voz: sobria, directa, en inglés. Sin exclamaciones, sin emoji, sin humor en
  mensajes de error.
- Continuidad con la app Android: azul, sigma, rojo/gasto y verde/ingreso. El
  violeta del degradado es el único añadido de marca.
- Referencia visual inicial (no normativa): dashboards con trama de puntos y
  superficies pastel. Esta guía fija la versión sobria de ese lenguaje.

---

## 4. Tokens

El archivo [`webapp/src/styles/tokens.css`](./webapp/src/styles/tokens.css) es la
fuente única de tokens; la tabla de aquí es su documentación.

### 4.1 Color

| Token | Bright | Dark | Uso |
|---|---|---|---|
| `--bg-canvas` | `#F7F8FB` | `#0B0D12` | Fondo del área de contenido, con trama |
| `--bg-surface` | `#FFFFFF` | `#141821` | Tarjetas, barras, campos sobre lienzo |
| `--bg-rail` | `#F1F3F8` | `#0E1118` | Barra lateral |
| `--bg-sunken` | `#EEF1F6` | `#10141C` | Cabeceras de tabla, tracks, inputs |
| `--text-primary` | `#0D1220` | `#EDF1F7` | Texto y cifras |
| `--text-secondary` | `#475467` | `#C3CBD8` | Texto de apoyo |
| `--text-muted` | `#667085` | `#98A2B3` | Metadatos, etiquetas, ejes |
| `--border-subtle` | `#E7EAF1` | `#242B38` | Separadores y bordes de tarjeta |
| `--border-strong` | `#D0D5DD` | `#303A4A` | Controles en hover, divisores fuertes |
| `--accent` | `#2F6BFF` | `#6EA0FF` | Gráficas, foco, nav activa, enlaces gráficos |
| `--accent-ink` | `#1F5AE0` | `#8CB6FF` | Texto y enlaces sobre superficie |
| `--accent-2` | `#8B5CF6` | `#B79BFF` | Solo degradado de marca |
| `--positive` | `#0B7A53` | `#4ADE80` | Ingresos, saldo a favor, conciliado |
| `--negative` | `#C2413B` | `#FF8A80` | Gastos, sobregiro, destructivo |
| `--warning` | `#B45309` | `#FBBF24` | Presupuesto en riesgo, avisos |
| `--tint-lavender` | `#F0EDFF` | `#1A1730` | KPI de ahorro, selección suave |
| `--tint-mint` | `#E6F7F0` | `#0F241C` | KPI de ingresos, estado correcto |
| `--tint-rose` | `#FFF0EF` | `#2A1618` | KPI de gastos, estado de error |
| `--tint-sky` | `#E9F1FF` | `#101E33` | KPI neutro, fila seleccionada |
| `--tint-cream` | `#FFF6E6` | `#241D10` | Presupuesto, aviso suave |
| `--cat-1` | `#8B5CF6` | `#B79BFF` | Categoría 1 (gráficas y puntos) |
| `--cat-2` | `#2F6BFF` | `#6EA0FF` | Categoría 2 |
| `--cat-3` | `#D97706` | `#FBBF24` | Categoría 3 |
| `--cat-4` | `#0EA5A4` | `#2DD4BF` | Categoría 4 |
| `--cat-5` | `#94A3B8` | `#64748B` | Categoría 5 / "Otros" |
| `--dots` | `rgba(13,18,32,.09)` | `rgba(255,255,255,.07)` | Trama del lienzo |
| `--shadow-card` | `0 1px 2px rgba(13,18,32,.04), 0 8px 24px rgba(13,18,32,.03)` | `0 1px 0 rgba(255,255,255,.03) inset, 0 12px 32px rgba(0,0,0,.35)` | Tarjetas y paneles |

Reglas de color:

- Los importes usan `--positive` / `--negative`. Nunca se colorea la cifra
  principal de una tarjeta KPI: va en `--text-primary`.
- `--accent` no se usa para texto pequeño; para eso está `--accent-ink`.
- Los colores categóricos (`--cat-*`) solo van en gráficas, puntos de categoría y
  barras. Nunca en texto.
- Los tintes son fondos. El texto sobre ellos es `--text-primary` o el semántico
  oscuro correspondiente; nunca un tinte como color de texto.
- No se inventa un color nuevo sin añadirlo aquí y a `tokens.css`.

### 4.2 Tipografía

Familia única: **Geist** (400/500/600), self-hosted en `woff2`. Sin fuentes de
CDN. Números tabulares en toda cifra.

| Rol | Tamaño | Peso | Interlineado | Uso |
|---|---|---|---|---|
| Caption | 11 px / .6875rem | 400 | 1.4 | Metadatos, ayudas, notas |
| Label | 12 px / .75rem | 500 | 1.3 | Etiquetas de campo, chips |
| Body | 14 px / .875rem | 400 | 1.5 | Texto general, celdas |
| Body strong | 14 px | 500 | 1.5 | Énfasis, nombres de fila |
| Title | 16 px / 1rem | 600 | 1.25 | Título de tarjeta, sección pequeña |
| Section | 20 px / 1.25rem | 600 | 1.25 | Título de página secundaria |
| Page | 28 px / 1.75rem | 600 | 1.15 | Título de pantalla |
| Figure | 40 px / 2.5rem | 600 | 1.05 | Patrimonio en dashboard |
| Table header | 11 px | 500 | 1.2 | MAYÚSCULAS, tracking .04em |
| KPI label | 11 px | 500 | 1.2 | MAYÚSCULAS, tracking .04em |
| Money | heredado | 500 | 1.2 | `font-variant-numeric: tabular-nums` |

Reglas:

- Mayúsculas solo en cabeceras de tabla y etiquetas de KPI. El resto, sentence
  case. Los botones también.
- Cifras grandes con `letter-spacing: -0.02em` a `-0.03em`. El resto, 0.
- No se usa cursiva para énfasis. No se subraya salvo enlaces.
- Los importes llevan signo (`+`/`−`) y separador de miles del locale.
- Ancho de línea de texto: 60-75 caracteres. Los párrafos largos no ocupan todo
  el ancho de una tabla.

### 4.3 Espacio, radios, bordes, sombras

- Escala de espacio: **2, 4, 8, 12, 16, 24, 32, 48, 64** px (base 4).
- Padding de página: 24 px escritorio, 16 px tablet, 12 px móvil.
- Padding de tarjeta: 16 px; compacto 12 px.
- Separación entre bloques: 24 px; dentro de una tarjeta, 12-16 px.
- Radios: `--radius-card` **12**, `--radius-control` **10**, `--radius-small` **8**,
  `--radius-pill` **999**.
- Bordes: 1 px `--border-subtle`. En hover de controles, `--border-strong`.
- Sombras: solo `--shadow-card` en tarjetas y paneles. Las filas de tabla no
  llevan sombra. No se usa sombra para jerarquía.
- Elevación: en oscuro, la superficie sube de `canvas` a `surface`; no se simula
  con sombras grandes.
- Tipografía: `--font-sans` (Geist); no se define una familia mono para la UI.

### 4.4 Textura

- Trama de puntos solo en el lienzo principal:
  `radial-gradient(circle at 1px 1px, var(--dots) 1px, transparent 0)`,
  `background-size: 16px 16px`.
- Nunca dentro de tarjetas, tablas, paneles ni modales.
- En oscuro baja a `rgba(255,255,255,.07)`; si compite con el contenido, se baja
  a `.05`.

---

## 5. Tema

- `data-theme="light"` (Bright) y `data-theme="dark"` en `<html>`.
- Por defecto, `prefers-color-scheme`; la elección del usuario se guarda en
  `localStorage` y gana sobre el sistema.
- `color-scheme` se ajusta para que los controles nativos acompañen.
- Sin parpadeo: un script mínimo en `index.html` aplica el tema antes de montar
  React.
- Las gráficas consumen variables CSS; si una librería exige valores resueltos
  (canvas), se leen con `getComputedStyle` al cambiar el tema.
- Prohibido invertir con `filter: invert()`. Cada tema tiene sus tokens.
- Los tintes oscuros son profundos, no versiones apagadas del claro. El texto
  mantiene contraste AA.

---

## 6. Layout y shell

Las medidas de esta sección son las reales de la app. Los mockups compartidos
durante el diseño estaban reducidos para caber en el chat; no se toman sus
píxeles como especificación.

```text
┌──────────────────────────────────────────────────────────────┐
│ Σ My Expenses   Transactions          Search   Nov 2026   M  │ 48
├─────┬────────────────────────────────────────────────────────┤
│  ▣  │  Transactions                          Filters  New    │
│  ≡  │  ┌──────────────────────────────────────────────────┐  │
│  ◔  │  │ filters / content                                │  │
│  ↕  │  │                                                  │  │
│     │  └──────────────────────────────────────────────────┘  │
└─────┴────────────────────────────────────────────────────────┘
  56                         padding 24
```

- Topbar: 48 px, `--bg-surface`, borde inferior de 1 px. Marca a la izquierda; cuenta a la
  derecha y, en pantallas estrechas, un menú `⋯` con idioma, tema y sesión. El nombre de la
  vista no se repite en la barra: lo dice el H1 de cada pantalla. Los dos botones
  de privacidad (ojo y filas) van los primeros, antes del idioma.
- Rail: 56 px, `--bg-rail`, iconos de 18 px y pill activa de 36 px. Secciones:
  Overview, Transactions, Reports, Budgets, Files; Settings abajo. En móvil se
convierte en una barra inferior fija con icono y etiqueta, y el contenido reserva
espacio para no quedar tapado.
- Con una **cartera** seleccionada (`portfolioRole = CONTAINER`) el rail muestra
  Overview, Transactions, Reports y Files: Budgets se oculta porque la cartera no
  usa categorías. El selector de cuenta lista contenedores y cuentas normales,
  nunca sus subcuentas de efectivo o activo.
- Contenido: ancho máximo 1440 px; grid de 12 columnas, gap 16 px.
- Panel lateral de edición: 380-420 px, sticky, con cabecera y pie fijos.
- Breakpoints: 1280, 1024, 768, 560.
  - < 1024: se reduce el padding y el panel pasa a 360 px.
  - < 768: el rail se convierte en drawer; el panel de edición pasa a página
    completa.
  - < 560: una columna; las tablas se convierten en lista de tarjetas.
- Una sola acción primaria por pantalla. Las secundarias, ghost.
- Filtros, cuenta, periodo y agrupación viven en la URL.

### Densidad

- Por defecto: filas de tabla **44 px**, padding de tarjeta 16.
- Compacta (si se añade): filas de **36 px**, padding 12. Se guarda por usuario.
- Alturas de control: `--control-h` 36 px con ratón y 44 px con el dedo (`pointer: coarse`);
  `--field-h` 40 px y 44 px. Las definen los tokens, no cada componente.

---

## 7. Componentes

### Botones

| Variante | Aspecto | Uso |
|---|---|---|
| Primary | Fondo `--text-primary`, texto `--bg-canvas` | Guardar, crear, confirmar |
| Secondary | `--bg-surface` + borde 1 px | Acciones neutras |
| Ghost | Sin fondo ni borde, texto `--text-muted` | Cancelar, filtros, acciones terciarias |
| Destructive | Fondo `--negative`, texto blanco | Borrar de forma irreversible |
| Dashed | Borde discontinuo, texto muted | Añadir parte, añadir fila |

- Altura 36; radio 10; icono 16; gap 6; padding horizontal 12.
- Sentence case: "Save", "New transaction", "Add part". Nunca "Submit".
- Deshabilitado: opacidad .5 y sin sombra; el motivo se explica al lado, no solo
  con el botón gris.
- Foco: anillo de 2 px `--focus-ring` (color sólido, ≥3:1 sobre las cuatro superficies)
  con offset 2.
- Un solo primary por vista. Los botones de peligro no se ponen al lado del
  primary sin separación visual.

### Campos

- Los desplegables con datos (cuenta, beneficiario, categoría, método, periodo)
  usan un combobox con búsqueda: al enfocar se abre la lista, al escribir se
  filtra sin distinguir mayúsculas ni acentos, y solo cambia el valor al elegir
  una opción. `Enter` selecciona, `Esc` cierra y `↑`/`↓` recorren.
- El valor vacío es una opción más (`None`/`No category`). Sin coincidencias se
  muestra `No matches` dentro del menú.

- Altura 36; radio 10; borde `--border-subtle`; fondo `--bg-surface` dentro de
  tarjeta y `--bg-sunken` sobre lienzo.
- Etiqueta 12 px, sentence case, `--text-muted`; ayuda 12 px; error 12 px en
  `--negative`.
- Foco: borde `--accent` + anillo de 2 px.
- Error: borde `--negative` y mensaje debajo; no se usa solo el color.
- Importe: alineado a la derecha, tabular, con signo; el símbolo de divisa queda
  fijo a la izquierda o en la cabecera de la columna.
- Fecha: `YYYY-MM-DD` internamente; se muestra con `Intl` ("17 Nov 2026").
- Selector: chevron a la derecha; búsqueda cuando hay más de 8 opciones.
- Etiquetas: chips dentro del campo, con `#` y botón de quitar.

### Chips, pills y tags

- Altura 24; radio 999; texto 12; icono 12.
- Estados: `ok` (mint/positive), `warn` (rose/negative), `warning` (cream/warning),
  `neutral` (sunken/muted), `info` (sky/accent-ink).
- Píldora de categoría: punto de 5 px con `--cat-*` + etiqueta. El color no es la
  única señal: siempre hay texto.
- Tag: `#nombre`, fondo sunken, sin color semántico.
- No se usan pills para acciones; para eso, botones.

### Tarjetas

- Fondo `--bg-surface`, borde 1 px, radio 12, `--shadow-card`, padding 16.
- Título 16/600; subtítulo 12 muted; acción a la derecha.
- No se anidan tarjetas. Si hace falta agrupar, se usa una sección con título y
  separadores.
- Variante KPI: tinte de fondo, sin borde visible, cifra en `--text-primary`,
  etiqueta 11 en mayúsculas, delta semántico y sparkline opcional.
- La tarjeta KPI no lleva degradado ni sombra fuerte.

### Tablas

- Cabecera sticky, 40 px, fondo `--bg-sunken`, 11 px mayúsculas, tracking .04em.
- Filas 44 px (36 compactas), separador de 1 px, sin cebra.
- Hover: `--bg-canvas`; selección: `--tint-sky` + inset 2 px `--accent`.
- Importes a la derecha, tabulares. Fechas a la izquierda. Texto, izquierda.
- Columnas recomendadas: Date 96, Description 1fr, Category 180, Tags 160,
  Amount 120, Balance 120.
- Cabecera de mes (agrupación): 56 px, dos líneas: nombre + totales; debajo, barra
  de reparto por categorías de 4 px y leyenda.
- Cabecera de grupo (agrupación de la lista): fila de tabla con fondo
  `--bg-sunken`, título del periodo, las sumas distintas de cero (ingresos en
  verde, gastos en rojo, transferencias en neutro, cada una con `title`) y un
  control de plegado. No sticky: plegar ya basta para situarse.
- Barra de la lista: chips de rango (`Historial`, `Este mes`, `Últimos 3
  meses`, `Este año`, `Desde / hasta`) y, a la derecha, «Agrupar por» con un
  `select` nativo (enum corto). En móvil el select baja a la segunda línea.
- Acciones por fila: al hover o en un menú de tres puntos; no se llena la fila de
  iconos.
- Paginación por cursor o "Load more"; se muestra el total cuando se conoce.
- Nunca se suman páginas en cliente para un total: el total viene del servidor.

### Segmentado, switch, progreso

- Segmentado: altura 32, fondo sunken, opción activa en surface con sombra
  mínima. Se usa para filtros y tipo (All / Expenses / Income).
- Switch: 36×20, track `--border-strong`, activo `--accent`, knob blanco.
  Siempre con etiqueta; no se usa como único indicador.
- Progreso: track 6 px, radio 999, relleno semántico. Se muestra porcentaje y
  resto ("78% · €88 left"). Si supera 100%, el relleno es `--negative` y el texto
  dice "Over by €26". No se recorta el número.

### Privacidad de importes

- Dos `icon-btn` al principio del grupo derecho de la topbar (y dos entradas del
  menú `⋯` en móvil): **Totales** (`IconEye`/`IconEyeOff`) y **Transacciones**
  (`IconRows`/`IconRowsOff`). `aria-pressed` con el estado y tooltip con la
  acción siguiente.
- Estado por navegador (`myexpenses.hideTotals`, `myexpenses.hideTransactions`),
  apagado por defecto; no viaja al servidor.
- Con un ámbito tapado el importe se **sustituye** por `€ ••••`
  (`maskedMoney()`): no queda ningún dígito en el DOM. Los puntos van
  `aria-hidden` y un `sr-only` dice "Amount hidden" (en `<Money>`; dentro de una
  frase extraída la máscara sustituye al número). Prohibido `blur`, `opacity` o
  `color: transparent`.
- Ámbito de cada botón:
  - **Totales**: patrimonio del héroe, KPIs del panel y de informes, cabeceras de
    periodo, "N groups · X total", desglose de informes, tooltip del gráfico y
    resumen, tarjetas y detalle de presupuesto.
  - **Transacciones**: importes de fila (lista, últimas del panel, drill-down),
    panel de detalle, partes y total de partes, y el chip de rango de importes.
- Nunca se tapan los campos de un editor abierto (`TransactionEditor`,
  `BudgetEditor`). Porcentajes, barras, fechas, descripciones y contadores siguen
  visibles.

### Gráficas

- Línea/área: `--accent`, 1.5-2 px, área con degradado de opacidad .30 a 0.
- Barras: categóricas o semánticas; radio 2-4 en la parte superior; sin 3D.
- Rejilla: solo horizontal, discontinua, `--border-subtle`; sin rejilla vertical.
- Ejes: 11 px muted; sin líneas de eje fuertes.
- Leyenda: punto + etiqueta; máximo 5 series y "Other".
- Donut: solo para parte-de-un-todo; máximo 5 porciones + Other; centro con el
  total si aporta.
- Tooltip: fondo surface, borde, sombra de tarjeta; cifra tabular.
- Sin datos: mensaje y acción, no una gráfica vacía con ejes.
- Sin animaciones de entrada salvo una sola, corta (≤300 ms) y respetando
  `prefers-reduced-motion`.

### Paneles y diálogos

- Edición: panel lateral de 380-420 px, no modal. Cabecera con título y cierre,
  pie sticky con Cancel/Save.
- Diálogo: solo para confirmaciones destructivas y selectores pequeños; ancho
  máximo 480; nombre del objeto en el título ("Delete split transaction?").
- `Esc` cierra; foco atrapado; al cerrar, el foco vuelve al disparador.
- En móvil, el panel pasa a página completa.

### Toasts y banners

- Toast: abajo a la derecha, 4 s, una acción como máximo; los errores no
  desaparecen solos.
- Banner: arriba del contenido, ancho completo, para "no se puede alcanzar el
  móvil"; incluye Reintentar y no tapa la navegación.
- No se usa toast para errores de validación de formulario; van junto al campo.

---

## 8. Patrones de pantalla

### Dashboard

```text
Page title · period                         Export   New transaction
┌ Net worth (hero) ┬ Income ┬ Expenses ┬ Saved ┐
│ €12,480.35       │ mint   │ rose     │ lav   │
└──────────────────┴────────┴──────────┴───────┘
┌ Net worth trend (2/3)            ┬ Budgets (1/3) ┐
│ area chart                       │ 3 progress     │
└──────────────────────────────────┴────────────────┘
┌ Recent transactions ─────────────────────────────┐
└──────────────────────────────────────────────────┘
```

- Una sola petición `GET /dashboard?month=` que devuelve todo agregado.
- El patrimonio es el héroe; las tres tarjetas KPI son el contexto del mes.
- Presupuestos con estado explícito (en curso, en riesgo, sobregirado).
- Últimas transacciones: 5-8, con enlace a la lista.
- Si hay varias divisas, el patrimonio se muestra en la divisa base y se avisa.

### Carteras (overview y operaciones)

```text
Overview · Investments                     Transactions   Refresh
┌ Valuación (hero) ┬ Efectivo ┬ Activos ┐
│ €1,100.00        │ €250.00  │ €875.00 │
└──────────────────┴──────────┴─────────┘
┌ Activos ──────────────────────────────────────┐
│ Activo · Cantidad · Precio · Valoración        │
│ Apple Inc. 3 AAPL   5 EUR     €15.00 ▓░░░░     │
└───────────────────────────────────────────────┘
```

- El héroe es la **valoración** (saldo del contenedor + efectivo + activos al
  último precio guardado); efectivo y activos son las tarjetas de contexto. Las
  cifras salen de `GET /portfolios/{id}/assets`, nunca de sumar filas aquí.
- Cada activo muestra cantidad con los dígitos de su divisa, precio real en la
  divisa de la cartera y una barra fina (`asset-share`) con su peso en la
  valoración. La valoración y los precios responden a la privacidad `totals`.
- Las operaciones (`Buy/Sell/Deposit/Withdraw/Transfer`) se listan con palabra,
  no icono; cantidad y precio en columnas a la derecha; la fila abre el panel de
  detalle (historial, como la transacción). El importe principal es una magnitud
  sin signo: la palabra del tipo ya dice la dirección. En móvil se ocultan
  activo, precio, comisión y contraparte; la tabla no provoca scroll horizontal.
- El botón `+` abre un panel con segmentado **Account | Portfolio**. Una cartera
  pide nombre, tipo (default INVESTMENT), divisa y, si la divisa no es la base,
  cambio fijo o dinámico (sin saldo de apertura ni «excluir de totales»). El
  aviso `Price of one USD in EUR.` interpola las divisas activas.
- Las divisas que no son ISO-4217 (AAPL, BTC) se formatean como número + código
  cuando `Intl` no acepta el estilo de moneda; la cantidad usa los dígitos de la
  divisa del activo.
- El **editor de operaciones** (`TradeEditor`) usa el mismo panel lateral que la
  transacción: segmentado con los seis tipos (Compra, Venta, Depósito,
  Retirada, Traspaso a otra cartera, Entrada por traspaso), activo con
  sugerencias, cantidad y precio decimales, importe calculado en una
  `summary-strip`, comisión y financiación. En edición precarga los valores y
  añade `Delete` a la izquierda del pie; guardar cierra el panel y refresca.
  El detalle de la operación gana `Edit` y `Delete`, y el editor se abre encima
  del detalle para no encadenar entradas de historial.

### Transacciones agrupadas por mes

```text
Filters: [search] [account] [All|Expenses|Income] [Month]
┌ November 2026        −€2,777.90  +€3,120.00  +€342.10 ┐
│ ▓▓▓▓▓▓▓░░░░░░  Housing 34% · Groceries 22% ...        │
├ Date · Description · Category · Tags · Amount · Balance┤
│ 14 Nov  Mercadona   Groceries  #weekly  −64.20  4,210.80│
└───────────────────────────────────────────────────────┘
```

- La cabecera de mes lleva totales y reparto por categorías; es el "desglose".
- Fila seleccionada abre el panel de edición; no se navega a otra página.
- Acciones en lote al seleccionar varias filas (barra contextual).
- El saldo acumulado se calcula en servidor o se recibe ya calculado; no se
  recalcula sobre la página visible.
- Búsqueda y filtros en la URL, compartibles.

### Filtros de transacciones

- Sobre la tabla, cuatro `SearchSelect`: categoría, beneficiario, etiqueta y
  método. Todos incluyen `All` y se combinan con AND.
- Al filtrar se oculta el resumen mensual (los KPIs no están filtrados) y el
  contador de la cabecera muestra las transacciones que cumplen.
- `Clear filters` aparece solo cuando hay algún filtro.
- En móvil la rejilla pasa a dos columnas y el botón ocupa la fila completa.

### Transacción simple (editor)

```text
┌ New transaction ──────────────────────────────┐
│ [Expense | Income]      [ 0.00        EUR ]   │
│ Account [Everyday]      Date [17 Nov 2026]    │
│ Payee [Mercadona]       Method [Card]         │
│ Category [Food > Groceries]                   │
│ Tags [#weekly] [#home]                        │
│ Reference [________]                          │
│ Note [________________________]               │
│                               Cancel   Save   │
└───────────────────────────────────────────────┘
```

- Panel lateral, no modal; el importe es el héroe y el signo va separado.
- El importe se escribe en unidades mayores y se convierte a menores con los
  `fractionDigits` de la cuenta; nunca se redondea con `parseFloat` al persistir.
- Fecha, hora y fecha valor siguen las preferencias del móvil y el tipo de
  cuenta: las cuentas `CASH` no muestran fecha valor.
- Categoría con la ruta completa; etiquetas como chips; método filtrado por tipo
  de cuenta y signo.
- Validación en vivo y errores 422 por campo; `Ctrl/Cmd+Enter` guarda, `Esc`
  cierra y confirma si hay cambios.
- Tras guardar se refrescan cuenta(s), resumen y lista, y se muestra un toast
  breve. El editor no recarga la página.
- Transferencias y divididas tienen editores propios; este formulario no mezcla
  tipos.

### Transferencia (editor)

```text
┌ Transfer ────────────────────────────────────┐
│ [ 0.00                              EUR ]    │
│ From [Everyday]          To [Joint]          │
│ Date [17 Nov 2026]       Time / Value date   │
│ Payee [None]             Method [Card]       │
│ Reference [________]                         │
│ Note [________________________]             │
│                          Cancel   Save      │
└─────────────────────────────────────────────┘
```

- El importe es una magnitud positiva; el servidor crea las dos caras con el
  mismo `uuid` y las enlaza.
- Origen y destino deben ser cuentas distintas. Se pueden cambiar al editar.
- Fecha, hora y fecha valor siguen las preferencias y la cuenta de origen.
- No hay categoría: una transferencia no es ingreso ni gasto.
- Tras guardar se refresca la lista; la otra cara aparece en su cuenta.

### Transacción dividida

```text
┌ Transaction (parent) ────────────────┬ Part 2 of 3 ──────┐
│ Account  Date  Amount                │ Amount  −25.00   │
│ Payee    Method Tags                 │ Category › ...   │
│ Note                                 │ Tags  Note       │
├ Parts ───────────────────────────────┤ Share of total   │
│ Groceries   Mercadona   −64.20       │ ▓▓▓░░░  25%      │
│ Household   —           −25.00  [sel]│ Remove   Apply   │
│ Treats      —           −10.80       │                  │
│ €0.00 left              Total −100.00│                  │
│ + Add part                           │                  │
└──────────────────────────────────────┴──────────────────┘
```

- El editor es un panel ancho (`760px`) con el padre y las partes a la izquierda
  y la parte seleccionada a la derecha; en móvil se apila.
- Mismo formulario para crear y editar; al crear, una parte vacía y el total sin
  rellenar. Al editar, las partes existentes conservan su `id`; las nuevas no
  llevan `id` y las omitidas se borran.
- Los importes del padre y de las partes van **con signo** para no perder
  divididas mixtas. La suma se valida en vivo con el indicador `Balanced` o
  `X left`; el servidor la revalida y devuelve `422` si no cuadra.
- La cuenta del padre queda fija al editar (`422` si se intenta mover); el
  servidor mantiene todas las partes en la misma cuenta.
- "Split equally" queda como acción secundaria pendiente.
- La parte seleccionada se edita en el panel derecho; el contexto del padre
  permanece visible.
- Las partes con transferencia se añaden en v2 y se marcan como tales.
- El servidor valida la suma otra vez; nunca se confía solo en el cliente.

### Informes

```text
Reports                                   ‹ November 2026 ›  [Refresh]
Everyday · November 2026
[Category | Payee | Tag]   [Expenses | Income | Both]

┌ Income €2,950 ┐ ┌ Expenses €1,138 ┐ ┌ Net +€1,811 ┐ ┌ 59 tx ┐

┌ Spending by category · 7 groups · €1,138.67 total ──────┐
│ Food > Groceries                         €324.07      │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░                        │
│ 28.5%                                  15 transactions │
│ Transport                                €242.48      │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
│ 21.3%                                  14 transactions │
└────────────────────────────────────────────────────────┘
```

- Mes visible con navegación `‹ ›`; el mismo mes manda en KPIs y desglose.
- Tres segmentados: periodo (`This month`, `Last 3 months`, `This year`),
  dimensión (`Category`, `Payee`, `Tag`, `Method`) y tipo (`Expenses`, `Income`,
  `Both`). Con `All accounts` se agrega en servidor y se convierte a la divisa
  base, así que admite cuentas de divisas distintas.
- KPIs: ingresos, gastos (magnitud), neto con signo y número de transacciones.
- Cada fila: etiqueta, importe, barra proporcional, porcentaje y número de
  transacciones. La barra usa `--negative` para gastos, `--positive` para
  ingresos y `--accent` para `Both`.
- El porcentaje y el total vienen del servidor; el cliente no suma transacciones.
- Vacío: explica que no hay actividad y sugiere cambiar de mes o de tipo.
- El badge de etiqueta puede solaparse entre sí; es un reparto por etiqueta, no
  una partición del gasto.
- Cada fila abre un panel de detalle con las transacciones del grupo. Con
  `All accounts` el detalle se desactiva: necesita una sola cuenta.

### Presupuestos

```text
November 2026                     All budgets
€678.30 spent   €950.00 allocated   €271.70 left
▓▓▓▓▓▓▓░░░

┌ Groceries ────────────────┐  ┌ Restaurants ────── Over ┐
│ Everyday · Monthly        │  │ Everyday · Monthly      │
│ November 2026             │  │ November 2026           │
│ €312.00 of €400.00        │  │ €146.00 of €120.00      │
│ €88.00 left               │  │ Over by €26.00          │
│ ▓▓▓▓▓▓▓▓░░  78% used      │  │ ▓▓▓▓▓▓▓▓▓▓  100% used   │
│ 14 days left              │  │ 14 days left            │
└───────────────────────────┘  └─────────────────────────┘
```

- La pantalla tiene navegación `‹ mes ›`; los presupuestos mensuales cargan ese
  mes (progreso, asignaciones y total específico). Los de otras agrupaciones
  muestran su periodo actual.
- El resumen superior solo aparece si todos los presupuestos comparten divisa y
  periodo; si no, se muestra cada tarjeta por separado con una nota.
- Cada tarjeta lleva su propio periodo (`November 2026`), cuenta, agrupación
  (`Monthly`, `Weekly`, `Yearly`, `Daily`, `One-time`) y días restantes.
- El estado de sobregiro es explícito: chip "Over" + "Over by €26"; no solo un
  color. La barra se llena al 100% y pasa a color negativo.
- Importes con `fractionDigits` de la divisa del presupuesto; nada se suma en
  cliente salvo las filas ya calculadas por el servidor.
- Alta y edición en panel lateral: título, cuenta, tipo de periodo, fechas para
  `One-time`, importe, `Uso como presupuesto por defecto` y nota.
- Al editar, cuenta y periodo quedan fijos (el servidor los rechaza si cambian);
  el importe se rotula `Default amount` porque solo cambia la asignación por
  defecto, no los overrides por periodo.
- `Delete` y `Duplicate` viven en el pie del editor; borrar pide confirmación.
  Tras guardar, duplicar o borrar se refresca la lista y se muestra un toast.
- La asignación por categorías se edita en el mismo panel: lista con sangría por
  nivel y un importe por categoría para el periodo actual. Se guarda junto al
  presupuesto. El rollover sigue en la app Android.
- `Detalle` abre un panel de lectura (mismo patrón `panel`, 380-420 px) con el
  progreso, el gasto por categoría, el importe del periodo y los últimos 12
  meses. Sustituye al antiguo botón `Historial`: una sola puerta al detalle.
- El reparto lista solo categorías con gasto y **no anuncia las que quedan a
  cero**. Con jerarquía, la madre va arriba con su total y las hijas debajo con
  sangría; la cifra de la madre ya incluye a las hijas, de modo que el total
  cuenta cada euro una vez.
- Bajo la cabecera del panel, una línea dice el filtro del presupuesto
  (`Filtro: Comida, Supermercado · Conciliado`) o `Sin filtro: toda la cuenta`.
  Es la explicación de por qué el reparto es el que es.
- El editor incluye una sección `Filtro` con categorías, beneficiarios, métodos,
  etiquetas y estado, los mismos cinco criterios que la app Android, y un
  resumen `Sin filtro: toda la cuenta` / `n filtros`. Si el presupuesto trae un
  filtro que la web no puede expresar, el editor lo dice y no lo reescribe.

### Datos de la app

- Vista `?view=datos` con pestañas segmentadas (`Categorías · Métodos ·
  Etiquetas · Divisas · Precios`) sobre una tarjeta por entidad; el botón de
  ajustes del rail la abre.
- Categorías en árbol: sangría por `level`, tipo con texto (Gasto/Ingreso/
  Neutro), `+ Nueva categoría` en la cabecera. Al borrar una categoría con
  movimientos, el panel «Borrar categoría» pide el destino con `SearchSelect`
  antes de mover y borrar; el `409` nunca deja la categoría a medias.
- Divisas: tabla código/símbolo/dígitos/tipo; el alta pide el código y la
  edición no (es la clave). Precios: selector de activo (solo no fiat), tabla
  fecha/valor/fuente y panel fecha+precio; guardar reemplaza el precio manual
  de esa fecha.
- En móvil las pestañas hacen wrap y la tabla conserva sus columnas (sin
  scroll horizontal); los paneles son de ancho completo como el resto.

### Maestros

- Categorías: árbol con indentación; arrastrar para mover en v2; acciones
  Mover/Fusionar/Borrar en menú.
- Payees: tabla con nombre, nombre corto, IBAN/BIC; no confundir con la
  contraparte de una transferencia.
- Tags: tabla simple; color opcional.
- Métodos: etiqueta, tipo (neutral/ingreso/gasto) y tipos de cuenta.
- Todos usan el mismo patrón: lista + panel de edición, con búsqueda.

### Login

- Pantalla centrada, marca, un campo de contraseña y "Sign in".
- Sin diálogo Basic del navegador; sesión por cookie.
- Error genérico ("Wrong password") sin filtrar detalles.
- Tras 3 fallos, espera progresiva (servidor).

### Descargas

```text
Files                                     [Refresh]
Backups and exports stored on the phone

NAME                              SIZE     MODIFIED          ACTION
myexpenses-2026-11-17.backup      472 KB   17 Nov 2026, 09:12 [↓ Download]
expenses-november-2026.csv         18 KB   16 Nov 2026, 18:40 [↓ Download]
```

- Lista de ficheros con nombre, tamaño, fecha y acción Download; el botón muestra
  `Downloading…` mientras descarga.
- La fecha se muestra en local con día, mes, año, hora y minuto; el tamaño se
  reduce a B/KB/MB/GB.
- Estado vacío: explica que los ficheros aparecen tras exportar o hacer backup.
- No se muestra la ruta interna.
- La descarga se pide con `fetch` y se guarda como blob para conservar la
  autenticación; un fallo muestra un banner, no pierde la lista.
- En móvil se oculta la columna `Modified` y Download queda como botón de icono
  para que la tabla no desborde.

---

## 9. Estados

| Estado | Tratamiento | Ejemplo de copy |
|---|---|---|
| Vacío | Una frase + acción primaria; sin ilustración grande | "No transactions in November." · "Add transaction" |
| Cargando | Skeleton con la forma del contenido; sin spinner de página | Filas grises con las mismas columnas |
| Error de validación | Inline, junto al campo, con el motivo | "The split total must equal €100.00." |
| Error de servidor | Banner o inline; no se pierde lo escrito | "Could not save. Try again." |
| Móvil inalcanzable | Banner bloqueante con Reintentar | "Can't reach the phone. Check that My Expenses is open and on the same network." |
| Sin permisos | Explica qué falta y cómo resolverlo | "This module is not installed. Enable it in Settings." |
| Éxito | Toast breve o cambio visible en la lista | "Transaction saved." |

- No se muestran datos obsoletos como si fueran actuales. Si se cachea, se indica
  "Updated 2 min ago".
- Los skeletons respetan el layout final para evitar saltos.
- Los errores no culpabilizan ni usan signos de exclamación.

---

## 10. Interacción y teclado

| Tecla | Acción |
|---|---|
| `N` | Nueva transacción |
| `/` | Foco en búsqueda |
| `J` / `K` | Siguiente / anterior fila |
| `Enter` | Abrir edición de la fila activa |
| `Esc` | Cerrar panel, diálogo o búsqueda |
| `Ctrl/Cmd + Enter` | Guardar el formulario |
| `Delete` | Borrar con confirmación |
| `?` | Ayuda de atajos |
| `G` luego `T` / `B` / `R` | Ir a Transactions / Budgets / Reports |

- Los atajos no se activan mientras el foco está en un campo de texto, salvo
  `Esc` y `Ctrl/Cmd+Enter`.
- Toda acción disponible por ratón debe serlo por teclado.
- El foco visible siempre; nunca `outline: none` sin sustituto.
- Selección múltiple: checkbox en la primera columna, barra contextual con
  acciones y contador.
- Optimista solo para acciones reversibles (borrar con deshacer, marcar). Las
  escrituras de dinero esperan al servidor.

---

## 11. Accesibilidad

- Contraste mínimo AA: 4.5:1 en texto normal, 3:1 en texto grande y elementos
  gráficos esenciales.
- El color no es la única señal: signo, etiqueta, icono y texto acompañan.
- Foco de 2 px `--focus-ring` sólido, offset 2; visible en ambos temas y con ≥3:1 en cada
  superficie. En filas y tarjetas clicables se añade una marca además del fondo.
- Objetivos táctiles de 44×44 px como mínimo con puntero grueso (36 px con ratón), aunque el
  uso sea de escritorio.
- HTML semántico: `button`, `label`, `table`, `th scope`, `aria-live` para toasts.
- Diálogos y paneles con foco atrapado y retorno al disparador.
- `prefers-reduced-motion`: sin animaciones de entrada; transiciones ≤150 ms.
- RTL: propiedades lógicas (`margin-inline-start`, `padding-inline`, `inset-inline`)
  y `dir` en `<html>`. Los iconos de dirección (atrás, chevron) se voltean; los
  de estado (check, candado) no.
- Probado con teclado y con axe; sin depender de hover.

---

## 12. i18n y formato

- Lingui con catálogos `.po`. Los textos fuente se escriben en inglés en el
  código y se extraen; no se traducen a mano en los componentes.
- Estructura: `src/locales/{lang}/messages.po`.
- Flujo:

```bash
npm run i18n:extract   # lingui extract
npm run i18n:compile   # lingui compile
```

- IDs descriptivos y estables (`transactions.empty.title`), no el texto inglés
  como ID.
- Plurales con ICU; nunca concatenar fragmentos:

```ts
t`${count} transactions`            // mal: concatenación
plural(count, { one: '# transaction', other: '# transactions' }) // bien
```

- Fechas y números con `Intl`, usando el locale activo y la divisa que devuelve
  el API. El dígito de fracción viene de `/meta`, no se asume 2.
- Fechas del API en ISO (`YYYY-MM-DD`); se interpretan en la zona del dispositivo
  que aloja el servidor. No usar `new Date('2026-11-17')` (UTC): parsear y
  construir en local.
- Importes: unidades menores (enteros) + divisa; `<Money>` (en JSX) o
  `useMoney()` (dentro de una frase de Lingui) formatean y aplican la máscara;
  `formatMoney` es el núcleo y `maskedMoney()` la máscara.
- Sin texto dentro de imágenes. Sin `innerHTML` con texto traducido.
- Comentarios para traductores en mensajes ambiguos ("Budget" como sustantivo,
  "Part" como parte de una dividida).
- Se prueba con una locale pseudo (`en-XA`) para detectar textos sin extraer.

---

## 13. Contenido y microcopy

- Sentence case. Voz activa. Verbos concretos.
- Un botón dice exactamente lo que hace: "Save", "Delete transaction", "Add part".
  El resultado usa la misma palabra: "Transaction saved."
- Terminología:

| Concepto | UI (inglés) | Nota |
|---|---|---|
| Cuenta | Account | No "wallet" salvo el nombre de la cuenta |
| Transacción | Transaction | |
| Transferencia | Transfer | Dos caras, misma operación |
| Dividida | Split transaction | El padre; las filas son "parts" |
| Parte | Part | Con importe y categoría propios |
| Beneficiario/pagador | Payee | `Party` en el código; no "counterparty" |
| Contraparte de transferencia | Transfer account | No es un payee |
| Categoría | Category | Ruta: "Home › Household" |
| Etiqueta | Tag | Se muestra `#tag` |
| Método de pago | Payment method | |
| Presupuesto | Budget | |
| Asignación | Allocation | Reparto del presupuesto |
| Conciliación | Reconciliation | Unreconciled / Cleared / Reconciled |
| Fecha valor | Value date | Distinta de Booking date |

- Privacidad: "Hide totals" / "Show totals" y "Hide transaction amounts" /
  "Show transaction amounts"; la cifra tapada se anuncia como "Amount hidden".
- Errores: qué pasó y qué hacer. Sin "Oops", sin "Something went wrong" a secas.
- Vacíos: describen el estado y ofrecen la acción siguiente.
- Confirmaciones destructivas: nombran el objeto y el alcance ("This also deletes
  its 3 parts.").
- No se usan signos de exclamación ni emoji.

---

## 14. Implementación

### Tailwind

Los colores de Tailwind apuntan a variables, no a hex:

```js
// tailwind.config.js (extracto)
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        rail: 'var(--bg-rail)',
        sunken: 'var(--bg-sunken)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        line: 'var(--border-subtle)',
        accent: 'var(--accent)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
      },
      boxShadow: { card: 'var(--shadow-card)' },
      fontFamily: { sans: ['Geist', 'system-ui', 'sans-serif'] },
    },
  },
}
```

### Estructura sugerida

```text
src/
  app/            rutas, layout, providers
  components/ui/  Button, Input, Select, Table, Card, Chip, Panel...
  components/data/ Money, DateText, CategoryPill, StatusDot, EmptyState
  features/
    dashboard/
    transactions/
    budgets/
    reports/
    master-data/
  lib/            api client, query keys, format, theme
  locales/        en/messages.po, es/messages.po...
  styles/         tokens.css, globals.css
```

- `Money` recibe `amountMinor: number`, `currency`, `fractionDigits`; formatea con
  `Intl` y firma. Ninguna página formatea a mano.
- `DateText` recibe ISO y locale; nunca `new Date(string)` directo.
- `api/` devuelve DTOs tipados; los componentes no conocen URLs.
- Query keys: `['transactions', accountId, filters]`, `['dashboard', month]`.
  Las mutaciones invalidan `transactions`, `accounts`, `dashboard`, `reports`.
- Formularios: Zod espejo del servidor; los errores 422 se mapean a `fields`.
- Charts: un wrapper `ChartCard` que aplica tokens y estado vacío.
- Sin lógica de dinero en componentes de presentación.

### Arranque del tema

```html
<script>
  const saved = localStorage.getItem('theme')
  const dark = saved ? saved === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
</script>
```

### Pruebas

- Vitest + Testing Library para componentes y mapeos.
- Playwright contra el móvil en LAN para flujos críticos: crear, dividir,
  presupuestar, cambiar tema.
- axe en las pantallas principales.
- Snapshot visual de las tres vistas de referencia en claro y oscuro.

---

## 15. Do / Don't

| Do | Don't |
|---|---|
| Tinte en la tarjeta, cifra en tinta | Colorear la cifra principal de la KPI |
| Una nota de color fuerte (marca) | Degradados en datos, botones y títulos |
| Reglas de 1 px y espacio | Anidar tarjetas y sombrear cada fila |
| Sentence case | MAYÚSCULAS fuera de cabeceras y KPI |
| Signo + color + etiqueta | Confiar solo en el color |
| Panel lateral para editar | Modal para todo |
| Tokens (`var(--positive)`) | Hex sueltos en componentes |
| Totales del servidor | Sumar páginas en cliente |
| `Intl` y `Money`/`DateText` | Concatenar símbolos y fechas |
| Diseñar ambos temas a la vez | Invertir colores para el oscuro |
| Estados vacío/carga/error | Dejar la pantalla en blanco |

---

## 16. Checklist de revisión

- [ ] Solo tokens; ningún hex nuevo fuera de `tokens.css`.
- [ ] Claro y oscuro revisados, sin invertir.
- [ ] Contraste AA en texto y controles.
- [ ] Foco visible y navegación completa por teclado.
- [ ] Estados vacío, carga y error definidos.
- [ ] Copia en inglés extraída a `.po`; sin concatenación.
- [ ] Importes y fechas con `Money`/`DateText`; tabulares y alineados.
- [ ] Los importes nuevos declaran su ámbito (`totals`/`transactions`) y los
      editores abiertos se siguen leyendo.
- [ ] Tabla: totales del servidor, no sumas de la página.
- [ ] Confirmación destructiva nombra el objeto y el alcance.
- [ ] Responsive en 1280, 1024 y 768.
- [ ] `prefers-reduced-motion` respetado.
- [ ] RTL no rompe el layout (propiedades lógicas).
- [ ] Capturas o reference screens actualizadas si existen.

---

## 17. Mantenimiento

- `DESIGN.md` y `webapp/src/styles/tokens.css` cambian en el mismo PR. Un token nuevo sin
  documentar es un bug.
- Un patrón nuevo (pantalla, estado, componente compuesto) se añade aquí con su
  wireframe y su copy de ejemplo.
- Si un componente necesita una excepción, se documenta la excepción y el motivo;
  el código no es la única fuente.
- Las capturas o referencias visuales se guardarán en `webui/webapp/docs/screens/`
  cuando existan, y se actualizan cuando cambia el layout.
- Cada PR de UI se revisa con la checklist de §16.

---

## 18. Decisiones abiertas

- ¿Se adopta shadcn/ui como base de primitivas o se escriben desde cero sobre
  Radix? La guía asume la primera opción.
- ¿Habrá modo compacto global o solo en tablas? Afecta a la altura de fila.
- ¿Virtualización de tabla? A partir de ~2.000 filas; antes, paginación.
- ¿Se cachea el shell para uso offline? El API necesita el móvil; el shell podría
  cachearse, los datos no.
- ¿Se añade un modo "focus" para entrada rápida de gastos?
- ¿Storybook para revisar componentes, o solo las vistas de referencia?

---

## 19. Changelog

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-11-17 | 1.0 | Dirección inicial: Soft Ledger, tokens claro/oscuro, componentes, patrones de dashboard, transacciones, dividida y presupuestos. |
| 2026-11-17 | 1.1 | Tokens movidos a la SPA (`webapp/src/styles/tokens.css`); guía y código comparten fuente. |
| 2026-11-17 | 1.2 | Patrón del editor de transacción simple y escritura simple en la SPA. |
| 2026-11-17 | 1.3 | Transferencias y divididas: API de escritura y editores; panel ancho de partes con importes firmados. |
| 2026-11-17 | 1.4 | Ficheros: listado y descarga autenticada; tamaño y fecha local en la tabla. |
| 2026-11-17 | 1.5 | Presupuestos: resumen condicional y tarjetas con progreso, sobregiro y periodo propio. |
| 2026-11-17 | 1.6 | Presupuestos: alta, edición y borrado con asignación por defecto; cuenta y periodo fijos al editar. |
| 2026-11-17 | 1.7 | Informes: resumen y desglose por categoría, beneficiario o etiqueta con barras y porcentajes. |
| 2026-11-17 | 1.8 | Lingui EN/ES, selector de idioma, Geist Sans empaquetada, caché TanStack y avisos PWA. |
| 2026-11-17 | 1.9 | Informes v2 (presets, métodos, todas las cuentas y drill-down), asignaciones por categoría y Tailwind v4 procesando toda la CSS (app.css en la capa components). |
| 2026-11-18 | 1.10 | Privacidad de importes: dos botones (totales y transacciones), máscara `€ ••••` y `Money`/`useMoney` en todas las pantallas. |
