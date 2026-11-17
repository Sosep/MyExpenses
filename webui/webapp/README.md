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

### QA rápido

| Parámetro | Efecto |
|---|---|
| `?login=1` | Borra la cookie del mock y muestra el login |
| `?locale=es` | Activa español |
| `?view=transactions` | Transacciones |
| `?view=transactions&filter=groceries` | Filtra por la categoría Groceries |
| `?view=reports` | Informes |
| `?view=reports&reportBy=Payee&reportType=Both` | Preselecciona dimensión y tipo |
| `?view=reports&reportDrill=1` | Abre el detalle del primer grupo |
| `?view=budgets` | Presupuestos |
| `?view=budgets&budgetMonth=-1` | Presupuestos en el mes anterior |
| `?view=budgets&history=1` | Abre el histórico del primer presupuesto |
| `?view=budgets&new=1` | Alta de presupuesto |
| `?view=budgets&edit=1` | Edita el primer presupuesto |
| `?view=budgets&edit=1&periodOverride=1` | Prueba el total distinto de este periodo |
| `?view=files` | Ficheros |
| `?panel=split` / `?panel=transfer` | Detalle de dividida / transferencia |
| `?new=1` | Selector de tipo de alta |
| `?new=1&kind=transfer` / `&kind=split` | Editor de transferencia / dividida |
| `?new=1&combo=1` | Abre el alta y filtra beneficiarios escribiendo `Ren` |
| `?edit=simple` / `?edit=split` / `?edit=transfer` | Abre esa transacción en su editor |
| `?new=1&save=1` | Crea una transacción simple de prueba |
| `?theme=dark` | Tema oscuro |
| `?metrics=1` | Badge con `scrollHeight`/`clientHeight` y filas |

### Viewport móvil

Abre las DevTools del navegador y elige un dispositivo de **390×844** (o
cualquier ancho ≤760 px). La barra lateral pasa a una barra inferior fija con
icono y etiqueta. Es el mismo mock y los mismos assets, solo cambia el viewport.
Sirve para comprobar:

- navegación inferior y espacio reservado al final de la página;
- tablas que ocultan columnas (`hide-sm`) y botones compactos;
- editores a ancho completo y dividida apilada;
- controles de informes y presupuestos que deben hacer wrap.

### Qué escribe el mock

- **Sí**: transacciones simples (`POST/PUT/DELETE`), presupuestos, asignaciones,
  rollover, total por periodo, duplicación, informes y descarga de ficheros.
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
