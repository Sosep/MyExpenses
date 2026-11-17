# Plan: Transacciones como la app Android — V1

Specs: [`SPEC-transacciones-v1.md`](../SPEC-transacciones-v1.md) (mapa),
[`SPEC-agrupacion-rango.md`](../SPEC-agrupacion-rango.md) y
[`SPEC-busqueda-avanzada.md`](../SPEC-busqueda-avanzada.md) (aprobadas 2026-11-18)
Alcance: SPA (`webui/webapp`) y `/api/v1`. Sin cambios en la app Android.

## Goal

Que la lista de Transacciones deje de estar atada al mes: agrupación elegible
(`Ninguna/Día/Semana/Mes/Año`) con el resumen de ingresos, gastos y
transferencias en cada cabecera, historial completo paginado, rango como filtro;
y búsqueda por los criterios de la app (texto, importe, fechas, tipo, categorías,
beneficiarios, etiquetas, métodos y estado) con selección múltiple.

## Componentes y dependencias

| Componente | Qué produce | Depende de |
|---|---|---|
| API de periodos | `GroupDto` con `periodStart`/`periodEnd` calculados con las reglas de la app | — |
| Estado de la lista | `grouping` + rango en la URL, recordado en `localStorage` | — |
| Lista agrupada | Cabeceras con título, ingresos, gastos, transferencias y plegado; subtotales de `/reports/grouped` | API de periodos, Estado de la lista |
| Criterios de búsqueda | Parámetros nuevos y múltiples en `/transactions` | — |
| Panel de búsqueda | Hoja con los criterios y chips en la URL | Criterios, Lista agrupada |

## Orden y paralelismo

1. **API de periodos** — primero: sin fechas de periodo el cliente no puede casar
   filas y grupos con seguridad (sobre todo `WEEK`).
2. **Estado de la lista + lista agrupada** — en una sola tanda, porque comparten
   `Transactions.tsx`; aquí sale también la tira de KPIs.
3. **Criterios de búsqueda** — en paralelo con lo anterior (toca `ApiQueries` y
   `ApiRoutes`, no la lista); verificar con `WebQueryReproTest`.
4. **Panel de búsqueda y chips** — después de 2 y 3, porque consume ambos.
5. **Docs, mock y QA en dispositivo** — al final de cada bloque, no acumulados.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `WEEK` se desalinea entre cliente y servidor | El servidor manda `periodStart`/`periodEnd`; el cliente no calcula límites de semana |
| Muchos grupos al agrupar por día con todo el historial | Los periodos vienen del `grouped` (una fila por periodo); si superan un umbral, se pagina la parte visible y se mantiene el resto en memoria |
| Búsqueda de texto sin índice (`LIKE` en 3 columnas) | Se acota con los demás criterios y se mide en el móvil; si duele, FTS en una spec aparte |
| Selección múltiple: `SearchSelect` es de un valor | Componente nuevo con chips dentro del desplegable; no se toca el de un valor que usan presupuestos |
| Enlaces antiguos con `?view=transactions&month=…` | El estado nuevo ignora `month` y acepta los filtros de hoy sin cambios |
| La lista deja de tener resumen global | El resumen por cabecera lo sustituye; se actualiza `DESIGN.md` y `SPEC-web-ui-features.md` F1 lo refleja |

## Verificación

```
cd webui/webapp && npm test && npm run build && npm run i18n:compile
docker compose run --rm android-build :webui:testDebugUnitTest :webui:ktlintCheck
docker compose run --rm android-build :myExpenses:testExternDebugUnitTest --tests "*WebQueryReproTest"
cd webui/webapp && npm run mock     # 1440×900 y 390×844
```

Y en el móvil real: cambiar de agrupación con historial de varios meses, plegar
grupos, «cargar más» dentro de un grupo, rango `Todo`/personalizado, y una
búsqueda por texto + importe.
