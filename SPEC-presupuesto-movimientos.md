# Spec Delta: presupuesto-movimientos — del detalle del presupuesto a sus movimientos

Status: implementado con la opción B (enlace a Transacciones, 18-nov-2026).
Original: [`SPEC-presupuestos-detalle.md`](./SPEC-presupuestos-detalle.md) §9
(dejó "saltar a los movimientos" para V2).
Alcance: una ruta nueva en `:webui`, la SPA y el mock.

## Objetivo

Que desde el detalle de un presupuesto se pueda abrir **qué movimientos** hay
detrás de una categoría en el mes que se está mirando, sin salir del panel ni
perder el filtro del presupuesto. Hoy el detalle da importes agregados y el
usuario tiene que ir a Transacciones y reconstruir el filtro a mano.

## Comportamiento actual

- El panel de detalle muestra el reparto por categoría (`spentMinor`), el total
  del periodo y el histórico, todo agregado.
- Transacciones filtra por categoría y rango de fechas, pero **no conoce el
  presupuesto**: un presupuesto limitado por beneficiario o método no se puede
  reproducir desde la lista.
- El informe por categoría sí tiene drill-down
  (`/reports/transactions?by=category&id&from&to`), pero aplica solo el rango,
  no los criterios del presupuesto.

## Comportamiento nuevo

1. **No hay ruta nueva.** Cada fila con gasto del reparto es un enlace a la
   vista de Transacciones con el filtro ya puesto:
   `/app/?view=transactions&categoryId=<id>&from=<periodStart>&to=<periodEnd>`
   más los criterios del presupuesto que la lista sabe expresar
   (`payeeId`, `methodId`, `tagId`, `status`).
2. La fila "Sin categoría" (`categoryId: 0`) usa `uncategorized=1`, un filtro
   nuevo de `GET /transactions` (`catid IS NULL`). Sin él, ese enlace no se
   puede reproducir.
3. La lista muestra exactamente lo que sumaba la fila: mismo rango, misma
   categoría (con sus descendientes y las partes de divididas) y los mismos
   criterios. `/transactions` ya filtra por categoría incluyendo divididas y no
   pagina distinto.
4. Se cancela el panel de detalle al navegar (el enlace es una navegación real,
   con entrada de historial: ver
   [`SPEC-navegacion-historial.md`](./SPEC-navegacion-historial.md)); atrás
   devuelve al presupuesto donde se estaba.
5. El mock responde al enlace con su dataset sembrado, incluido
   `uncategorized=1`.

## Verificación

- `ApiRoutesTest`: `uncategorized=1` devuelve solo movimientos sin categoría,
  combinado con rango y con `categoryId` (que manda el `categoryId` si vienen
  los dos: se rechaza con `400 invalid_filter`).
- **Dispositivo**: presupuesto del sandbox con 6 meses de gasto; abrir una
  categoría y comprobar que la lista suma exactamente el `spentMinor` de la
  fila; repetir con el mes anterior; atrás devuelve al presupuesto.
- SPA: `npm test` de la composición del enlace (categoría, rango y criterios) y
  QA visual del salto en escritorio y 390×844.

## Límites (delta sobre el original)

- Always: el drill-down usa los criterios del presupuesto **en el servidor**; el
  cliente no filtra ni suma.
- Always: la suma de la lista y la fila del reparto salen de la misma selección.
- Ask first: añadir más filtros a la lista para cubrir criterios que hoy no
  existen (solo entra `uncategorized`).
- Never: permitir editar desde el drill-down; es lectura y, como mucho, abre el
  panel de transacción existente.

## Criterios de éxito

- Cada fila del reparto abre Transacciones con su filtro y la suma de la lista
  cuadra con la fila.
- Un presupuesto limitado por beneficiario no muestra movimientos de otros.
- La fila "Sin categoría" abre sus movimientos con `uncategorized=1`.
- Mes sin gasto: estado vacío claro, sin error.
- `npm test`, `:webui:testDebugUnitTest`, `ktlintCheck` y `API.md` al día.

## Fuera de alcance

- Editar, borrar o crear movimientos desde el listado resultante más allá de lo
  que ya permite la pantalla de Transacciones.
- Exportar el listado.
