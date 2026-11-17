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

## Causas a confirmar

Prueba nueva (sandbox **vacío**: 0 transacciones, 0 presupuestos, 0 ficheros):
`POST /budgets` sigue devolviendo **422 constraint_violation**. Es decir, **no** son
filas huérfanas de mis pruebas: el fallo se reproduce desde cero y borrar datos
no lo arregla.

Patrón común con `SPEC-divididas.md`: las dos escrituras que fallan insertan una
fila con `cat_id = 0` (la asignación por defecto del presupuesto y el padre de la
dividida). Las transacciones simples con `cat_id = 1` funcionan. La sospecha
principal pasa a ser la fila especial de categoría 0 o su clave foránea
(`budget_allocations.cat_id references categories(_id)`), no el cascade del
borrado —aunque el `DELETE` que no limpia asignaciones sigue siendo un fallo
aparte que hay que corregir.

- `PUT /budgets/{id}` con `amountMinor` reescribe la asignación por defecto
  (`TransactionProvider.java:1164-1175` y `:1589`). Un `UPDATE`/`INSERT` que no
  respete la clave `(budget_id, cat_id, year, second)` provoca el 422 aunque el
  usuario solo cambie el título.
- `updateBudgetAllocations` devuelve `[]` después de un `200`: la respuesta se
  construye sin releer lo escrito, así que un fallo de escritura pasa inadvertido.
- El 500 del historial tras escribir asignaciones apunta a la consulta de
  periodos (`BaseTransactionProvider.budgetAllocationGroupsQuery`) recibiendo
  filas con `year`/`second` nulos o repetidos.

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
