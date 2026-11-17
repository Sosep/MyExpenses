# Spec: Accesibilidad y contraste del Web UI — V1

Status: approved (2026-11-17) — hereda los límites de [`SPEC-web-ui-v1.md`](./SPEC-web-ui-v1.md)
Scope: tokens, estilos y paneles de la SPA. Sin cambios de API ni de datos.

## Objetivo

Que el texto y el foco cumplan AA y que los controles se puedan pulsar con el dedo. Hoy la
guía pide 40 px de objetivo táctil, foco de 2 px visible en ambos temas y contraste AA; el
código no cumple ninguna de las tres en varios sitios.

## Comportamiento actual (medido)

| Elemento | Valor | Requisito |
|---|---|---|
| Anillo de foco | `--focus-ring: rgba(47,107,255,.38)` ≈ **1.5:1** sobre blanco | 3:1 para indicadores de foco |
| Cabecera de tabla y chips | `--text-muted` (#667085) sobre `--bg-sunken` (#EEF1F6) = **4.39:1** a 11 px | 4.5:1 |
| Chips de etiqueta en oscuro | `--bg-sunken` (#10141C) sobre fila `--bg-surface` (#141821) | El chip debe leerse como forma |
| Botones | 36 px de alto | 44 (decidido) |
| Iconos del topbar | 32×32 | 44 (decidido) |
| Segmentados | 28 px de alto | 44 (decidido) |
| Opciones de `SearchSelect` | ~30 px de alto | 44 (decidido) |
| Foco en panel lateral | `role="dialog" aria-modal="true"` sin trampa ni retorno al disparador | Foco atrapado y devuelto |
| Foco en fila de tabla | `outline: none` + `--tint-sky` (≈1.1:1) | Señal perceptible |

## Comportamiento nuevo

- **Foco.** `--focus-ring` pasa a un tono sólido (≥3:1 sobre las cuatro superficies). Se
  mantiene `outline: 2px` + `outline-offset: 2px` en botones, iconos, rail, segmentados y
  campos. La fila de tabla enfocada lleva además `inset 2px var(--accent)`, como ya describe
  `DESIGN.md` §7 para la selección.
- **Contraste.** Cabeceras de tabla, chips y metadatos sobre `--bg-sunken` usan
  `--text-secondary` (7.3:1). En oscuro, `.tag` añade borde `--border-subtle` para no perder
  la forma.
- **Objetivos táctiles.** Se introduce `--control-h: 36px` y
  `@media (pointer: coarse) { --control-h: 44px }`; botones, campos, iconos, segmentados y
  opciones de `SearchSelect` lo consumen. Alturas mínimas: 44 px en puntero grueso, 36 en
  ratón.
- **Paneles.** Mientras un panel está abierto, el shell (`header`, `main`, `nav`) recibe
  `inert`; al cerrar, el foco vuelve al disparador. Sin dependencias nuevas.
- **Descubrimiento.** Las filas *clicables* de Informes ganan `cursor: pointer`, hover y
  anillo de foco visibles.

## Estructura (partes relevantes)

```
webui/webapp/src/styles/tokens.css     -> --focus-ring, --control-h
webui/webapp/src/styles/app.css        -> .btn, .icon-btn, .segmented, .input, .tag, .table th,
                                          .table tr.clickable, .breakdown-row, .panel
webui/webapp/src/components/*Panel.tsx -> inert del shell y retorno de foco
webui/DESIGN.md                        -> §4.1 foco, §7 controles, §11 objetivos táctiles
```

## Estilo de código

Tokens antes que valores. Un color o una altura nuevos entran por `tokens.css` y se
documentan en `DESIGN.md` en el mismo commit.

```css
:root { --focus-ring: #2f6bff; --control-h: 36px; }
@media (pointer: coarse) { :root { --control-h: 44px; } }
.btn { height: var(--control-h); }
```

## Estrategia de verificación

1. Calculadora de contraste sobre los pares nuevos (documentar el resultado en el PR).
2. Recorrido completo con teclado en Resumen, Transacciones, panel de detalle, editor
   simple y Presupuestos: el foco no sale del panel abierto, `Esc` lo cierra y devuelve el
   foco al disparador.
3. Emulación táctil en DevTools: medir `.btn`, `.icon-btn`, `.segmented button` y una
   opción de combo ≥44 px.
4. Ambos temas en las siete pantallas; captura antes/después en `?theme=dark`.
5. `npm test` (Vitest + jsdom + axe-core): las pantallas montadas con datos de fixture no
   arrojan violaciones *serious* ni *critical*.

## Límites

- Always: cambiar `DESIGN.md` y `tokens.css` juntos (§11 pasa de 40 a 44 px); verificar claro
  y oscuro; dejar el foco visible en todos los controles.
- Ask first: silenciar una regla de axe con un motivo documentado.
- Never: quitar el anillo de foco sin sustituto; usar solo el color para indicar estado;
  bajar el tamaño de un control para “que quepa”.

## Criterios de éxito

- El anillo de foco tiene ≥3:1 sobre `--bg-surface`, `--bg-canvas`, `--bg-rail` y `--bg-sunken`
  en ambos temas.
- Ningún texto por debajo de 4.5:1 en las siete pantallas, en claro y en oscuro.
- Todos los controles interactivos miden ≥44×44 px con `pointer: coarse`.
- Con un panel abierto, `Tab` no alcanza `main`; al cerrarlo, el foco vuelve al disparador.
- La fila de tabla enfocada se distingue sin depender del color de fondo.

## Fuera de alcance (aplazado)

- Auditoría WCAG 2.2 completa y matriz de lectores de pantalla.
- RTL más allá de las propiedades lógicas ya usadas.
- Modo de alto contraste del sistema.
