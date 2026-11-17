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

- Topbar: 48 px, `--bg-surface`, borde inferior de 1 px. Marca a la izquierda;
  búsqueda, periodo, tema y avatar a la derecha.
- Rail: 56 px, `--bg-rail`, iconos de 18 px y pill activa de 36 px. Secciones:
  Overview, Transactions, Budgets, Reports; Settings abajo.
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
- Alturas de control: 32 px (compacto), 36 px (normal), 40 px (táctil).

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
- Foco: anillo de 2 px `--focus-ring` con offset 2.
- Un solo primary por vista. Los botones de peligro no se ponen al lado del
  primary sin separación visual.

### Campos

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
- Cabecera de grupo sticky bajo la cabecera de tabla.
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

- Mismo formulario para crear y editar; al crear, una parte vacía y total 0.
- La suma se valida en vivo; el botón Save se deshabilita con el motivo visible.
- "Split equally" como acción secundaria cuando todas las partes son del mismo
  signo.
- La parte seleccionada se edita en el panel derecho; el contexto del padre
  permanece visible.
- Las partes con transferencia se añaden en v2 y se marcan como tales.
- El servidor valida la suma otra vez; nunca se confía solo en el cliente.

### Presupuestos

```text
┌ Budgeted €2,400 · Spent €1,680 · Remaining €720 ┐
│ ▓▓▓▓▓▓▓░░░  70%                                │
├ Lista (5) ──────────────────┬ Edit budget ──────┤
│ Groceries  312/400  ▓▓▓▓░  │ Amount €400       │
│ Restaurants 146/120 Over   │ Period Monthly    │
│ ...                        │ Allocation        │
│ €720 left overall          │ Delete    Save    │
└────────────────────────────┴───────────────────┘
```

- El resumen es del periodo visible; el periodo manda en toda la pantalla.
- El estado de sobregiro es explícito: chip "Over" + "Over by €26"; no solo un
  color.
- La edición incluye la asignación por categorías y el total asignado.
- No se mezclan presupuestos de periodos distintos en la misma lista.

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

- Lista de ficheros con nombre, tamaño, fecha y acción Download.
- Estado vacío: explica que los ficheros aparecen tras exportar o hacer backup.
- No se muestra la ruta interna.

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
- Foco de 2 px `--focus-ring`, offset 2; visible en ambos temas.
- Objetivos táctiles de 40×40 px como mínimo, aunque el uso sea de escritorio.
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
- Importes: unidades menores (enteros) + divisa; el componente `Money` formatea.
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
