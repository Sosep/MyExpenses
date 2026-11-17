# Capability Map: Transacciones como la app Android — V1

Status: approved (2026-11-17) — dos módulos, en el orden indicado
Origen: petición del usuario. La referencia funcional es **la app Android**:
agrupación elegible de la lista y búsqueda por criterios. Nada de esto cambia
la app; se implementa en la SPA y en `/api/v1`.

## Objetivo de la iniciativa

Que la pantalla de Transacciones deje de estar atada a un mes: agrupar es una
ayuda visual para situarse, no un filtro, y el usuario elige la agrupación. Y
que se puedan hacer búsquedas complejas como en el móvil (texto, importes,
fechas, tipo, categorías, beneficiarios, etiquetas, métodos y estado), en vez
de los cuatro filtros simples de hoy.

## Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `agrupacion-rango` | Agrupación `NONE/DAY/WEEK/MONTH/YEAR` elegible, lista sin recorte mensual, cabeceras de periodo con subtotal del servidor, rango de fechas como filtro (presets + libre) | — |
| `busqueda-avanzada` | Criterios combinables como los de Android, chips en la URL, panel de búsqueda | `agrupacion-rango` (comparte estado de lista y rango) |

Orden: `agrupacion-rango` → `busqueda-avanzada`.

## Referencia en la app Android

- `model/Grouping.kt`: `NONE`, `DAY`, `WEEK`, `MONTH`, `YEAR`. La cabecera de
  grupo se calcula con `calculateGroupId` y se pinta con `getDisplayTitle`; el
  subtotal viene de la consulta de agrupación, no de las filas visibles.
- `provider/filter/`: un `Criterion` por dimensión — `DateCriterion` (desde,
  hasta o entre), `AmountCriterion` (operación + importes + divisa + signo),
  `CrStatusCriterion`, `CommentCriterion`, `FtsCriterion`, `CategoryCriterion`,
  `PayeeCriterion`, `TagCriterion`, `MethodCriterion`, `TransferCriterion`,
  `AccountCriterion`, `AssetCriterion`. Los criterios se combinan con AND.
- `compose/filter/FilterHandler.kt`: cada criterio se edita, se muestra como
  tarjeta y se puede quitar.

## Supuestos

1. Solo SPA y API web; no se toca la app Android.
2. La agrupación es presentación: no recorta resultados, no cambia el orden
   (más reciente primero) ni la paginación con «cargar más».
3. Los subtotales de cabecera salen del servidor (`/reports/grouped`); el
   cliente no suma filas.
4. El rango de fechas es un **filtro** más: por defecto sin rango (todo el
   historial), con presets y rango libre.
5. Todo el estado (agrupación, rango, criterios) vive en la URL y sobrevive a
   recargar; los filtros actuales siguen aceptándose como hasta ahora.
6. Los criterios son los de la app; los que no tengan sentido en la web
   (cuenta, adjuntos) se evalúan en su módulo y pueden quedar fuera si el API no
   los expone todavía.

## Criterios de éxito de la iniciativa

- Se puede cambiar de agrupación y ver la lista completa, sin perder
  transacciones por el mes.
- Las cabeceras de periodo cuadran con el resumen del mismo rango.
- Se puede buscar por texto, importe, fecha, tipo, categoría, beneficiario,
  etiqueta, método y estado, combinando criterios, y quitar cada uno por
  separado.
- Nada de esto rompe filtros existentes, presupuestos ni informes.

## Fuera de alcance (diferido)

- Guardar búsquedas con nombre (la app tampoco las tiene en esta pantalla).
- Orden configurable (importe, categoría): la lista sigue por fecha.
- Reutilizar la preferencia de agrupación de la cuenta del móvil en la web
  (requiere exponerla en `/accounts`).

## Decisiones (2026-11-18)

1. **Rango inicial:** `Todo` el historial, como la app.
2. **Agrupación inicial:** `Mes`, y el selector permite cambiarla en cualquier
   momento; se recuerda en `localStorage` (la app recuerda la última elección).
3. **Resumen:** sin tira global. Ingresos, gastos y transferencias se muestran en
   la cabecera de cada unidad agrupada, como en la app.
4. **Selección múltiple** con chips para categorías, beneficiarios, etiquetas y
   métodos.
