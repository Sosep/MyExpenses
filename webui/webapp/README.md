# MyExpenses web app

SPA servida por el servidor Ktor del móvil en `/app`, usable en escritorio y móvil.
React + TypeScript + Vite, con los tokens de [`../DESIGN.md`](../DESIGN.md).

## Estado

Corte actual: lectura y escritura simple, transferencias, divididas, ficheros,
presupuestos e informes.

- Login con la contraseña del Web UI; el servidor la cambia por una cookie de sesión `HttpOnly`.
- Dashboard: patrimonio de la cuenta, ingresos/gastos/ahorro del mes,
  tendencia de 12 meses y últimas transacciones.
- Transacciones: navegación por mes, filtro ingreso/gasto, paginación,
  detalle con partes de una dividida y transferencias enlazadas.
- Los filtros de transacciones (categoría, beneficiario, etiqueta, método) viven en la URL
  (`?categoryId=3&tagId=7`) y se pueden quitar con chips; en móvil se pliegan tras
  `Filters (n)`.
- Alta, edición y borrado de transacciones **simples**, **transferencias** y
  **divididas** desde paneles laterales. La dividida usa un panel ancho con la
  lista de partes y el editor de la parte seleccionada; los importes van con
  signo y la cuenta queda fija al editar.

- Ficheros: lista de backups/exportaciones del teléfono con tamaño, fecha y
  descarga autenticada (fetch + blob).
- Presupuestos: progreso del periodo por presupuesto, histórico de 12 meses y barras por categoría, resumen cuando
  comparten divisa y periodo, sobregiro explícito y días restantes. Alta,
  edición y borrado desde un panel lateral, con asignación por categoría para el
  periodo actual, total específico del periodo, rollover del importe no gastado y duplicación.
- Informes: KPIs y desglose por categoría, beneficiario, etiqueta o método, con
  presets de periodo, tipo gasto/ingreso/ambos, todas las cuentas y drill-down al
  detalle de cada grupo.
- PWA: manifiesto, iconos y service worker. Cachea el shell de `/app` y trata el
  API como solo red; avisa sin conexión y cuando hay una versión nueva.
- i18n: inglés y español con Lingui (`.po`). Selector de idioma en la barra
  superior; el idioma se recuerda en `localStorage`.
- Privacidad: dos botones en la barra superior (ojo = totales, filas = importes
  de transacciones) que sustituyen cada cifra por `€ ••••`; cada uno recuerda su
  estado en `localStorage` y los editores abiertos se siguen leyendo.
- Preferencias del navegador: el tema, el idioma, la cuenta, la agrupación, la
  privacidad y las selecciones de cada pantalla (mes y controles de informes,
  mes de presupuestos y filtro ingreso/gasto) se guardan en `localStorage` y
  sobreviven a una recarga, también en la PWA.
- Datos de servidor con TanStack Query: caché compartida y refresco por
  invalidación tras cada escritura.
- Geist Sans empaquetada (`@fontsource/geist-sans`), sin depender de la red.
- Tailwind v4 procesa toda la CSS: `app.css` vive en la capa `components` y la UI
  nueva usa utilidades con los tokens de `DESIGN.md`.

## Traducciones

Los textos visibles usan macros de Lingui (`t` y `<Trans>`). Los catálogos viven
en `src/locales/{en,es}/messages.po`.

```bash
npm run i18n:extract   # añade textos nuevos a los .po
npm run i18n:compile   # comprueba que no falta ninguna traducción
```

Al añadir copy, ejecuta `i18n:extract` y rellena el `msgstr` español en el mismo
commit. El build usa `@lingui/vite-plugin` y compila los catálogos al vuelo.

## Desarrollo

El servidor tiene que estar arrancado en el móvil y accesible desde el PC.

```bash
cd webui/webapp
npm install
VITE_API_TARGET=http://IP_DEL_MOVIL:9000 npm run dev
```

Abre `http://localhost:5173/app/`. Vite hace proxy de `/api` al móvil, así que
no hace falta configurar CORS.

La autenticación es la misma contraseña que en la app. El servidor la cambia por
una cookie de sesión `HttpOnly`; no se guarda en `sessionStorage`. Si no hay
contraseña configurada, deja el campo vacío.

## Probar sin el móvil (mock)

El repo incluye un servidor Node con datos de ejemplo (60 transacciones, cuentas,
categorías, presupuestos, informes y ficheros) para trabajar sin el teléfono.

### Arranque

```bash
cd webui/webapp
npm install
npm run build     # genera webui/src/main/assets/webapp
npm run mock      # http://localhost:4173/app/
```

`MOCK_PORT=4174 npm run mock` cambia el puerto. El mock sirve el **build** y el
API en el mismo origen; si cambias código, vuelve a ejecutar `npm run build` o
usa el modo Vite en caliente.

### Login

- Sin `?login=1` el mock inyecta una cookie de sesión y entra directamente.
- `?login=1` borra esa cookie y muestra la pantalla de login; cualquier
  contraseña vale.
- La cookie es la misma `myexpenses_session` que usa el servidor real.

### Índice de mes

El mock tiene movimientos de los últimos cuatro meses, así que agrupar por mes,
semana o día tiene algo que enseñar. La lista del mock aplica los mismos
criterios que la API (texto, importe, estado, transferencias y valores
múltiples). `reports/grouped` devuelve `firstDate` por grupo y calcula los
ingresos, gastos y transferencias de cada periodo con **los mismos criterios y
tipo**, para que la cabecera cuadre con las filas que tiene debajo.

Como la API real, el mock devuelve `second` con **base 0** en `reports/grouped`,
`budgets/{id}` y su historial: noviembre es `10`. La SPA guarda el mes que
muestra como `YYYY-MM` (1–12) y lo convierte solo al llamar a la API.

### Datos de volumen

`MOCK_QA_SEED=1 npm run mock` sustituye los fixtures por seis meses de
movimientos (categorías, beneficiarios, métodos, etiquetas, estados,
transferencias y divididas con sus propias partes). Es determinista y sirve para
probar agrupación, filtros, informes y paginación con volumen:

```bash
MOCK_PORT=4191 MOCK_QA_SEED=1 npm run mock
```

### Presupuestos

- `budgets/{id}/breakdown` devuelve el reparto del presupuesto con una madre
  (`Food`) y sus hijas, para ver la jerarquía y la suma agregada.
- Los presupuestos traen `criteria`; el alta y la edición lo aceptan y lo
  devuelven, y el editor lo muestra en la sección `Filtro`.
- `?view=budgets&detail=1` abre el panel de detalle del primer presupuesto, y
  `detail=3` el del presupuesto 3 (*Fuel*, cuenta *Joint*): la app puede estar en
  otra cuenta y, al pulsar una categoría, la lista se abre en la del presupuesto
  (`accountId` en la URL).

### URL del producto

La vista vive en la URL, así que atrás/adelante recorren la app y un enlace se
puede compartir:

| Parámetro | Efecto |
|---|---|
| `view` | `dashboard` (por defecto), `transactions`, `reports`, `budgets`, `files` |
| `categoryId`, `payeeId`, `tagId`, `methodId` | filtros de la lista (repetibles) |
| `from`, `to`, `preset=custom` | rango de fechas |
| `grouping` | `NONE`, `DAY`, `WEEK`, `MONTH`, `YEAR` |
| `q`, `amountMin`, `amountMax`, `status`, `transfer`, `uncategorized` | resto de filtros |

El detalle de una transacción abre una entrada de historial: atrás lo cierra.

### QA rápido

| Parámetro | Efecto |
|---|---|
| `?login=1` | Borra la cookie del mock y muestra el login |
| `?locale=es` | Activa español |
| `?view=transactions` | Transacciones |
| `?view=transactions&filter=groceries` | Filtra por la categoría Groceries |
| `?view=transactions&categoryId=1` | Filtra por Food y toda su rama (subcategorías incluidas) |
| `?view=transactions&grouping=WEEK` | Agrupa por semana (`DAY`, `MONTH`, `YEAR`, `NONE`) |
| `?view=transactions&preset=month` | Rango del mes actual (`last3`, `year`, `custom` con `from`/`to`) |
| `?view=transactions&q=cafe` | Busca en descripción, beneficiario y referencia |
| `?view=transactions&status=CLEARED&transfer=false` | Estado y transferencias |
| `?view=reports` | Informes |
| `?view=reports&reportBy=Payee&reportType=Both` | Preselecciona dimensión y tipo |
| `?view=reports&reportDrill=1` | Abre el detalle del primer grupo |
| `?view=budgets` | Presupuestos |
| `?view=budgets&budgetMonth=-1` | Presupuestos en el mes anterior |
| `?view=budgets&detail=1` | Abre el detalle del primer presupuesto (reparto, importe e histórico) |
| `?view=budgets&detail=3` | Detalle del presupuesto 3 (*Fuel*, *Joint*) con la app en otra cuenta: al pulsar una categoría, la lista abre la cuenta del presupuesto |
| `?view=budgets&new=1` | Alta de presupuesto |
| `?view=budgets&edit=1` | Edita el primer presupuesto |
| `?view=budgets&edit=1&periodOverride=1` | Prueba el total distinto de este periodo |
| `?view=files` | Ficheros |
| `?view=datos` | Datos de la app (categorías, métodos, etiquetas, divisas, precios) |
| `?view=datos&tab=divisas` | Abre esa pestaña (`métodos`, `etiquetas`, `precios`) |
| `?view=datos&new=1` | Abre el alta de la pestaña activa |
| `?view=transactions&accountId=7` | Operaciones de la cartera *Investments* (sin Presupuestos en el rail) |
| `?accountId=7` | Resumen de la cartera: valoración, efectivo y activos |
| `?new=1&kind=portfolio` | Alta de cartera (el `+` abre el editor con Cartera preseleccionada) |
| `?portfolioLimit=1` | El mock responde `409 portfolio_limit_reached` al crear una cartera |
| `?view=transactions&accountId=7` + `New operation` | Editor de operaciones (Compra/Venta/Depósito/Retirada/Traspaso) |
| `?panel=split` / `?panel=transfer` | Detalle de dividida / transferencia |
| `?new=1` | Selector de tipo de alta |
| `?new=1&kind=transfer` / `&kind=split` | Editor de transferencia / dividida |
| `?new=1&combo=1` | Abre el alta y filtra beneficiarios escribiendo `Ren` |
| `?edit=simple` / `?edit=split` / `?edit=transfer` | Abre esa transacción en su editor |
| `?new=1&save=1` | Crea una transacción simple de prueba |
| `?theme=dark` | Tema oscuro (`?theme=light` vuelve al claro) |
| `?hidden=1` | Tapa totales e importes de transacciones (`?hidden=0` los muestra) |
| `?hidden=totals` | Tapa solo patrimonio, KPIs y agregados |
| `?hidden=transactions` | Tapa solo los importes de las filas |
| `?prefs=seed` | Siembra preferencias fijas en el servidor del mock (ganan sobre `localStorage`) |
| `?metrics=1` | Badge con `scrollHeight`/`clientHeight` y filas |

Los parámetros de tema, idioma y privacidad **solo escriben cuando aparecen**:
una recarga sin parámetros conserva lo que el usuario eligió. El resto de
selecciones (informes, mes de presupuestos, filtro ingreso/gasto) también se
recuerdan. Todas viajan además a `/api/v1/ui-preferences`, así que un origen
nuevo las recupera.

### Preferencias entre orígenes

`localStorage` está atado al origen y el servidor del móvil cambia de URL al
arrancar. El mock permite reproducir el caso con dos orígenes del mismo
servidor:

- `http://localhost:4173/app/`
- `http://127.0.0.1:4173/app/`

Cambia en uno el tema, el idioma, la agrupación, la cuenta, el mes del informe y
los dos interruptores de privacidad; espera un segundo (el `PUT` va con debounce)
y recarga el otro: todo debe aparecer aplicado. Al cerrar la pestaña se hace un
flush con `keepalive`.

- La primera vez que el servidor no tiene nada guardado, la SPA sube sus valores
  locales una vez: las elecciones anteriores migran solas.
- `?prefs=seed` fuerza tema `dark`, idioma `es`, agrupación `YEAR`,
  `hideTotals` y un informe `last3`/`payee`/`both`: sirve para comprobar que el
  arranque aplica el servidor por encima de `localStorage`. El mock reinicia sus
  preferencias al reiniciar el proceso.

### Viewport móvil

Abre las DevTools del navegador y elige un dispositivo de **390×844** (o
cualquier ancho ≤760 px). La barra lateral pasa a una barra inferior fija con
icono y etiqueta. Es el mismo mock y los mismos assets, solo cambia el viewport.
Sirve para comprobar:

- navegación inferior y espacio reservado al final de la página;
- tablas que ocultan columnas (`hide-sm`) y botones compactos; en Datos,
  Divisas esconde símbolo y dígitos para que Editar/Eliminar sigan visibles;
- editores a ancho completo y dividida apilada;
- controles de informes y presupuestos que deben hacer wrap.

### Qué escribe el mock

- **Sí**: transacciones simples (`POST/PUT/DELETE`), presupuestos, asignaciones,
  rollover, total por periodo, duplicación, informes, preferencias de la interfaz
  web (`GET/PUT /ui-preferences`) y descarga de ficheros; el borrado de
  categorías respeta también las partes de dividida (`409`).
- **Sí**: alta/edición de carteras (`POST/PUT /portfolios`) y sus operaciones
  (`POST/PUT/DELETE /portfolios/{id}/trades`), incluida la subcuenta de efectivo
  que la app crea con la primera operación; el límite de licencia se simula con
  `?portfolioLimit=1` (y se desactiva con `?portfolioLimit=0`).
- **No**: guardar transferencias ni divididas; se abren y editan visualmente,
  pero el guardado se prueba contra el API real del teléfono.
- Todo vive en memoria: reiniciar el mock vuelve a los datos de ejemplo.
- El código está en `dev/mock-server.mjs`; los fixtures están al principio del
  archivo.

### Vite en caliente con el mock como API

```bash
node dev/mock-server.mjs
VITE_API_TARGET=http://localhost:4173 npm run dev
```

La SPA la sirve Vite en `http://localhost:5173/app/`; los parámetros de QA del
mock no aplican porque el `index.html` lo sirve Vite.

### Contra el móvil real

```bash
VITE_API_TARGET=http://IP_DEL_MOVIL:9000 npm run dev
```

Abre `http://localhost:5173/app/`; Vite hace proxy de `/api`. La contraseña es
la del Web UI y la sesión es una cookie.

## Build

```bash
npm run build
```

El resultado se escribe en `webui/src/main/assets/webapp/` y se sirve desde
Ktor en `/app`. El build se commitea para que el APK lo incluya sin depender
de Node en CI; si se cambia la app, hay que volver a ejecutar el build.

## Notas de implementación

- Los assets se sirven desde `AssetManager` con una ruta propia de Ktor; no se
  usa `staticResources`, que lee del classpath.
- La navegación es por estado, sin router. Los deep links llegan más adelante.
- El saldo acumulado por fila aún no está en el API de lectura; la tabla muestra
  el saldo actual de la cuenta en la cabecera.
- El importe se parsea como cadena decimal a unidades menores; el API nunca
  recibe un `Float`.
- TanStack Query cachea y, tras cada escritura, invalida; no se suman
  transacciones en cliente.
- La dividida usa importes firmados y exige que las partes sumen el total; la
  cuenta no se puede mover al editar.
- Tailwind v4 procesa toda la CSS (`app.css` en la capa `components`); la UI
  nueva usa utilidades con los tokens de `DESIGN.md`.
- Geist Sans va empaquetada con `@fontsource/geist-sans`.
