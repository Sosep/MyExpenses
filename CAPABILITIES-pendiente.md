# Mapa de capacidades: pendiente tras la QA — V1

Status: propuesto (18-nov-2026)
Origen: informe de QA del sandbox `10.100.3.182` (ver el chat de esa sesión) y el
V2 que quedó fuera de [`SPEC-presupuestos-detalle.md`](./SPEC-presupuestos-detalle.md).

La QA dejó **cinco defectos corregidos** y cuatro cosas abiertas. De ellas, tres
necesitan código y una es verificación manual:

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `api-contrato` | `GET /accounts/{id}`, campos que faltan en `AccountDto`, `type`/`accountTypes` con nombres y `limit` fuera de rango → 400 | — |
| `cuentas-escritura` | Alta, edición y borrado de cuentas por HTTP: hace falta para probar transferencias y montar entornos de prueba completos | `api-contrato` |
| `busqueda-acentos` | `q` insensible a acentos y mayúsculas usando el FTS de la app | — |
| `navegacion-historial` | `view` y paneles en la URL; atrás cierra el panel o vuelve a la vista anterior | — |
| `presupuesto-movimientos` | Desde el detalle del presupuesto, abrir los movimientos de una categoría y un mes | `navegacion-historial` |

Orden de construcción: `navegacion-historial` → `presupuesto-movimientos` (el
enlace necesita la URL como fuente de verdad); `api-contrato` →
`cuentas-escritura`; `busqueda-acentos` es independiente.

**No es un spec**: la pasada interactiva que quedó bloqueada (dashboard, lista,
informes, presupuestos, ficheros, temas, 390×844) es una tarea de verificación,
no una capacidad. Su checklist vive en
[`tasks/qa-env/todo.md`](./tasks/qa-env/todo.md), junto con el segundo pagador
que necesita `cuentas-escritura` para probar transferencias.

Cada módulo tiene su spec: [`SPEC-api-contrato.md`](./SPEC-api-contrato.md),
[`SPEC-cuentas-escritura.md`](./SPEC-cuentas-escritura.md),
[`SPEC-busqueda-acentos.md`](./SPEC-busqueda-acentos.md),
[`SPEC-navegacion-historial.md`](./SPEC-navegacion-historial.md) y
[`SPEC-presupuesto-movimientos.md`](./SPEC-presupuesto-movimientos.md).

## Lo que queda fuera de este mapa

Del V2 de presupuestos siguen aparcados, sin spec todavía: el criterio de cuentas
en el filtro, la preferencia "agregar neutrales" por presupuesto y editar las
asignaciones desde el panel de detalle. Se especificarán cuando toquen.
