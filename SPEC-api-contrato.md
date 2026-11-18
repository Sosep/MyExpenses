# Spec: api-contrato — cuentas y límites como dice el contrato — V1

Status: implementado (18-nov-2026).
Scope: `GET /accounts*`, el DTO de cuenta y el DTO de método en `:webui`, la
validación de `limit`/`offset` y la documentación. Sin cambios de esquema.
Hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md).

## Objetivo

Que el API devuelva lo que `API.md` promete, para que el cliente no tenga que
adivinar: la cuenta por id, todos los campos documentados, los tipos con el
nombre que usa la app y los errores de paginación como errores, no recortes
silenciosos.

## Comportamiento actual (evidencia)

- `GET /accounts/1` → **404** aunque `GET /accounts` lista la cuenta 1. La ruta
  no existe.
- `AccountDto` no incluye `openingBalanceMinor` ni `parentId`, que `API.md` §4.2
  documenta.
- `accounts[].type` es **`"1"`** (id numérico) mientras la doc dice `"BANK"`, y
  `methods[].accountTypes` son ids (`["2"]`). La SPA compara `account.type ===
  'CASH'` y `method.accountTypes.includes(account.type)`: hoy funciona por
  casualidad (ids contra ids) pero la doc y el mock (`"BANK"`, `"CASH"`) dicen
  otra cosa, así que la QA contra el mock no representa al móvil.
- `limit=501` y `limit=0` responden **200** con el valor recortado; la doc dice
  1–500 y no documenta recorte. `offset` negativo no se valida.

## Comportamiento nuevo

1. `GET /accounts/{id}` devuelve el mismo objeto que la lista; id desconocido →
   `404 account_not_found`.
2. `AccountDto` incorpora `openingBalanceMinor` y `parentId` (null cuando no
   aplica).
3. `type` viaja con el **nombre** de la cuenta (`CASH`, `BANK`, `CCARD`,
   `ASSET`, `LIABILITY`, los que usa la app) y `methods[].accountTypes` con esos
   mismos nombres. El cliente sigue comparando nombres, sin traducción.
4. `limit` fuera de 1–500 → `400 invalid_limit` con el rango en el mensaje;
   `offset` negativo o no numérico → `400 invalid_offset`. Sin recortes
   silenciosos.
5. `API.md` §4.2 y §4.4 reflejan lo anterior, y el mock usa ya los mismos
   nombres (no cambia).

## Verificación

- `ApiRoutesTest`: cuenta por id (200 y 404), `limit=0/501` y `offset=-1` → 400,
  y el DTO con los campos nuevos.
- **Dispositivo**: `GET /accounts`, `GET /accounts/1` y una transacción con
  método muestran nombres (`BANK`, `Tarjeta de crédito`) y la SPA pinta el
  selector de método como antes.
- Manual: abrir el editor de una transacción en una cuenta bancaria y
  comprobar que los métodos siguen ofreciéndose.

## Límites

- Always: los nombres salen de la app (`AccountType`), no de una tabla nueva en
  el API; el cliente no traduce ids.
- Ask first: tocar `API.md` donde describe datos que también consume la app
  Android (el esquema no cambia).
- Never: romper `GET /accounts` (lista) ni los filtros existentes por tipo.

## Criterios de éxito

- `GET /accounts/{id}` responde 200 con el mismo objeto de la lista y 404 con un
  id que no existe.
- Una cuenta y una transacción reales muestran `BANK`/`Tarjeta de crédito`, no
  `1`/`CREDITCARD`.
- `limit=501`, `limit=0` y `offset=-1` dan 400 con su código.
- `npm test`, `:webui:testDebugUnitTest` y `ktlintCheck` en verde; `API.md` al día.

## Fuera de alcance

- Escritura de cuentas: va en [`SPEC-cuentas-escritura.md`](./SPEC-cuentas-escritura.md).
- Traducir los nombres de tipo al idioma activo: se mantiene el nombre técnico
  de la app, como en el resto del contrato.
