# Capability Map: Corrección de hallazgos QA web — V1

Status: approved (2026-11-17) — cinco módulos, en el orden indicado
Alcance: contrato HTTP y capa de datos de `:webui`/`:myExpenses`, más la SPA y el
mock donde el contrato se cruza. Nace del QA del entorno real
(`http://192.168.1.191:9000/app/`, My Expenses 4.1.4).

## Relación con las specs de UI ya aprobadas

- [`SPEC-web-ui-v1.md`](./SPEC-web-ui-v1.md) y sus módulos
  (`defects`, `a11y`, `density`, `features`) siguen vigentes: son de presentación.
- `SPEC-web-ui-defects.md` **D1** (gráfica sin barras por `NaN` en el mock) y
  `contrato-meses` son defectos distintos y ambos hay que arreglarlos: D1 sanea el
  cálculo, este mapa corrige el índice de mes que deja el gráfico a cero con datos
  reales.
- `SPEC-web-ui-features.md` **F2** define cómo se ve la navegación de presupuestos;
  aquí se corrige qué número se envía a la API. Si chocan, manda este mapa para el
  contrato y F2 para la presentación.

## Objetivo

Corregir los defectos encontrados en el QA del entorno real
(`http://192.168.1.191:9000/app/`, My Expenses 4.1.4) que rompen el dashboard,
los presupuestos, los informes y las divididas, y endurecer el servidor web.
La spec de cada módulo vive junto a este mapa y se nombra por su id.

## Capability Map

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `contrato-meses` | Un índice de mes único (0-11) en API, SPA, mock y documentos | — |
| `consultas-informes` | 500 en filtros `categoryId`/`tagId`, drill-down y `accountId=all` | `contrato-meses` |
| `presupuestos-escritura` | Alta/edición, asignaciones y rollover persistentes; historial estable | — |
| `divididas` | Alta de dividida sin `constraint_violation` | — |
| `endurecimiento` | gzip, cabeceras, intentos de contraseña, importes acotados | — |

Orden de construcción: `contrato-meses` → `consultas-informes`,
`presupuestos-escritura`, `divididas` → `endurecimiento`.

## Decisiones aprobadas

- **Índice de mes 0-11** como referencia. La API y `webui/API.md` no cambian de
  semántica; se alinean SPA, mock y ejemplos de la documentación.
  Acompañado de test de contrato.
- **Sin reparación de datos**: la spec arregla la causa y evita nuevas
  corrupciones. La base del sandbox actual se restablece a mano (recrear el
  sandbox en el móvil o borrar las asignaciones huérfanas desde la app).
- **Endurecimiento dentro de V1** (gzip, cabeceras, límite de intentos,
  importes acotados).

## Cómo se verifica cada módulo

Los comandos completos están en la spec de cada módulo. Común a todos:

```
cd webui/webapp && npm test && npm run build
docker compose run --rm android-build :webui:testDebugUnitTest
docker compose run --rm android-build :webui:ktlintCheck
cd webui/webapp && npm run mock     # http://localhost:4173/app/
```

Y una pasada manual en el móvil real con la checklist de cada spec, porque
ninguna de estas rutas se ejecuta en los tests JVM (usan `WebApiDataSource`
falso).

## Límites

- Always: mantener `:webui` como adaptador HTTP; el dominio vive en la app.
- Always: `webui/API.md`, `webui/DESIGN.md`, `webui/webapp/README.md` y
  `AGENTS.md` actualizados en el mismo commit que el cambio.
- Ask first: tocar migraciones de base de datos o el esquema del provider.
- Never: cambiar el contrato a 1-12, ni "arreglar" el desfase solo en el mock.

## Criterios de éxito

- Dashboard e informes muestran los importes del mes en curso con datos reales.
- Presupuestos: navegación mensual, historial y asignaciones coinciden con la app.
- Ningún endpoint de `/api/v1` devuelve 500 con entradas válidas de la matriz del QA.
- `POST /split-transactions` crea una dividida válida y `POST /budgets` funciona
  después de borrar otro presupuesto.
- `webui/API.md` documenta el índice 0-11 con ejemplos correctos.

## Fuera de alcance (aplazado)

- Reparación automática de bases ya corruptas (se resetea a mano).
- Transferencias de extremo a extremo: el entorno de QA tiene una sola cuenta.
- Enlaces profundos (`?view=`) en la SPA: la vista vive en `useState`; los
  switches `?view=` son del mock.
- Plurales y porcentajes localizados (m-1, m-2 del informe): backlog de UI.

## Preguntas abiertas

- ¿La causa de los 500 en las consultas es un alias de vista (`transactions_extended`)
  o un parámetro de URI ausente? Se confirma con el log del dispositivo durante
  `consultas-informes`; si resulta ser de esquema, ese módulo pide revisión.
- ¿Se puede ejecutar `androidTest` del provider en Docker o la verificación de
  `presupuestos-escritura` queda solo en dispositivo?
