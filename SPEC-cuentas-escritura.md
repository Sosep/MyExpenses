# Spec: cuentas-escritura — crear, editar y borrar cuentas por HTTP — V1

Status: implementado (18-nov-2026). El editor de alta vive en el topbar (`+`) y
`parentId` responde `422 unsupported_account_hierarchy` en vez de ignorarse.
Scope: rutas de escritura de `/accounts`, el repositorio de cuentas y la SPA
(selector y editor de cuentas). Sin cambios de esquema.
Depende de [`SPEC-api-contrato.md`](./SPEC-api-contrato.md) (nombres de tipo).

## Objetivo

Poder montar un entorno de pruebas completo desde la web —y probar las
transferencias, que hoy necesitan dos cuentas y el sandbox solo tiene una— sin
tocar el móvil. La app Android sigue siendo la fuente de verdad.

## Comportamiento actual

- `POST /accounts` **no existe**: el API que sirve el móvil (4.1.4) no crea
  cuentas. Con una sola cuenta en el sandbox, `POST /transfers` solo se puede
  probar por el lado del error (misma cuenta → `422 invalid_transfer`), y una
  prueba de transferencias de verdad es imposible por HTTP.
- La app sí sabe crear cuentas (`RepositoryAccount` / `AccountType`), así que la
  regla de dominio ya existe; falta exponerla.

## Contrato

`POST /accounts` → `201` + `Location: /api/v1/accounts/{id}`:

```json
{
  "label": "Cuenta de pruebas",
  "type": "BANK",
  "currency": "EUR",
  "openingBalanceMinor": 0,
  "excludeFromTotals": false,
  "color": null,
  "parentId": null
}
```

- `label`, `type` y `currency` son obligatorios; `type` usa los nombres de
  `AccountDto` (`CASH`, `BANK`, ...); `currency` es un código ISO que exista en
  el contexto de divisas.
- `parentId` solo para cuentas hijas (tipos `ASSET`/`LIABILITY`); en otro caso
  `422 validation_failed`.
- La cuenta nace sin movimientos; el saldo de apertura se guarda como el de la
  app (`openingBalanceMinor`, en unidades menores).

`PUT /accounts/{id}`: mismos campos. `label`, `openingBalanceMinor`,
`excludeFromTotals`, `color` y `parentId` se pueden cambiar; `type` y `currency`
**no** cuando la cuenta ya tiene movimientos (`422 unsupported_account_change`).

`DELETE /accounts/{id}`: **borra la cuenta y sus movimientos**, como la app
(`RepositoryAccount.deleteAccount` → el provider elimina en cascada y actualiza
las parejas de transferencia). `204` si existía; `404 account_not_found` si no;
`409 account_sealed` cuando la cuenta tiene una deuda sellada, el único caso que
la app también rechaza. El cliente pide confirmación diciendo cuántos
movimientos se van a borrar; el servidor no la pide.

## Interfaz

- Selector de cuenta del topbar: `Nueva cuenta` abre un panel con etiqueta, tipo,
  divisa, saldo inicial y "excluir de totales".
- La cuenta creada se selecciona al guardar y la lista se refresca.
- No hay botón de borrar en V1 (solo API y, si se añade, dentro del editor de la
  cuenta con confirmación).

## Verificación

- `ApiRoutesTest`: alta (201 + Location), validaciones (tipo/divisa/cuenta
  padre), edición, cambio de tipo con movimientos → 422, borrado vacía → 204 y
  con movimientos → 409.
- **Dispositivo**: crear dos cuentas desde la web, hacer una transferencia entre
  ellas con `POST /transfers`, comprobarla en la app Android (dos caras, mismos
  importes), borrar una cuenta con movimientos y comprobar que desaparecen sus
  transacciones y la pareja de transferencia queda coherente.
- SPA: `npm test` del formulario (validación local de saldo inicial) y QA visual
  del panel.

## Límites

- Always: la creación pasa por el repositorio de la app, no por un `INSERT`
  suelto en el API; la divisa se valida contra el contexto.
- Ask first: cambiar el borrado en cascada por un traslado de movimientos a otra
  cuenta (no está en la app y no entra en V1).
- Never: crear cuentas sin divisa o con tipo desconocido; duplicar reglas de
  saldo inicial en el cliente.

## Criterios de éxito

- Dos cuentas creadas por HTTP permiten una transferencia completa y coherente
  en el móvil (mismo `uuid`, caras espejo, saldos cuadrados).
- El entorno de pruebas se puede reconstruir desde cero sin tocar el móvil.
- Una cuenta con movimientos se puede borrar (con los movimientos) y no cambia
  de tipo; con deuda sellada responde `409 account_sealed`.
- `npm test`, `:webui:testDebugUnitTest` y `ktlintCheck` en verde; `API.md` al día.

## Fuera de alcance

- Cuentas compartidas, selladas o con sincronización.
- Editar o borrar desde la lista de cuentas (V1: solo el alta desde el selector).
