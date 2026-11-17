# API web de MyExpenses (borrador de contrato)

Estado: **lectura, escritura simple, transferencias, divididas, ficheros,
presupuestos e informes implementados**. El resto del documento describe el
contrato objetivo (plantillas y v2).
Alcance: API JSON consumida por la web app de escritorio. La app Android sigue
siendo la fuente de verdad; el servidor corre en el móvil (Ktor, dentro del
módulo `:webui`). Interfaz y sistema visual: [`DESIGN.md`](./DESIGN.md).

## 1. Principios

1. **Un solo origen.** La web app se sirve desde el mismo Ktor (`/app`), así que
   no hay CORS en producción y las credenciales viajan en la misma sesión.
2. **El API no formatea.** Nada de `amountFormatted`, `dateFormatted` ni textos
   traducidos. El cliente decide cómo presentar.
3. **Dinero exacto.** Importes en unidades menores (`Long`) + código de divisa.
   Nunca `Float`.
4. **Fechas ISO.** `YYYY-MM-DD` y `HH:mm`. Se interpretan en la zona horaria del
   dispositivo que aloja el servidor.
5. **Lectura unificada, escritura explícita.** Una transacción se lee con un
   modelo único (`kind`), pero se crea/actualiza por endpoints distintos según
   sea simple, transferencia o dividida, porque las reglas de dominio difieren.
6. **El servidor arma el dominio.** El cliente no construye las dos caras de una
   transferencia ni el padre de un split; envía la intención y el servidor
   deriva `uuid`, `SPLIT_CATID`, importes espejo, etc.
7. **Errores como datos.** Cuerpo JSON con código, mensaje y errores por campo.

## 2. Convenciones

- Base: `/api/v1`
- `Content-Type: application/json; charset=utf-8`
- IDs: `Long` (los de la base local; no son globales, `uuid` se expone solo como
  lectura cuando aporta).
- Errores HTTP: `400` petición malformada, `401` no autenticado, `404` no existe,
  `409` conflicto de estado, `422` validación, `500` error interno.
- Cuerpo de error:

```json
{
  "error": "validation_failed",
  "message": "El importe de las partes no coincide con el total",
  "fields": { "parts": "la suma debe ser -10000" }
}
```

- Paginación: `limit` (por defecto 50, máximo 500) y `offset`. Respuesta:

```json
{ "items": [ ... ], "total": 1234, "limit": 50, "offset": 0 }
```

  Se reserva `cursor` para más adelante; el cliente no debe asumir offset estable
  si hay escrituras concurrentes.
- Filtros explícitos. **No** se aplican los filtros guardados por la app salvo
  `useSavedFilters=true`.

## 3. Autenticación

Sesión por cookie con la contraseña de `PrefKey.WEBUI_PASSWORD`. Basic ya no se
usa en la SPA.

- `POST /api/v1/session` con `{"password": "..."}` → `204` y
  `Set-Cookie: myexpenses_session=…; HttpOnly; SameSite=Strict; Path=/`, más
  `Secure` cuando el servidor usa HTTPS. Contraseña incorrecta: `401
  unauthorized`.
- `DELETE /api/v1/session` → borra el token y la cookie (`204`).
- La cookie vale 7 días con expiración deslizante; los tokens viven en memoria
  del servicio, así que reiniciar el servidor obliga a entrar de nuevo.
- `/app` es el shell público; `/api/v1/**` y las descargas exigen sesión cuando
  hay contraseña. Sin contraseña configurada el API queda abierto, como antes.
- `/` redirige a `/app/` y `/download` a `/app/?view=files`; el formulario HTML
  antiguo ya no se sirve.
- CSRF: `SameSite=Strict` y misma origen. La SPA usa `credentials: same-origin`
  y no guarda la contraseña ni la cookie en JavaScript.
- Nunca se registra la contraseña ni el token en logs.

## 4. Recursos

### 4.1 Meta

`GET /meta`

```json
{
  "appVersion": "3.x",
  "serverTime": "2026-11-17T10:00:00",
  "timeZone": "Europe/Madrid",
  "locale": "es-ES",
  "homeCurrency": "EUR",
  "currencies": [
    { "code": "EUR", "symbol": "€", "fractionDigits": 2 }
  ],
  "features": { "webUi": true, "attachments": true, "templates": true },
  "preferences": {
    "timeEnabled": false,
    "valueDateEnabled": false,
    "aggregateNeutral": false
  }
}
```

`fractionDigits` es necesario porque la app permite dígitos personalizados por
divisa; el cliente formatea con eso, no con un valor fijo.

### 4.2 Cuentas

`GET /accounts` — incluye saldos, que ya calcula el provider:

```json
[
  {
    "id": 1,
    "label": "Cuenta corriente",
    "type": "BANK",
    "currency": "EUR",
    "openingBalanceMinor": 0,
    "currentBalanceMinor": 123456,
    "totalMinor": 123456,
    "incomeMinor": 500000,
    "expensesMinor": -376544,
    "excludeFromTotals": false,
    "sealed": false,
    "color": -16776961,
    "parentId": null
  }
]
```

`GET /accounts/{id}` — mismo objeto.

Cuenta virtual para el dashboard: `GET /accounts?includeAggregate=true` añade un
elemento con `id: "all"` (en la app son IDs negativos) y saldos convertidos a la
divisa base. Alternativa más simple para v1: el cliente suma solo cuentas de la
misma divisa y el dashboard avisa si hay divisas mixtas.

### 4.3 Transacciones

Modelo de lectura (`kind` explícito):

```json
{
  "id": 10,
  "kind": "SIMPLE",
  "accountId": 1,
  "amountMinor": -1234,
  "currency": "EUR",
  "date": "2026-11-17",
  "time": null,
  "valueDate": "2026-11-17",
  "payee": { "id": 5, "name": "Mercadona" },
  "category": { "id": 12, "label": "Supermercado", "path": ["Alimentación", "Supermercado"] },
  "tags": [ { "id": 3, "label": "semanal" } ],
  "comment": "compra",
  "method": { "id": 2, "label": "Tarjeta" },
  "referenceNumber": null,
  "crStatus": "UNRECONCILED",
  "transferPeerId": null,
  "transferAccountId": null,
  "splitParts": null,
  "attachments": []
}
```

- `kind`: `SIMPLE` | `TRANSFER` | `SPLIT`
- En `TRANSFER`, `transferPeerId` apunta a la otra cara (misma `uuid`).
- En `SPLIT`, `splitParts` trae las partes; el padre lleva `categoryId = 0`
  (marca interna `SPLIT_CATID`), que el API traduce a `kind: "SPLIT"` y no
  expone como categoría.
- Las etiquetas se cargan siempre (`withTags = true`). El modelo actual ya las
  devuelve.

Endpoints:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/transactions?accountId&from&to&type&categoryId&payeeId&tagIds&search&limit&offset` | Lista paginada; `type`: `income`/`expense`/`both` |
| GET | `/transactions/{id}` | Detalle con partes, peer y etiquetas |
| POST | `/transactions` | Crear simple |
| PUT | `/transactions/{id}` | Actualizar simple |
| DELETE | `/transactions/{id}` | Borrar cualquier tipo (el provider ya borra hijos y peer) |
| POST | `/transfers` | Crear transferencia |
| PUT | `/transfers/{id}` | Actualizar transferencia (id de cualquiera de las dos caras) |
| POST | `/split-transactions` | Crear dividida |
| PUT | `/split-transactions/{id}` | Reemplazar partes y datos del padre |

#### POST /transactions

```json
{
  "accountId": 1,
  "amountMinor": -1234,
  "date": "2026-11-17",
  "time": null,
  "valueDate": "2026-11-17",
  "payeeId": 5,
  "categoryId": 12,
  "tagIds": [3],
  "comment": "compra",
  "methodId": 2,
  "referenceNumber": null
}
```

Servidor: valida cuenta/categoría/beneficiario/método, construye `Transaction`
con `uuid = generateUuid()`, `crStatus = UNRECONCILED`, y delega en
`Repository.createTransaction`. Responde `201` + `Location`.

El cuerpo se deserializa en `TransactionWriteDto`: los campos opcionales son
nullables y el servidor aplica los valores por defecto. Si `time` se omite, la
fecha se guarda a mediodía; si `valueDate` se omite, se usa `date`.

#### PUT /transactions/{id}

Mismos campos. Reglas:

- `crStatus` **no** se envía: se conserva el actual (corrige el bug actual que lo
  resetea a `UNRECONCILED`).
- Si la transacción no es `SIMPLE`, responde `409 unsupported_kind` y sugiere el
  endpoint correcto.
- Etiquetas: se reemplaza la lista si viene `tagIds`, incluida una lista vacía;
  si se omite, se conservan.
- Si `time` se omite, se conserva la hora local existente; si `valueDate` se
  omite, se conserva el valor existente. Así una edición parcial no mueve la
  transacción a mediodía ni pierde la fecha valor.
- `uuid` no se modifica.

#### Estado de implementación

Implementado en `/api/v1`: lectura, alta/edición/borrado de transacciones
**simples**, **transferencias** y **divididas**. La SPA usa los tres editores.
Presupuestos, informes y ficheros son el siguiente contrato; las reglas de
dominio de transferencias y divididas se validan también en el dispositivo.

#### POST /transfers

```json
{
  "fromAccountId": 1,
  "toAccountId": 2,
  "amountMinor": 5000,
  "date": "2026-11-17",
  "time": null,
  "valueDate": "2026-11-17",
  "payeeId": null,
  "comment": "traspaso",
  "methodId": null,
  "referenceNumber": null,
  "tagIds": []
}
```

Servidor: `amountMinor` es **magnitud positiva**; genera las dos caras (origen
`-5000`, destino `+5000`), mismo `uuid`, categoría de transferencia por defecto,
`transferAccountId`/`transferPeerId` cruzados, y llama a
`Repository.createTransaction(RepositoryTransaction(...))`. Rechaza la misma
cuenta con `422`. `tagIds` es opcional: se aplica a ambas caras.

#### PUT /transfers/{id}

Cuerpo igual. El servidor carga la pareja (`loadTransaction` con peer), aplica
los cambios a ambas caras y actualiza la pareja. Se permite cambiar las cuentas
de origen/destino; validar el caso en dispositivo. Si `tagIds` se omite, cada
cara conserva sus etiquetas.

#### POST /split-transactions

```json
{
  "accountId": 1,
  "amountMinor": -10000,
  "date": "2026-11-17",
  "time": null,
  "valueDate": "2026-11-17",
  "comment": "compra grande",
  "tagIds": [2],
  "parts": [
    { "amountMinor": -6000, "categoryId": 3, "tagIds": [1], "comment": "comida" },
    { "amountMinor": -4000, "categoryId": 4, "payeeId": 7 }
  ]
}
```

Reglas (ya existen en `createSplitTransaction`):

- al menos una parte; cada `parts[].amountMinor` es distinto de cero y **con signo**
- `sum(parts.amountMinor) == amountMinor`
- todas las partes comparten cuenta y fecha; `categoryId = SPLIT_CATID` en el padre
- mismo `uuid` en padre y partes; etiquetas por padre y por parte
- partes con transferencia: v2 (`parts[].transferAccountId`)

Update: `PUT /split-transactions/{id}` envía el mismo cuerpo. Una parte con `id`
actualiza la existente; las existentes que no se envían se borran; una parte sin
`id` se inserta. La cuenta del padre no se puede cambiar en este corte (`422`).
`updateSplitTransaction` gestiona altas, bajas y cambios de forma atómica.

### 4.4 Categorías, beneficiarios, etiquetas, métodos

| Recurso | Endpoints | Notas |
|---|---|---|
| Categorías | `GET /categories?tree=true` · `POST/PUT/DELETE /categories[/{id}]` | `tree` devuelve `id,parentId,label,level,color,type`; `move`/`merge` en v2 |
| Beneficiarios | `GET /payees` · `POST/PUT/DELETE /payees[/{id}]` | modelo `Party`: `name,shortName,iban,bic,parentId` |
| Etiquetas | `GET /tags` · `POST/PUT/DELETE /tags[/{id}]` | requiere envoltorio nuevo en `db2` (hoy la creación vive en la UI) |
| Métodos | `GET /methods` · `POST/PUT/DELETE /methods[/{id}]` | incluye `type` y `accountTypes` para filtrar en el formulario |

"Contraparte" en la app son dos cosas distintas: **payee** (pagador/beneficiario)
y **transfer peer** (la otra cara de una transferencia). El API las expone por
separado; el editor de transferencias no usa `payee` para elegir la cuenta.

### 4.5 Presupuestos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/budgets` | Lista con configuración |
| GET | `/budgets/{id}?year&second` | Progreso del periodo (gastado, asignado, restante) |
| POST/PUT/DELETE | `/budgets[/{id}]` | CRUD |

`BudgetDto`:

```json
{
  "id": 1,
  "accountId": 1,
  "title": "Groceries",
  "description": null,
  "currency": "EUR",
  "fractionDigits": 2,
  "grouping": "MONTH",
  "color": 0,
  "start": null,
  "end": null,
  "accountName": "Everyday",
  "isDefault": false,
  "uuid": "…"
}
```

`BudgetProgressDto` (periodo actual si se omite `year`/`second`):

```json
{
  "budgetId": 1,
  "accountId": 1,
  "title": "Groceries",
  "currency": "EUR",
  "fractionDigits": 2,
  "grouping": "MONTH",
  "periodYear": 2026,
  "periodSecond": 11,
  "periodStart": "2026-11-01",
  "periodEnd": "2026-11-30",
  "periodDescription": "November 2026",
  "allocatedMinor": 40000,
  "spentMinor": 31200,
  "remainingMinor": 8800,
  "totalDays": 30,
  "currentDay": 17
}
```

- `spentMinor` es positivo (gasto del periodo); `remainingMinor = allocated - spent`
  y puede ser negativo (sobregiro).
- El servidor reutiliza `loadBudgetProgress` y `sumLoaderForBudget`; el cliente no
  suma transacciones.
- `year` y `second` van juntos; si falta uno, `400 invalid_period`. `second` sigue
  la agrupación (día del año, semana, mes o año).
- `GET /budgets/{id}` devuelve el progreso, no la configuración; la configuración
  viene en la lista. Un id desconocido es `404 budget_not_found`.
- Los presupuestos de cuentas y divisas distintas se devuelven en la misma lista;
  el cliente solo agrega importes cuando comparten divisa y periodo.
- `grouping` usa los nombres de la app: `DAY`, `WEEK`, `MONTH`, `YEAR`, `NONE`.
- `allocationMinor` es la asignación por defecto (la fila sin año ni periodo), o
  `null` si el presupuesto solo tiene asignaciones por periodo. El editor la usa
  como importe inicial.

#### POST /budgets

```json
{
  "accountId": 1,
  "title": "Groceries",
  "description": null,
  "grouping": "MONTH",
  "start": null,
  "end": null,
  "isDefault": false,
  "amountMinor": 40000
}
```

- `201` + `Location: /api/v1/budgets/{id}`; responde `BudgetDto`.
- `accountId`, `title`, `grouping` y `amountMinor` son obligatorios;
  `amountMinor` no puede ser negativo.
- `grouping` inválido: `422 invalid_grouping`.
- `NONE` exige `start` y `end` (`YYYY-MM-DD`, `end >= start`); los demás tipos no
  admiten fechas (`422 validation_failed`).
- La divisa y `fractionDigits` se derivan de la cuenta.
- La asignación inicial se guarda como asignación por defecto (categoría 0, sin
  periodo), igual que en la app.

#### PUT /budgets/{id}

Mismo cuerpo. Actualiza título, descripción, fechas de `NONE` e `isDefault`. Si
`amountMinor` viene, actualiza la asignación por defecto; no toca las
asignaciones por periodo ni el rollover. La cuenta y el `grouping` no se pueden
cambiar (`422 unsupported_move` / `422 unsupported_grouping_change`); omite
`start`/`end` en `NONE` para conservar las fechas actuales.

#### GET /budgets/{id}/allocations?year&second

Lista por categoría con `allocatedMinor` y `spentMinor` del periodo. Sin
`year`/`second` usa el periodo actual; `year` y `second` van juntos.

#### PUT /budgets/{id}/allocations

```json
{
  "year": 2026,
  "second": 11,
  "allocations": [
    { "categoryId": 2, "amountMinor": 35000 },
    { "categoryId": 0, "amountMinor": 45000, "oneTime": true }
  ],
  "rollover": [{ "categoryId": 2, "amountMinor": 5000 }]
}
```

Actualiza la asignación de cada categoría para ese periodo. No admite
presupuestos `NONE` (`422 unsupported_grouping`).

- `categoryId: 0` es el **total del periodo**. `oneTime: true` evita que ese
  importe se convierta en el valor recurrente de meses posteriores.
- `amountMinor: null` borra el override de esa categoría/periodo y vuelve al
  valor por defecto.
- `rollover` es opcional y solo para `MONTH`/`YEAR`: escribe `rollOverNext` en el
  periodo actual y `rollOverPrevious` en el siguiente; un importe `0` lo borra.
- `BudgetProgressDto.periodAllocationMinor` es el importe específico del periodo
  o `null` si se está usando el valor por defecto.

#### POST /budgets/{id}/duplicate

Crea una copia con el título `… (copy)`, la misma configuración y la asignación
por defecto; responde `201` + `Location` con el nuevo `BudgetDto`.

#### DELETE /budgets/{id}

`204` si existía, `404 budget_not_found` si no.

Fuera de este corte: asignación por categoría, rollover entre periodos y
duplicación de presupuestos. Se siguen gestionando en la app Android.

### 4.6 Informes y agrupaciones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reports/grouped?accountId&grouping=DAY\|WEEK\|MONTH\|YEAR\|NONE&from&to` | Serie temporal: ingresos, gastos, transferencias, total por grupo |
| GET | `/reports/summary?accountId&from&to` | Totales del rango |
| GET | `/reports/breakdown?accountId&from&to&by=category\|payee\|tag\|method&type=expense\|income\|both` | Reparto con importe, número y porcentaje |
| GET | `/reports/transactions?accountId&by&id&type&from&to&limit&offset` | Drill-down de un grupo |

`grouping` usa el mismo enum que la app, así los números coinciden con el móvil.
La serie sale de `IAccount.groupingQuery`; el resumen y el reparto usan
`TRANSACTIONS_EXTENDED` con agregación en `ApiQueries.kt`.

`ReportSummaryDto`:

```json
{
  "accountId": 1,
  "from": "2026-11-01",
  "to": "2026-11-30",
  "currency": "EUR",
  "fractionDigits": 2,
  "incomeMinor": 295000,
  "expensesMinor": -113867,
  "netMinor": 181133,
  "count": 59
}
```

`BreakdownDto`:

```json
{
  "accountId": 1,
  "from": "2026-11-01",
  "to": "2026-11-30",
  "by": "category",
  "type": "expense",
  "totalMinor": 113867,
  "items": [
    { "id": 2, "label": "Food > Groceries", "amountMinor": 32407, "count": 15, "share": 28.46 }
  ]
}
```

- Importes del reparto en **magnitud positiva**; `share` es porcentaje 0–100
  calculado en el servidor sobre el total de las filas devueltas.
- `from`/`to` son inclusivos; si se omiten, últimos 12 meses hasta hoy.
- Se excluyen transferencias, movimientos `VOID` y cuentas sin divisa. `type`
  filtra por signo del importe (`expense` por defecto).
- `by=category` agrega las partes de una dividida y excluye el padre; `payee` y
  `tag` cuentan la transacción completa (padre) una vez.
- Una transacción con varias etiquetas aparece en cada etiqueta; el total del
  reparto por etiqueta puede superar el gasto real del periodo.
- `by` admite también `method`; inválido: `400 invalid_by`; `type` inválido:
  `400 invalid_type`; cuenta desconocida: `404 account_not_found`.
- `accountId=all` agrega todas las cuentas en servidor. Si no comparten divisa
  responde `422 mixed_currencies`.
- `/reports/transactions` lista las transacciones de un grupo (`by` + `id`); no
  admite `accountId=all` (`422 unsupported_all_accounts`).

### 4.7 Ficheros

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/files` | Lista de backups/exportaciones (`name`, `size`, `modified`, `link`) |
| GET | `/files/{name}` | Descarga en streaming con `Content-Disposition: attachment` |

Modelo de lectura:

```json
{
  "name": "myexpenses-2026-11-17.backup",
  "size": 482913,
  "modified": 1763373600000,
  "link": "/api/v1/files/myexpenses-2026-11-17.backup"
}
```

- `modified` es epoch en milisegundos; la SPA lo formatea en local.
- Se mantiene el comportamiento actual (`AppDirHelper`): solo ficheros no vacíos
  del directorio de la app, ordenados por fecha descendente.
- El nombre se valida contra travesía de rutas (`/`, vacío) antes de servir;
  cualquier otro nombre se busca con `findFile` y, si no existe, `404`.
- La descarga exige autenticación (Basic hasta la cookie). La SPA no usa un
  `<a href>`: pide el fichero con `fetch`, recibe un `Blob` y lo guarda con
  `URL.createObjectURL`, para enviar la cabecera `Authorization`.
- Implementación: rutas en `WebInputService` porque dependen de `AppDirHelper` y
  del `ContentResolver`; no pasan por `WebApiDataSource`.

### 4.8 Plantillas y planes (v2)

`GET /templates`, `POST /templates/{id}/instantiate`. Fuera de v1.

## 5. Mapeo a la capa de datos

| Endpoint | Implementación existente | Trabajo nuevo |
|---|---|---|
| `/accounts` | query `ACCOUNTS_BASE_URI` (incluye `current_balance`, `total`, `sum_income`, `sum_expenses`) | mapeador a DTO |
| `/transactions` lista | `Repository.loadTransactions(accountId, limit)` | filtros de fecha/tipo/búsqueda + `offset`; hoy aplica filtros guardados y límite 200 |
| `/transactions/{id}` | `Repository.loadTransaction(id, withTransfer = true, withTags = true)` | mapeo de `kind` y partes |
| POST simple | `createTransaction(Transaction)` | validación + DTO |
| PUT simple | `updateTransaction(Transaction)` | conservar `crStatus`; rechazar no-simple |
| DELETE | `deleteTransaction(id)` | ninguna: el provider ya borra hijos y peer |
| transfers | `createTransfer`, `updateTransfer` | construir ambas caras |
| splits | `createSplitTransaction`, `updateSplitTransaction` | validación de suma + DTO |
| categorías | `CATEGORIES_URI` jerárquica, `saveCategory`, `deleteCategory` | mapeador |
| payees | `PAYEES_URI`, `createParty`, `saveParty`, `deleteParty` | mapeador |
| tags | `TAGS_URI`, `saveTagsForTransaction` | **CRUD nuevo** en `db2` |
| methods | `METHODS_URI`, `loadPaymentMethod`, `createPaymentMethod`, `updatePaymentMethod`, `deleteMethod` | mapeador |
| budgets | `loadBudget`, `loadBudgetProgress`, `saveBudget`, `deleteBudget` | mapeador |
| reports/grouped | `IAccount.groupingQuery` / `TransactionsUri/groups/{Grouping}` | mapeador de cursor |
| reports/breakdown | `TRANSACTIONS_SUM_URI` + `groupBy` | **función tipada nueva** en `db2` |
| files | `AppDirHelper` | mapeador + validación de nombre |

Todo es aditivo: no hace falta tocar el esquema de base de datos.

## 6. Decisiones pendientes

1. Sesión por cookie vs Basic en v1.
2. `accountId: "all"` en informes o cliente suma por divisa.
3. Importes en unidades menores (recomendado) vs decimal string.
4. Paginación por `offset` o por cursor `(date,id)`.
5. Moneda y zona horaria: asumir la del móvil (recomendado v1) o enviar offset
   explícito en cada petición.
6. ~~v1 incluye transferencias y splits en escritura~~. El corte actual escribe
   solo transacciones simples; transferencias y divididas van en el siguiente.

## 7. Correcciones sobre el análisis previo

Tras revisar de nuevo el código:

- **Las etiquetas no se pierden** al editar desde la web. `Transaction.projection`
  incluye `KEY_TAGLIST`, `TransactionDTO.fromEntity` lo mapea y el provider trata
  `KEY_TAGLIST` en insert/update. La afirmación anterior era incorrecta.
- **Sí se pierde el estado de conciliación**: `toEntity` fuerza
  `CrStatus.UNRECONCILED` y `updateTransaction` lo escribe.
- **Las transferencias son editables por error en la UI actual**: `fromEntity`
  nunca rellena `transferPeer`, así que el JSON lo omite y
  `transferPeer == undefined` es cierto para una transferencia. El PUT no envía
  `transferAccountId`, por lo que puede dejar la pareja inconsistente. El API
  nuevo debe rechazarlo con `409`.
- **`GET /transactions` aplica los filtros guardados de la app** y un límite de
  200; el API debe exponer filtros explícitos.

## 8. Pruebas

- **Rutas en JVM**: `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`
  con un `WebApiDataSource` fake y Ktor `testApplication`. 32 tests cubren
  routing, validación, `201/204/404/409/422`, JSON, body malformado, los
  endpoints de transferencias/divididas, el CRUD y las asignaciones de
  presupuestos, y los informes con drill-down. Comando:
  `docker compose run --rm android-build :webui:testDebugUnitTest`.
- **Capa Android**: `AndroidWebApiDataSource` y el `ContentProvider` se validan
  en el móvil o con tests instrumentados; los mapeadores puros pueden probarse
  sin Android.
- **Contrato JSON**: la SPA usa el mock server para QA visual; los fixtures
  pueden compartirse cuando se añada Vitest.
- **Pendientes en dispositivo**: suma de split incorrecta, transferencia a la
  misma cuenta, borrado de split, edición de transferencia como simple, importes
  con dígitos personalizados.
