# MyExpenses web app

SPA de escritorio servida por el servidor Ktor del móvil en `/app`.
React + TypeScript + Vite, con los tokens de [`../DESIGN.md`](../DESIGN.md).

## Estado

Primer corte, **solo lectura**:

- Login con la contraseña del Web UI (HTTP Basic).
- Dashboard: patrimonio de la cuenta, ingresos/gastos/ahorro del mes,
  tendencia de 12 meses y últimas transacciones.
- Transacciones: navegación por mes, filtro ingreso/gasto, paginación,
  detalle con partes de una dividida y transferencias enlazadas.

Todavía no se crean ni editan transacciones, ni hay presupuestos, informes
desglosados o ficheros. Esas pantallas llegan en los siguientes cortes.

## Desarrollo

El servidor tiene que estar arrancado en el móvil y accesible desde el PC.

```bash
cd webui/webapp
npm install
VITE_API_TARGET=http://IP_DEL_MOVIL:9000 npm run dev
```

Abre `http://localhost:5173/app/`. Vite hace proxy de `/api` al móvil, así que
no hace falta configurar CORS.

La autenticación es la misma contraseña que en la app. Si no hay contraseña
configurada, deja el campo vacío.

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
- Esta iteración usa CSS con los tokens, sin Tailwind todavía; TanStack Query y
  el router llegarán con las pantallas de escritura.
- Geist no está empaquetado aún: la pila cae a `system-ui`. Se añadirá el woff2
  al cerrar la biblioteca de componentes.
