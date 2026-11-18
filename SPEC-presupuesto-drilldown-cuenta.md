# Spec Delta: presupuesto-drilldown-cuenta — la cuenta del presupuesto al abrir sus movimientos

Status: implementado (18-nov-2026), opción A.
Original: [`SPEC-presupuesto-movimientos.md`](./SPEC-presupuesto-movimientos.md)
(drill-down del detalle) y [`SPEC-presupuestos-detalle.md`](./SPEC-presupuestos-detalle.md)
(el reparto es el del presupuesto, no el de la cuenta).
Alcance: SPA, mock, tests puros y documentación. Sin cambios en `/api/v1`.

## Objetivo

Que al pulsar una categoría del detalle de un presupuesto, Transacciones se abra
en **la cuenta del presupuesto**. Hoy se queda en la cuenta elegida en la barra
superior: si el presupuesto es de otra cuenta, la lista aparece con otra cuenta
(y casi vacía) mientras el resto del filtro sí se aplica.

## Comportamiento actual

- La cuenta es estado global de la SPA: se elige en la barra superior, se
  recuerda en `myexpenses.accountId` y el selector solo se pinta en `dashboard`,
  `transactions` y `reports`.
- `BudgetDetailPanel.drilldownUrl` compone
  `?view=transactions&preset=custom&from&to&categoryId|uncategorized` más los
  criterios del presupuesto. **No toca la cuenta.**
- Presupuestos no muestra qué cuenta está seleccionada, así que el fallo pasa
  desapercibido hasta que la lista abre con movimientos de otra cuenta.
- `navigate(url)` solo cambia la vista y `popstate` solo relee `view`: nadie
  lee la cuenta de la URL.

## Comportamiento nuevo

1. **El enlace lleva la cuenta.** `drilldownUrl` añade
   `accountId=<cuenta del presupuesto>`, tomada de `breakdown.accountId` (con
   `budget.accountId` de reserva). El resto de parámetros no cambia: rango
   (`preset=custom&from&to`), categoría pulsada (o `uncategorized=true`) y los
   criterios que la lista sabe expresar (`payeeId`, `methodId`, `tagId`,
   `status`).
2. **La app lee la cuenta de la URL** en tres sitios: al arrancar (gana a
   `localStorage`), en `navigate(url)` y en `popstate`. Sin el parámetro se
   mantiene la cuenta recordada, como hoy.
3. **La selección y la URL no se contradicen.** Mientras haya cuenta, la URL
   lleva `accountId`; cuando cambia (selector de la barra superior o caída a la
   primera cuenta porque la de la URL ya no existe), se reescribe con
   `replaceState`, sin crear entradas de historial nuevas.
4. **Atrás/adelante siguen funcionando.** Cada entrada guarda su cuenta, así que
   atrás vuelve a Presupuestos con la cuenta que tenía (la de por defecto) y
   adelante a la lista del presupuesto. La cuenta recordada es siempre la de la
   pantalla que se está viendo.
5. **Sin cambios en el servidor.** La lista sigue pidiendo
   `GET /transactions?accountId=<id>&…`; el cliente no filtra ni suma.

Consecuencia: el enlace del detalle se puede recargar y compartir, y abre la
misma lista (cuenta incluida) que se vio al pulsarlo.

## Verificación

- **Test puro del enlace** (`npm test`, vitest): el constructor del drill-down
  devuelve `accountId` del breakdown, el rango, la categoría (o
  `uncategorized=true`) y los criterios; nunca la cuenta de otra fuente.
  Para poder probarlo, la composición de la query sale del componente a una
  función pura (módulo propio, sin `window`).
- **Test puro de la URL de cuenta**: leer `accountId` presente/ausente/inválido
  y escribirlo sin perder `view`, filtros ni rango.
- **Mock** (`npm run mock`, http://localhost:4173/app/): nuevo QA switch
  `?view=budgets&detail=3` que abre el detalle del presupuesto 3 (*Fuel*,
  cuenta *Joint*) con la app en *Everyday* (cuenta 1, la de por defecto). Al
  pulsar una categoría, la barra superior y la lista quedan en *Joint*, y back
  devuelve a Presupuestos con *Everyday*. `detail=1` sigue abriendo el primero.
  Requiere que la tarjeta exponga su id (`data-budget-id`) para que el mock pulse
  el botón correcto, y queda documentado en `README.md` y en `AGENTS.md`.
  En el mock las cifras del reparto son de fixture, así que la igualdad
  *fila = lista* se comprueba en el teléfono; aquí se verifica la cuenta, el
  rango, la rama y los criterios.
- **Visual** 1440×900 y 390×844, ambos temas y ambos idiomas: sin errores de
  consola, sin desbordamiento horizontal, el selector de cuenta visible y
  correcto en Transacciones, y el botón atrás devolviendo a Presupuestos.
- **Documentación en el mismo commit**: `AGENTS.md` (Current state,
  navegación/cuenta y QA switches), `webui/webapp/README.md` (QA switch nuevo) y
  este archivo. `webui/API.md` no cambia porque el contrato no cambia.

## Límites (delta sobre el original)

- Always: la cuenta viaja en la URL del salto y el estado se rellena desde ahí;
  el filtrado es del servidor.
- Ask first: poner un selector de cuenta en Presupuestos, o llevar la cuenta a
  los enlaces del panel de informes (hoy no navegan).
- Never: cambiar el endpoint de transacciones, sumar en cliente, romper
  `?view=`/los filtros existentes, ni guardar la cuenta en el servidor.

## Criterios de éxito

- Un presupuesto de otra cuenta abre sus movimientos **en su cuenta**.
- La suma de la lista sigue cuadrando con la fila del reparto del panel.
- Recargar, compartir y atrás/adelante abren la misma cuenta que la lista.
- `npm test`, `npm run build` y la documentación al día; sin cambios de API.

## Fuera de alcance (diferido)

- Selector de cuenta dentro de Presupuestos.
- "Todas las cuentas" en Transacciones (los informes sí lo tienen).
- Recordar una cuenta distinta por pantalla.

## Alternativas consideradas

- **B — solo estado**: pasar un `onAccount` a Presupuestos y cambiar la cuenta
  al navegar. Menos código, pero el enlace no se puede compartir ni recargar con
  la misma cuenta, y atrás/adelante no la recuperan. Se descarta por eso.

## Preguntas abiertas

- ¿`accountId` en la URL es el nombre correcto, o preferís `account`? Se propone
  `accountId` por coherencia con el DTO y con los parámetros de la API.
