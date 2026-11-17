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

## Causas a confirmar

- `createSplitTransaction` (`webui/.../AndroidWebApiDataSource.kt:429-500`)
  valida y delega en el repositorio. El 422 viene de
  `SQLiteConstraintException` capturada en `WebInputService.kt:319`.
- **Comparte patrón con `SPEC-presupuestos-escritura.md`**: el padre de la
  dividida se escribe con `cat_id = SPLIT_CATID` (0), y la asignación por defecto
  del presupuesto también usa `cat_id = 0`; ambas fallan, y una transacción
  simple con `cat_id = 1` funciona. Sospecha principal: la fila especial de
  categoría 0 o su clave foránea. Se confirma con el log del dispositivo antes
  de tocar nada.
- Si la causa es de esquema, el arreglo debe mantener compatibilidad con las
  divididas que ya existen creadas desde la app.

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
