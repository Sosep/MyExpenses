# SPEC: carteras-lectura (M1)

Estado: **implementado**. Carnets de la primera entrega del plan «carteras y
datos de la app en la web»: leer y crear/editar carteras, ver su valoración,
sus activos y sus operaciones. La escritura de operaciones llega en
`SPEC-operaciones-carteras.md`.

## Modelo de dominio (de la app Android)

- **Cartera** = cuenta contenedora con `portfolioRole = PORTFOLIO_CONTAINER`
  (`is_portfolio` en `accounts`). Se crea con `createPortfolio` del ViewModel:
  divisa fiat, tipo de cuenta elegible (INVESTMENT por defecto), color, tipo de
  cambio fijo o dinámico. Sin saldo de apertura: el efectivo entra con un
  Depósito.
- **Hijos**: subcuenta de efectivo (`PORTFOLIO_CASH`, divisa de la cartera,
  tipo CASH, mismo color) y subcuentas de activo (`PORTFOLIO_ASSET`, cuya
  divisa es el símbolo del activo, tipo INVESTMENT, tipo de cambio dinámico).
  Las crea la app al registrar la primera operación (`findOrCreateAssetAccount`
  / `findOrCreateCashAccount`); la web las expone, no las gestiona.
- **Valoración** (`BalanceType.VALUATION`): `saldo del contenedor +
  Σ hijos.conversión(saldo hijo)`, donde la conversión usa el último precio
  almacenado (commodity → divisa de la cartera) y, sin precio, 1.0 (las
  subcuentas de activo son siempre dinámicas y la de efectivo comparte la
  divisa de la cartera).
- **Licencia**: 1 cartera gratis; crear más exige Profesional
  (`ContribFeature.PORTFOLIO`). El chequeo vive en el servidor
  (`LicenceHandler.hasAccessTo`), no en el cliente.

## Contrato HTTP (extiende `webui/API.md`)

### `GET /accounts`

Cada cuenta añade:

- `portfolioRole`: `NONE | CONTAINER | CASH | ASSET`.
- `dynamicExchangeRates`: bool.
- `valuationMinor`: solo en contenedores; valoración en unidades menores de la
  divisa de la cartera. Las subcuentas (efectivo/activos) se **ocultan** del
  selector del topbar y del agregado, igual que en Android.

### `POST /portfolios` / `PUT /portfolios/{id}`

Cuerpo (`PortfolioWriteDto`): `label, type (id de /account-types), currency
(fiat), color, dynamicExchangeRates, exchangeRate`.

- `label` y `currency` obligatorios; `type` obligatorio y existente (422).
- `exchangeRate` obligatorio si `dynamicExchangeRates` es false y la divisa no
  es la base (422 `missing_exchangeRate`); el tipo de cambio debe ser > 0.
- Sin saldo de apertura ni «excluir de totales»: el servidor crea el contenedor
  con `PORTFOLIO_CONTAINER`, guarda el tipo de cambio con
  `storeExchangeRate` cuando la divisa ≠ base y el modo es fijo (mismo flujo
  que `createPortfolio` / `updatePortfolio` del ViewModel).
- Segunda cartera sin licencia Profesional: `409 portfolio_limit_reached`.
- `PUT` no cambia el `portfolioRole` ni reevalúa la licencia; la divisa de una
  cartera con transacciones no puede cambiar (como en cuentas).

### `GET /portfolios/{id}/assets`

`404 portfolio_not_found` si no existe o no es contenedor.

```json
{
  "portfolioId": 7,
  "currency": "EUR",
  "fractionDigits": 2,
  "cashMinor": 25000,
  "cashAccountId": 9,
  "valuationMinor": 37500,
  "assets": [
    {
      "id": 10,
      "label": "Apple Inc.",
      "symbol": "AAPL",
      "fractionDigits": 4,
      "quantityMinor": 30000,
      "priceMinor": 0.5,
      "valuationMinor": 12500
    }
  ]
}
```

- `priceMinor` es el último precio **en bruto**: unidades menores de la divisa
  de la cartera por unidad menor del activo (el valor de la tabla de precios).
  El cliente lo muestra en unidades mayores dividiendo entre
  `10^(fdCartera - fdActivo)` (el `calculateRealExchangeRate` de la app).
- `valuationMinor` por activo = `quantityMinor × tasa (precio o 1.0)`, y la
  valoración total = saldo del contenedor + efectivo + Σ activos (identidad de
  `FullAccount.effectiveBalance`).

### `GET /portfolios/{id}/trades`

Paginada como `/transactions` (`limit`, `offset`), orden fijo por fecha
descendente (la de la app). Cada elemento (`TradeDto`) mapea
`Repository.loadTrades`:

- `id`: transacción padre del split.
- `type`: `BUY | SELL | DEPOSIT | WITHDRAW | TRANSFER_IN | TRANSFER_OUT`
  (la app distingue `TradeType.Transfer(isIncoming)`).
- `date`, `time`, `comment`.
- `assetSymbol`: divisa no fiat del activo; en Depósitos/Retiradas es la divisa
  de la cartera.
- `quantityMinor` + `fractionDigits` (dígitos de la divisa del activo).
- `price`: decimal string (principal / cantidad, como la app) — `null` cuando
  la cantidad es 0; Depósitos/Retiradas devuelven `"1"`.
- `principalMinor`, `feeMinor` (comisiones adicionales agregadas; `null` si no
  hay).
- `peerAccountId`, `peerAccountLabel`: la contraparte de financiación (cuenta
  externa o cartera origen/destino en traspasos).
- `currency`: divisa de la cartera.

`GET /portfolios/{id}/trades/{transactionId}` devuelve un solo `TradeDto`
(404 si no es una operación de esa cartera).

### Errores

| Código | Cuándo |
|---|---|
| `portfolio_not_found` | id inexistente o no contenedor (404) |
| `portfolio_limit_reached` | segunda cartera sin licencia (409) |
| `validation_failed` | campos obligatorios, tipo de cuenta desconocido, divisa desconocida, cambio ≤ 0 (422) |
| `missing_exchangeRate` | modo fijo con divisa ≠ base y sin cambio (422) |

## SPA

- **Editor `+`**: panel con segmentado «Cuenta | Cartera». Cartera: nombre,
  tipo (default INVESTMENT), divisa, tipo de cambio + conmutador «dinámico»
  (solo si divisa ≠ base), color. Sin saldo de apertura ni «excluir de
  totales».
- **Rail** (`Shell.tsx`): con cartera seleccionada se muestran Resumen,
  Transacciones, Informes y Ficheros; Presupuestos se oculta. Con cuenta
  normal no cambia. El selector del topbar lista contenedores y cuentas
  normales, nunca subcuentas.
- **Resumen de cartera** (`Dashboard.tsx`): tarjeta de valoración + efectivo
  aparte y una tabla de activos con cantidad, precio y valoración, cada una con
  su peso en la cartera (`asset-share`). Los importes y precios responden a la
  privacidad `totals` (`Money`/`useMoney`).
- **Operaciones** (`components/Trades.tsx`): cuando la cuenta es cartera, la
  vista Transacciones lista operaciones (tipo, activo, cantidad, precio,
  importe, comisión, contraparte) con la agrupación visual actual; el detalle
  abre en panel (`useHistoryPanel`). El FAB pasa a «Nueva operación»; la
  escritura llegó en M2 y su mock está en `SPEC-operaciones-carteras.md`.
- **Privacidad**: valoración y agregados → `totals`; filas de operaciones →
  `transactions`.

## Mock y QA

`dev/mock-server.mjs` añade fixtures: cartera «Cartera Conjunta» (EUR) con
efectivo, activos AAPL/BTC y operaciones de los tipos Compra, Venta, Depósito,
Retirada y Traspaso (la contraparte es otra cartera del mock), más precios
recientes por activo. QA switches:

- `?view=transactions&accountId=7` — selecciona la cartera como cuenta activa.
- `?new=1&kind=portfolio` — abre el editor en modo cartera.
- `?portfolioLimit=1` — el mock responde `409 portfolio_limit_reached` al
  crear la segunda cartera (`?portfolioLimit=0` desactiva la cookie).
- La subcuenta de efectivo se crea de forma perezosa con la primera operación
  que la necesita, como `findOrCreateCashAccount` en la app.

## Fuera de alcance aquí

Escritura de operaciones (`POST/PUT /portfolios/{id}/trades`), import CSV,
serie histórica de valoración y borrado de activos hijos. Ver
`SPEC-operaciones-carteras.md`.
