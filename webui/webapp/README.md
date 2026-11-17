# MyExpenses web app

SPA de escritorio servida por el servidor Ktor del móvil en `/app`.
React + TypeScript + Vite, con los tokens de [`../DESIGN.md`](../DESIGN.md).

## Estado

Corte actual: lectura y escritura simple, transferencias, divididas, ficheros,
presupuestos e informes.

- Login con la contraseña del Web UI (HTTP Basic).
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
- Presupuestos: progreso del periodo actual por presupuesto, resumen cuando
  comparten divisa y periodo, sobregiro explícito y días restantes. Alta,
  edición y borrado desde un panel lateral, con asignación por categoría para el
  periodo actual; el rollover y la duplicación siguen en la app.
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
- Tailwind v4 configurado con los tokens de `DESIGN.md`; la UI nueva usa
  utilidades y la existente conserva las clases semánticas.

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

## Probar sin el móvil

El repo incluye un servidor de desarrollo con datos de ejemplo y 60 transacciones
para probar scroll y paginación:

```bash
npm run build
npm run mock
# abre http://localhost:4173/app/
```

El mock sirve el build y el API en el mismo origen, e implementa `POST/PUT/DELETE`
de transacciones **simples** y de **presupuestos** en memoria, y sirve resumen y
desglose de informes (recalcula saldo y totales del mes). Las transferencias y
divididas se pueden abrir y editar visualmente, pero su guardado se prueba contra
el API real del teléfono. Acepta estos parámetros para QA visual:

| Parámetro | Efecto |
|---|---|
| `?login=1` | Borra la cookie del mock y muestra la pantalla de login |
| `?view=transactions` | Abre Transacciones |
| `?view=reports` | Abre Informes |
| `?view=reports&reportBy=Payee&reportType=Both` | Preselecciona dimensión y tipo en Informes |
| `?view=reports&reportDrill=1` | Abre el detalle del primer grupo |
| `?view=budgets` | Abre Presupuestos |
| `?view=budgets&new=1` | Abre el editor de alta de presupuesto |
| `?view=budgets&edit=1` | Abre el primer presupuesto en el editor |
| `?view=files` | Abre Ficheros |
| `?panel=split` / `?panel=transfer` | Abre el detalle de la dividida / transferencia |
| `?new=1` | Abre el selector de tipo de alta |
| `?new=1&kind=transfer` / `&kind=split` | Abre el editor de transferencia / dividida |
| `?edit=simple` | Abre un gasto simple en el editor |
| `?edit=split` / `?edit=transfer` | Abre la dividida / transferencia en su editor |
| `?new=1&save=1` | Crea una transacción simple de prueba contra el mock |
| `?theme=dark` | Activa el tema oscuro |
| `?metrics=1` | Añade un badge con `scrollHeight`/`clientHeight` y filas |

Para trabajar con Vite en caliente y el mock como API:

```bash
node dev/mock-server.mjs
VITE_API_TARGET=http://localhost:4173 npm run dev
```

En ese modo la SPA la sirve Vite y los parámetros de QA del mock no aplican.

## Build

```bash
npm run build
```

El resultado se escribe en `webui/src/main/assets/webapp/` y se sirve desde
Ktor en `/app`. El build se commitea para que el APK lo incluya sin depender
de Node en CI; si se cambia la app, hay que volver a ejecutar el build.

## Notas de esta iteración

- Los assets se sirven desde `AssetManager` mediante una ruta propia de Ktor;
  no se usa `staticResources`, que lee del classpath y no de `assets/`.
- La navegación es por estado (Overview / Transactions), sin router. Los
  deep links se añadirán cuando se estabilice la navegación.
- El saldo acumulado por fila todavía no está en el API de lectura; la tabla
  muestra el saldo actual de la cuenta en la cabecera. Se añadirá con el
  endpoint de ledger.
- Los textos están en inglés y todavía no pasan por Lingui; la extracción a
  `.po` se hace cuando las pantallas estén cerradas.
- El importe del formulario se parsea como cadena decimal a unidades menores; el
  API nunca recibe un `Float`.
- Tras una escritura se refrescan las cuentas, el resumen y la lista con una
  `dataVersion`; no se suman transacciones en cliente.
- El editor de divididas usa importes firmados y exige que la suma de partes
  cuadre con el total; el API lo revalida. La cuenta no se puede mover al editar.
- Esta iteración usa CSS con los tokens, sin Tailwind todavía; TanStack Query y
  el router llegarán con las pantallas de escritura.
- Geist no está empaquetado aún: la pila cae a `system-ui`. Se añadirá el woff2
  al cerrar la biblioteca de componentes.
