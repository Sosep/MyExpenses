# Spec: presupuestos-escritura — alta, edición y asignaciones fiables — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-qa.md`](./SPEC-web-qa.md)
Scope: rutas de escritura de presupuestos, repositorio y provider. Sin cambios de esquema en V1.

## Objetivo

Que los presupuestos se puedan crear, editar, asignar y borrar por HTTP sin
dejar la base en un estado que impida seguir creando, y que el historial no se
rompa después de escribir asignaciones.

## Comportamiento actual (evidencia del QA)

Secuencia reproducida en el móvil real:

1. `POST /budgets` (MONTH, 400,00) → **201**, presupuesto 1.
2. `PUT /budgets/1/allocations` con categoría + total de periodo (`oneTime`) y
   `rollover` → **200 `[]`**; nada queda guardado (`GET /allocations` → `[]`).
3. `GET /budgets/1/history?months=12` → **500** (antes de ese PUT funcionaba en
   un presupuesto nuevo).
4. `PUT /budgets/1` cambiando solo título/importe → **422 constraint_violation**.
5. `POST /budgets/1/duplicate` → 201; `PUT /budgets/2` → **422 constraint_violation**.
6. `DELETE /budgets/1` y `/2` → 204; desde entonces **cualquier** `POST /budgets`
   válido (MONTH, YEAR, WEEK, DAY, NONE, con y sin `isDefault`, importe 0 y >0)
   → **422 constraint_violation**.

## Comportamiento nuevo

- `POST /budgets` funciona tantas veces como haga falta, incluso después de
  borrar presupuestos, y crea su asignación por defecto (categoría 0, sin
  periodo).
- `PUT /budgets/{id}` actualiza título, descripción, `isDefault`, fechas de
  `NONE` y la asignación por defecto, y responde el `BudgetDto` actualizado.
- `PUT /budgets/{id}/allocations` persiste y devuelve exactamente lo guardado,
  incluido `categoryId: 0` con `oneTime` y el `rollover` del periodo.
- `GET /budgets/{id}/history` sigue respondiendo tras cualquier escritura de
  asignaciones y no se rompe por filas huérfanas.
- `DELETE /budgets/{id}` elimina también sus asignaciones (o deja el estado
  equivalente a "no existe"), sin bloquear altas posteriores.

## Causa confirmada

`budgets.description` es **NOT NULL** en el esquema
(`TransactionDatabase.java:294-305`) y `createBudget`/`updateBudget` convierten
una descripción ausente o vacía en `null`:

```kotlin
description = body.description?.trim()?.takeIf { it.isNotEmpty() }   // "" -> null
```

`Budget.toContentValues` hace `put(KEY_DESCRIPTION, description)`, así que el
`INSERT`/`UPDATE` escribe `NULL` y SQLite responde `NOT NULL constraint failed:
budgets.description`, que `StatusPages` traduce a `422 constraint_violation`.

Prueba de contraste en el móvil (base nueva, mismo cuerpo salvo un campo):

| Cuerpo | Resultado |
|---|---|
| `description: "x"` | **201** |
| sin `description` | 422 |
| `description: ""` | 422 |
| `PUT` con `description: "d"` | **200** |
| `PUT` sin `description` | 422 |

La app Android no cae en esto porque guarda `""` (cadena vacía), no `null`.

**Lo demás funciona** en cuanto la descripción no es nula: asignaciones con
override de periodo y rollover, `history` (200 con y sin movimientos), progreso
con `periodAllocationMinor`, borrado y alta posterior. `GET /allocations`
devuelve `[]` en este entorno porque la única categoría disponible es la de
transferencia; queda por confirmar con una categoría normal.

Lo que queda de este módulo es, por tanto, pequeño: aceptar `null`/`""` como
descripción vacía (o hacer la columna nullable con migración) y cubrirlo con un
test que compare los dos cuerpos.

## Ficheros

- `webui/src/main/java/org/totschnig/webui/api/AndroidWebApiDataSource.kt`
  (`createBudget` :803, `updateBudget` :856, `deleteBudget` :1171,
  `updateBudgetAllocations`, `budgetHistory`)
- `webui/src/main/java/org/totschnig/webui/api/ApiQueries.kt`
- `myExpenses/src/main/java/org/totschnig/myexpenses/db2/RepositoryBudget.kt`
- `myExpenses/src/main/java/org/totschnig/myexpenses/provider/TransactionProvider.java`
  (insert :1164, delete :1354, update :1589)
- `webui/src/test/java/org/totschnig/webui/api/ApiRoutesTest.kt`
- `webui/API.md` §4.5

## Estrategia de verificación

- Regresión obligatoria del ciclo completo, en dispositivo: crear → asignaciones
  con rollover → historial → editar → borrar → **crear otra vez**. Es el fallo
  que hoy deja el sandbox inservible.
- `ApiRoutesTest` con el datasource falso: alta, edición, asignaciones devueltas
  tal cual y borrado con 404 posterior.
- Si es viable en Docker, test del provider con SQLite real para el cascade;
  si no, checklist manual y nota en `AGENTS.md`.

## Límites

- Always: la causa se corrige en el provider o en el repositorio, no en el DTO.
- Always: la asignación por defecto se sigue guardando como categoría 0 sin
  periodo, igual que en la app Android.
- Ask first: cualquier migración que toque `budget_allocations` o `budgets`.
- Never: borrar filas huérfanas a mano en el código de producción como "arreglo";
  si hace falta limpieza, va en una migración revisada (fuera de V1).

## Criterios de éxito

- El ciclo completo de arriba termina con `201` en la segunda alta.
- `PUT /allocations` devuelve los mismos valores que luego lee `GET /allocations`.
- El historial responde 200 con 12 periodos tras escribir asignaciones y rollover.
- `PUT /budgets/{id}` cambia el título y el importe por defecto sin 422.
- Ningún endpoint de presupuestos devuelve 500 con entradas válidas.

## Fuera de alcance

- Reparar bases ya corruptas (decisión aprobada: reset manual del sandbox).
- Rollover automático entre periodos más allá de lo que ya hace la app.
