# Spec: busqueda-acentos — que `q` encuentre "cafetería" buscando "cafeteria" — V1

Status: implementado con plegado de acentos en SQL (18-nov-2026).
Scope: el filtro de texto de `/transactions` y su equivalente en la SPA. Sin
cambios de esquema.

## Objetivo

Que buscar sin acentos encuentre lo que está escrito con ellos y al revés,
respetando mayúsculas y sin inventar coincidencias. Hoy el usuario que escribe
"cafeteria" en el móvil encuentra "Cafeteria", pero "cafetería" no encuentra
nada, y el mismo patrón falla al revés.

## Comportamiento actual (evidencia)

- Sandbox con 144 movimientos: `GET /transactions?accountId=1&q=cafeteria` → **9**
  resultados; `q=cafeter%C3%ADa` (cafetería) → **0**.
- El API resuelve `q` con tres `LIKE '%texto%' COLLATE NOCASE` sobre comentario,
  beneficiario y referencia (`ApiQueries.transactionSelection`). `NOCASE` de
  SQLite solo pliega ASCII: no quita diacríticos.
- La app ya tiene una tabla `transactions_fts` (FTS4, `tokenize=unicode61`), que
  sí pliega acentos, mantenida por los triggers del provider. El API no la usa.
- `API.md` lo deja "fuera de este corte" hoy; este spec lo mete dentro.

## Comportamiento nuevo

1. Las dos caras se **pliegan**: minúsculas y sin diacríticos (castellano y
   vocales con diéresis/acento grave), sobre comentario, beneficiario y
   referencia. En SQL se hace con `lower()` y una cadena de `replace()`; el
   texto buscado se pliega igual en Kotlin y viaja como argumento ligado.
2. Se descartó usar la tabla FTS (`transactions_fts`) aunque pliega acentos:
   habría que detectar su ausencia y restringir por columnas, y la consulta
   actual ya recorre esas tres columnas. Con el plegado no hace falta fallback.
3. `q` sigue limitado a 200 caracteres y sigue sin distinguir mayúsculas.
4. Solo se buscan esas tres columnas: una coincidencia en categoría o etiqueta
   **no** aparece por este filtro.
5. El mock pliega igual (`normalize('NFD')`), para que la QA contra el mock
   enseñe el mismo resultado que el móvil.
6. `API.md` documenta la regla.

## Verificación

- `ApiRoutesTest`: con un datasource falso no hay SQL; se cubre el passthrough y
  el 400 por longitud. La regla real es de provider.
- **Dispositivo** (sandbox ya sembrado): `q=cafeteria` y `q=cafetería` devuelven
  el mismo número (>0); `q=NÓMINA` y `q=nomina` también; `q=zzz` → 0; una
  búsqueda que solo coincide con una categoría (texto que está en el nombre de
  la categoría, no en el comentario) no devuelve filas.
- SPA: el campo de búsqueda no cambia; comprobar que el contador y los chips
  siguen igual con acentos.

## Límites

- Always: la consulta del texto va parametrizada (`LIKE ?`), nunca concatenada.
- Always: el plegado de las dos caras usa la misma tabla de caracteres.
- Ask first: cambiar el conjunto de columnas indexadas (hoy comentario,
  beneficiario, categoría, etiqueta y referencia).
- Never: mantener dos motores a la vez por preferencia del usuario; el fallback
  es por disponibilidad, no por configuración.

## Criterios de éxito

- `q=cafetería` y `q=cafeteria` devuelven los mismos movimientos en el sandbox.
- Las mayúsculas siguen sin importar y el límite de 200 caracteres se mantiene.
- Sin FTS disponible, la lista responde como hoy.
- `:webui:testDebugUnitTest` y `ktlintCheck` en verde; `API.md` al día.

## Fuera de alcance

- Búsqueda por categoría o etiqueta desde `q` (hay filtros propios para eso).
- Ordenar por relevancia: se mantiene el orden por fecha.
- Búsqueda en importes o números de referencia parciales con operadores.
