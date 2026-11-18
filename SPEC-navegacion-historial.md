# Spec: navegacion-historial — atrás y adelante como espera el navegador — V1

Status: implementado (18-nov-2026): vistas, detalle y editor de transacción,
drill-down de informes y panel de presupuesto (detalle y editor comparten una
sola entrada, así que pasar de uno a otro no deja un paso muerto).
Scope: la SPA (App, vistas, paneles) y el contrato de la URL. Sin cambios de API
salvo el filtro `uncategorized` que necesita el enlace del presupuesto (ver
[`SPEC-presupuesto-movimientos.md`](./SPEC-presupuesto-movimientos.md)).

## Objetivo

Que el botón **atrás** del navegador (y el gesto del móvil/PWA) haga lo que el
usuario espera: cerrar el panel abierto, volver a la pantalla anterior, y solo
salir de la app cuando ya no hay nada detrás. Hoy sale de la web desde cualquier
sitio, incluso con un editor abierto a medias.

## Comportamiento actual (evidencia)

- `App.tsx` guarda la vista en estado (`const [view, setView] = useState('dashboard')`)
  y **nunca** escribe una entrada de historial; solo `Transactions.tsx` hace
  `replaceState` con los filtros.
- Los paneles (detalle, editores, confirmaciones) son estado local: no aparecen
  en la URL.
- Consecuencia: atrás va a la página anterior al `/app/` (o cierra la PWA) en vez
  de cerrar el panel o volver al dashboard.
- `?view=transactions` **no** abre Transacciones al cargar: por eso el mock tiene
  que simular un clic (`?view=…` es un switch de QA, no del producto).

## Comportamiento nuevo

1. La URL es la fuente de verdad de lo navegable:
   - `view`: `dashboard` (por defecto), `transactions`, `reports`, `budgets`,
     `files`.
   - La vista de transacciones mantiene en la URL sus filtros y rango, como hoy
     (`categoryId`, `payeeId`, `tagId`, `methodId`, `q`, importes, `status`,
     `transfer`, `from`/`to`, `grouping`).
   - `panel` para el panel abierto: `budget-detail`, `budget-edit`,
     `transaction`, `report-drill`, `file`… con su id cuando lo tenga
     (`panel=transaction&id=42`).
2. Cambiar de vista **empuja** una entrada. Abrir un panel **empuja** una
   entrada. Cerrar el panel (✕, `Esc`, fondo) hace `history.back()` y el
   `popstate` resultante es lo que cierra el panel: una sola fuente de verdad.
3. `popstate` rehidrata vista, filtros y panel desde la URL: atrás con un panel
   abierto lo cierra; otro atrás vuelve a la vista anterior con sus filtros;
   desde la primera entrada sale de la app.
4. Los filtros cambian con `replaceState` (no generan una entrada por tecla ni
   por chip), pero el paso de Historial a un rango o a otra agrupación sí puede
   empujar si no ensucia el historial; se decide en el plan y se prueba.
5. Enlaces profundos: un `/app/?view=transactions&categoryId=33&from=…&to=…`
   abre la lista ya filtrada (lo usa el drill-down del presupuesto). Sin
   `view`, dashboard.
6. Los switches de QA del mock que simulan clics (`?view=…`, `?edit=…`,
   `?panel=split`) se pueden retirar cuando la URL haga el trabajo; se mantienen
   los que cambian datos o tema.
7. `README.md` documenta los parámetros de URL del producto, separados de los
   switches de QA.

## Verificación

- Prueba de ayuda (`src/history.ts`): parsear/serializar la URL, `push` vs
  `replace`, y que un `popstate` sin `panel` cierra el panel.
- Manual (mock y móvil): dashboard → Transacciones → detalle de una transacción
  (`atrás` cierra el detalle) → `atrás` vuelve al dashboard → `atrás` sale de la
  web. Con un editor abierto: `atrás` descarta el editor (con su confirmación de
  cambios sin guardar, ya existente).
- Recarga y enlace pegado: la vista y el panel de la URL se respetan.

## Límites

- Always: una sola fuente de verdad (URL); ninguna acción de "volver" que no pase
  por `history`.
- Always: `Esc` y la ✕ cierran por el mismo camino que el botón del navegador.
- Ask first: convertir cada chip de filtro en una entrada de historial.
- Never: romper enlaces existentes (`?view=…` con filtros) ni los switches del
  mock que no son de navegación.

## Criterios de éxito

- Con un panel abierto, atrás lo cierra y no cambia de vista.
- Desde Transacciones, atrás vuelve al dashboard; desde el dashboard, atrás sale
  de la web.
- Pegar un enlace con `view` y filtros abre exactamente eso.
- `npm test` y QA visual en escritorio y 390×844; `README.md` al día.

## Fuera de alcance

- Sincronizar el historial con el router de la app Android.
- Recordar la posición de scroll de cada vista.
