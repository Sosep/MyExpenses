# SPEC: datos-escritura (M3)

Estado: **implementado**. CRUD por HTTP de los maestros que la app gestiona en
Ajustes > Datos, con las reglas del repositorio Android (la web no las duplica).

## Contrato (extiende `webui/API.md`)

| Recurso | Rutas | Reglas |
|---|---|---|
| Categorías | `POST/PUT /categories`, `DELETE /categories/{id}?remapTo=` | `label` obligatorio; el hijo hereda el tipo del padre; `PUT` no mueve de padre (`422 unsupported_move`); el borrado exige `remapTo` si la rama tiene movimientos (`409 category_in_use`) y remapea antes de borrar; `remapTo` no puede estar en la rama borrada |
| Métodos | `POST/PUT /methods`, `DELETE /methods/{id}` | `label` obligatorio; `type` -1/0/1; `accountTypes` ids de `/account-types`; borrar limpia las asociaciones |
| Etiquetas | `POST/PUT /tags`, `DELETE /tags/{id}` | `label` obligatorio; el borrado limpia las asociaciones de transacciones |
| Divisas | `GET/POST /currencies`, `PUT/DELETE /currencies/{code}` | `GET` devuelve `code,label,symbol,fractionDigits,commodityType` (FIAT, SECURITY, CRYPTO, COMMODITY) y `priceMinor` (último precio en bruto); alta de activo con código/símbolo/dígitos; código existente `409 currency_already_defined`; borrar en uso `409 currency_still_used`; `fractionDigits` 0..8 |
| Precios | `GET /prices?commodity=`, `POST /prices`, `PUT/DELETE /prices/{commodity}/{date}` | historial manual por activo a la divisa base; `value` real (mayor a mayor) > 0; único por (activo, fecha, fuente `USER`): guardar reemplaza, editar exige que exista, borrar inexistente `404 price_not_found` |

## Implementación

- `AndroidWebApiDataSource` usa `saveCategory`/`deleteCategory`,
  `createPaymentMethod`/`updatePaymentMethod`/`deleteMethod`, `TAGS_URI`,
  `insertCurrency`/`updateCurrency`/`deleteCurrency`/`isCurrencyUsed` y
  `savePrice`/`deletePrice` con `ExchangeRateSource.User`; `currencyContext` se
  invalida al cambiar una divisa. El borrado con remapeo llama a
  `Repository.mergeCategories` (transacciones, partes, plantillas, registro de
  cambios y asignaciones) y a la actualización de filtros de cuenta/presupuesto;
  no reimplementa el movimiento de filas. `remapTo` debe existir, quedar fuera de
  la rama y compartir el tipo.
- El remapeo de categoría actualiza `catid` de la rama (padres e hijos, partes
  de split incluidas) antes del borrado; plantillas y presupuestos quedan para
  V2, como el `move`/`merge`.
- `ApiRoutesTest` cubre alta de categoría, `409` sin remapeo, `204` con
  remapeo, métodos, etiquetas, divisas (alta y `409` en uso) y precios.

## Mock

`dev/mock-server.mjs` mantiene categorías, métodos, etiquetas, divisas y
precios en memoria con las mismas respuestas (incluye `409` y `404`).
