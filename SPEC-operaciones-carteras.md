# SPEC: operaciones-carteras (M2)

Estado: **implementado**. Escritura de operaciones de cartera desde la web:
Compra, Venta, Depósito, Retirada y Traspaso entre carteras, sobre el mismo
dominio que usa la app Android.

## Dominio reutilizado

El guardado de operaciones que vivía en `MyExpensesV2ViewModel`
(`saveTradeInternal`, `saveAssetTransfer`, `findOrCreateAssetAccount`,
`findOrCreateCashAccount`) se ha movido a
`myExpenses/.../db2/RepositoryTrades.kt` como extensiones de `Repository`:

- `saveTrades(currentAccount, intents, onProgress)` → lista de ids de la
  transacción padre creada/actualizada; el ViewModel delega y refresca
  `lastTradeFeeCategories` desde su preferencia.
- `saveTrade(currentAccount, intent)` → id.
- Mismas reglas que la app: partes de split con piernas de transferencia,
  subcuentas de activo/efectivo creadas al vuelo, guardado del precio
  (`savePrice` con fuente `User`) y traspaso dual con pierna hub-a-hub.

Sin cambio de comportamiento en el flujo Android (el ViewModel llama a la misma
lógica); la verificación en dispositivo queda pendiente en `AGENTS.md`.

## Contrato HTTP (extiende `webui/API.md`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/portfolios/{id}/trades` | Crear operación (`201` + `Location`) |
| PUT | `/portfolios/{id}/trades/{transactionId}` | Reemplazar operación |
| DELETE | `/transactions/{transactionId}` | Borrar operación (ruta existente) |

Cuerpo (`TradeWriteDto`):

```json
{
  "type": "BUY",
  "assetSymbol": "AAPL",
  "quantity": "3",
  "price": "5.0",
  "feeMinor": 500,
  "feeCategoryId": null,
  "fundingSource": "PORTFOLIO",
  "peerAccountId": null,
  "comment": "",
  "date": "2026-11-12",
  "time": null
}
```

- `type`: `BUY | SELL | DEPOSIT | WITHDRAW | TRANSFER_IN | TRANSFER_OUT`
  (el traspaso entra y sale según la cartera actual).
- `quantity` y `price` son strings decimales en unidades mayores; el principal
  se deriva (`cantidad × precio`) salvo que se envíe `principalMinor`.
- Depósitos y Retiradas: `assetSymbol` se ignora (divisa de la cartera),
  `price` = 1 y `fundingSource` debe ser `ACCOUNT` o `EXTERNAL`; `PORTFOLIO`
  es `422 validation_failed`, como el `require` de `TradeIntent`.
- `fundingSource` (Compra/Venta): `PORTFOLIO` (efectivo de la cartera, por
  defecto), `ACCOUNT` (transferencia desde una cuenta, exige
  `peerAccountId`) o `EXTERNAL` (sin seguimiento).
- Traspaso: `peerAccountId` obligatorio, debe ser otra cartera
  (`CONTAINER`) y distinta; la divisa/valoración viaja en `quantity` y
  `price`.
- `feeMinor` ≥ 0 con `feeCategoryId` opcional (categoría de gasto).
- Cantidad y precio > 0 (`422 validation_failed` con `fields`).
- `PUT` reemplaza la operación (misma lógica que la app: conserva uuids y
  piernas); id desconocido o de otra cartera → `404 trade_not_found`. La
  familia no cambia (`422 unsupported_trade_change`), igual que el segmentado
  del editor Android: Compra/Venta, Depósito/Retirada o Traspaso. Un cambio
  dentro de la familia conserva la financiación (EXTERNAL sigue EXTERNAL); en
  una Entrada por traspaso el selector nombra la cartera **origen**.

## SPA

- `components/TradeEditor.tsx`: panel lateral con segmentado de los seis tipos,
  activo (entrada con sugerencias), cantidad, precio, importe calculado,
  comisión, financiación con `SearchSelect` para la cuenta o la cartera
  destino, fecha (+ hora si la app la usa) y nota. En edición precarga la
  operación y ofrece borrar.
- `Trades.tsx`: botón `New operation` en la cabecera y FAB contextual en la
  vista de cartera; el detalle gana `Edit` y `Delete`.
- El editor se apila sobre el detalle para no encadenar entradas de historial
  (la carrera `back()` + `pushState` cerraba el editor recién abierto). Cada
  panel tiene su propia entrada e id: atrás o `Esc` cierran solo el superior.
- Importes con la privacidad `transactions`; la comisión y el importe usan
  `Money`; el importe es una magnitud sin signo (el tipo ya dice la dirección).

## Mock y QA

`POST/PUT/DELETE /portfolios/{id}/trades` en `dev/mock-server.mjs` con estado
en memoria: aplica (o revierte) el efecto de cada operación sobre efectivo y
cantidades, actualiza el último precio, recalcula la valoración y crea la
subcuenta de efectivo cuando la operación la necesita. Las
eliminaciones desde el editor van por `DELETE /transactions/{id}`, que el mock
redirige a la operación si no es una transacción simple.

QA: `?view=transactions&accountId=7`, `New operation`, editar y borrar. El
mock no reproduce las queries Kotlin ni la valoración exacta del contenedor;
eso se comprueba en el móvil.
