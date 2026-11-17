# Spec: divididas — alta fiable por HTTP — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md)
Scope: alta/edición de divididas por HTTP y la restricción que hoy la bloquea.

## Objetivo

Que el editor de transacción dividida pueda guardar. Hoy el servidor rechaza
cualquier dividida válida con `422 constraint_violation`, así que la única forma
de crear una es la app Android.

## Comportamiento actual (evidencia del QA)

| Cuerpo | Resultado |
|---|---|
| partes `-6000` + `-4000`, padre `-10000`, categoría 1 | **422 constraint_violation** |
| una sola parte `-10000` | **422 constraint_violation** |
| partes sin `categoryId` | **422 constraint_violation** |
| suma distinta del padre | 422 correcto (`Sum must equal amountMinor`) |
| `parts: []` | 422 correcto (`A split needs at least one part`) |
| categoría inexistente en la parte | 422 correcto (`invalid_parts[0].categoryId`) |

Las validaciones previas funcionan; el fallo ocurre al escribir en la base.

## Comportamiento nuevo

1. `POST /split-transactions` crea padre y partes con el mismo `uuid`, padre con
   `categoryId = SPLIT_CATID`, parte por parte su importe con signo, y responde
   `201` + `Location`.
2. `PUT /split-transactions/{id}` reemplaza partes y datos del padre (alta, baja
   y cambio) sin violar restricciones.
3. `DELETE /transactions/{id}` de una dividida sigue borrando padre y partes.
4. La lista la muestra como `kind: "SPLIT"` y los informes por categoría suman
   las partes, no el padre (comportamiento actual que no debe cambiar).

## Causa confirmada

`createSplit` asigna **el mismo `uuid`** al padre y a todas las partes
(`AndroidWebApiDataSource.kt:460, 464, 503`), y el esquema declara un índice
único sobre la terna:

```sql
CREATE UNIQUE INDEX transactions_account_uuid_index
  ON transactions(account_id, uuid, status)      -- BaseTransactionDatabase.kt:340-341
```

Padre y partes comparten cuenta, `uuid` y `cr_status = UNRECONCILED`, así que la
segunda fila del lote choca: `SQLiteConstraintException` → `422
constraint_violation`. Con una sola parte ya choca, que es lo que se midió.

La app Android no cae en esto porque cada `TransactionEditData` nace con su
propio `generateUuid()` (`TransactionEditViewModel.kt:555` y siguientes): el
`uuid` compartido es una suposición de la capa web, no del modelo. `API.md`
también lo dice mal ("mismo `uuid` en padre y partes") y hay que corregirlo.

El arreglo es dar un `uuid` propio a cada parte al construir el lote (el padre
conserva el suyo) y ajustar la documentación.

## Ficheros

- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
- `myExpenses/src/main/java/org/totschnig/myexpenses/db2/` (ruta de alta de divididas)
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`
- `webui/API.md` §4.3 (nota de la causa si cambia una regla)

## Estrategia de verificación

- `ApiRoutesTest`: alta válida (201), suma incorrecta (422), sin partes (422),
  categoría inexistente (422), y edición que añade y quita partes.
- En dispositivo: crear una dividida de dos partes desde la SPA, reabrirla,
  cambiar una parte, borrarla y comprobar el saldo de la cuenta.

## Límites

- Always: los importes de las partes son con signo y suman el padre.
- Always: la cuenta del padre no se puede cambiar al editar (422 actual).
- Never: relajar una validación de dominio para que pase el `INSERT`.

## Criterios de éxito

- `POST /split-transactions` devuelve 201 con dos partes que suman el padre.
- El detalle devuelve `kind: "SPLIT"` con sus partes y el mismo `uuid`.
- El borrado deja la cuenta con el saldo de antes de crear la dividida.
- La edición desde la SPA guarda y al reabrir muestra lo guardado.

## Fuera de alcance

- Partes con transferencia (`parts[].transferAccountId`, v2).
- Editar una dividida desde la app Android.
