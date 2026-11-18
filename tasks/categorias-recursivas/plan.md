# Plan: categorias-recursivas — V1

Spec: [`SPEC-categorias-recursivas.md`](../../SPEC-categorias-recursivas.md)
(aprobada el 18-nov-2026).
Sin cambios de esquema ni en la app Android.

## Orden

| # | Pieza | Por qué antes |
|---|---|---|
| 1.1 | `categoryBranchIds` en `ApiQueries.kt` + test JVM | es la regla; todo lo demás la consume |
| 1.2 | Expandir en `transactionPage` | el contrato cambia aquí y en ningún otro sitio |
| 1.3 | Mock: rama y partes de divididas | QA visual sin teléfono |
| 1.4 | SPA: una `categoryId` en el drill-down y la seña | depende de 1.2; retira el rodeo del cliente |
| 1.5 | Lingui (`en`/`es`) y build de assets | cierra 1.4 |
| 1.6 | Docs (`API.md`, `AGENTS.md`, README, spec) | cierre |
| 1.7 | Verificación | criterios de éxito |

## Decisiones

- La rama se calcula en Kotlin sobre `queryCategories()` (`id`, `parentId`), no
  con un CTE recursivo: se prueba en JVM, no duplica el SQL de la app y deja
  `transactionSelection` con un `IN` plano. Coste: una consulta de categorías
  por página **solo** cuando hay `categoryId`.
- Un id que el árbol no conoce se conserva: mejor filtrar de más que devolver
  todo.
- El drill-down del presupuesto no cambia de destino ni de cifras: al mandar una
  sola `categoryId`, el servidor aporta las hijas que antes enumeraba el cliente.
- `reports/transactions?by=category` sigue exacto: la fila del informe y su
  `count` mandan.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El `total` y la página usan la misma selección | la expansión ocurre antes de `queryTransactionsPage` y alimenta las dos consultas |
| Árbol grande → muchos placeholders | acotado por el número de categorías; sin índices nuevos |
| El mock y el servidor divergen | misma regla (id + descendientes), verificada con `?categoryId=9` y divididas con `MOCK_QA_SEED=1` |
| El enlace del presupuesto deja de cuadrar | la suma del presupuesto ya usa `CategoryCriterion`; se comprueba fila Food = lista con una sola id |

## Puntos de control

1. Tras 1.2: `:webui:testDebugUnitTest` y `:webui:ktlintCheck`.
2. Tras 1.3: `curl` al mock con `categoryId=1`, `6` y `9` (rama, hijos y partes).
3. Tras 1.5: `npm test`, `npm run build`, mock a 1440×900 y 390×844.
4. Dispositivo (queda abierto): mismo recuento que la app con una madre en el
   filtro y una dividida; presupuesto con madre en el filtro y su drill-down.
