# Spec: Densidad y shell responsive — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-ui-v1.md`](./SPEC-web-ui-v1.md)
Scope: layout y jerarquía de las pantallas en 1440×900 y 390×844. Sin producto nuevo.

## Objetivo

Que el dato principal esté en la primera pantalla. Hoy en móvil se llega a la lista de
transacciones con el 57 % de la pantalla gastado en cabecera y controles, y en Informes el
desglose empieza *por debajo* de la primera pantalla. En escritorio, en cambio, sobran
anchos y falta jerarquía.

## Comportamiento actual (medido a 390×844)

| Pantalla | Medida |
|---|---|
| Resumen | 4 tarjetas KPI apiladas = **448 px**; hero + acciones + 2 filas de botones |
| Transacciones | `.page-head` 148 px, `.filter-bar` 94 px, primera fila de tabla en **y=478** |
| Informes | `.report-controls` 159 px en 4 filas, `.kpis` 452 px, tarjeta de desglose en **y=863** |
| Presupuestos | pie de tarjeta partido en dos líneas ("78%" / "usado"); "Historial"/"Editar" a 11 px |
| Ficheros | nombres truncados por la derecha: se pierde `.backup`/`.csv` |
| Todas | marca partida en dos líneas en el topbar (ver `web-ui-defects`) |
| Escritorio | Ficheros reparte 4 columnas en 1 240 px; Informes junta 6 grupos de control sin separadores |

## Comportamiento nuevo

### Móvil (≤760 px)

- **Topbar de una línea:** `Σ` + selector de cuenta + menú `⋯` (idioma, tema, sesión). Sin
  wordmark partido. La cuenta se queda a la vista porque es el filtro que más se usa; el
  nombre de la vista no se repite en la barra, ya lo dice el H1.
- **El periodo** no se duplica en la barra: cada pantalla ya lo muestra en su cabecera
  (Transacciones e Informes con `‹ ›`, Presupuestos con su mes).
- **Resumen:** hero a ancho completo y KPIs en rejilla **2×2** con cifra 18 px; las cuatro
  tarjetas ≤200 px y el bloque con el patrimonio ≤300 px.
- **Transacciones:** el CTA “Nueva transacción” pasa a botón flotante sobre la barra
  inferior; los cuatro filtros se pliegan tras “Filtros (n)” con contador y se abren en una
  hoja; la navegación de mes queda en una fila.
- **Informes:** los cuatro KPIs pasan a 2×2; periodo, dimensión y tipo se reducen a tres
  filas (cuenta + tres segmentados), que es el mínimo sin convertir un segmentado en selector.
- **Presupuestos:** el pie de tarjeta es una sola línea (`78% · 14 días · Historial ·
  Editar`) con dos acciones táctiles reales.
- **Ficheros:** el nombre ocupa dos líneas o se trunca por el centro; la extensión siempre
  visible.

### Escritorio (≥1024 px)

- **Topbar:** se elimina el *crumb* que repetía el H1 (decisión 5 del mapa); no se sustituye
  por breadcrumb porque la app no tiene subpáginas.
- **Informes:** los grupos de control se separan por divisores y se alinean en dos filas;
  la cuarta KPI usa `--tint-sky` como las demás.
- **Ficheros:** la tarjeta se limita a ~760 px, o tamaño y fecha se alinean a la derecha.
- **Presupuestos:** la barra del resumen muestra porcentaje y usa relleno semántico.
- **Gráfica de 12 meses:** año/mes legibles, eje de importes en la unidad de la divisa y
  valor de la columna activa. Se puede leer sin `title` (que no existe en táctil).

### Tipografía y ritmo (todas las pantallas)

- Cuerpo de **14 px** (decisión del mapa): `.table td`, `.breakdown-label`,
  `.field-value`, `.error-text`, `.confirm-box p` y los párrafos pasan de 13 a 14.
- Desaparecen los 10, 15 y 17 px sueltos: la escala queda 11/12/14/16/20/28/40.
- Radios sólo 8/10/12/999 en superficies y controles; los 3-6 px quedan reservados a barras.

## Estructura (partes relevantes)

```
webui/webapp/src/components/Shell.tsx          -> topbar y rail inferior
webui/webapp/src/components/Dashboard.tsx      -> hero y KPIs
webui/webapp/src/components/Transactions.tsx   -> cabecera, filtros y CTA
webui/webapp/src/components/Reports.tsx        -> toolbar y KPIs
webui/webapp/src/components/Budgets.tsx        -> pie de tarjeta y resumen
webui/webapp/src/components/Files.tsx          -> tabla y truncado
webui/webapp/src/styles/app.css                -> @media (max-width: 760px) y utilidades
webui/DESIGN.md                                -> §6 layout, §7 controles, §8 patrones
```

## Estilo de código

Reutilizar las utilidades y tokens existentes; los anchos y alturas nuevos entran por
variables, no por números sueltos dentro de una pantalla. Los cambios de layout se prueban
con `?metrics=1`. Ningún `100vh`.

## Estrategia de verificación

1. `npm run build && npm run mock`; capturas 1440×900 y 390×844 en claro y oscuro.
2. `?metrics=1` en cada pantalla para leer `scrollHeight`/`clientHeight` y número de filas.
3. Comprobación de scroll horizontal en 360, 390, 560, 768, 1024, 1280 y 1440.
4. Medir con el inspector la posición de la primera fila de tabla y de la tarjeta de
   desglose, y compararlas con los criterios.
5. Repasar ambos idiomas: los textos más largos del español no deben romper ninguna fila.

## Límites

- Always: mantener las cinco acciones del rail inferior y su área táctil; reservar espacio
  para la barra inferior (`padding-bottom` con `env(safe-area-inset-bottom)`); medir antes y
  después.
- Ask first: quitar el *crumb*; mover cuenta/idioma a un menú; cambiar el patrón de tabla a
  tarjetas por debajo de 560.
- Never: ocultar datos para “que quepa” (importes, categoría, estado); romper la tabla de
  escritorio para arreglar el móvil.

## Criterios de éxito

- 390×844: la primera fila de Transacciones empieza en **y ≤ 380** (hoy 478).
- 390×844: la tarjeta de desglose de Informes empieza en **y ≤ 700** y se ve al menos una
  fila sin desplazar (hoy 863).
- 390×844: las cuatro tarjetas KPI del Resumen ocupan **≤ 200 px** y el bloque con el
  patrimonio ≤300 px (hoy 448 en total).
- 360-1440 px: `scrollWidth === clientWidth` en todas las pantallas.
- 1440: la tabla de Ficheros no supera 760 px de ancho útil; en móvil el nombre del fichero
  envuelve en vez de perder la extensión.
- El importe, la categoría y el estado siguen visibles en móvil.
- No queda ninguna regla con `font-size` de 13, 15 o 17 px; el cuerpo mide 14 px.

## Fuera de alcance (aplazado)

- Modo compacto global y virtualización de tablas.
- Barra superior con búsqueda global.
- Patrón de lista-card por debajo de 560 px (se mantiene la tabla).
- Rediseño de la barra inferior más allá de etiquetas y áreas táctiles.
