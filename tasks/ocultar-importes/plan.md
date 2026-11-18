# Plan: ocultar-importes — dos botones de privacidad — V1

Spec: `SPEC-ocultar-importes.md` · Tareas: `tasks/ocultar-importes/todo.md`

## Enfoque

Un estado de cliente con dos booleanos (`totals`, `transactions`) en un contexto
React, persistido en `localStorage`. Los importes se pintan con `<Money scope>` o
`useMoney(scope)`; ambos sustituyen el texto por `€ ••••` cuando el scope está
tapado, así que el valor no queda en el DOM. Nada toca la API.

Orden: núcleo (máscara + contexto) → barra superior → pantallas de arriba abajo
(panel, transacciones, informes, presupuestos) → tests → mock y QA → docs.

## Dependencias

1. `maskedMoney()` en `format.ts` (no depende de nada).
2. `privacy.tsx` depende de 1.
3. `Icons.tsx` y `Shell.tsx` dependen de 2.
4. `App.tsx` (proveedor) depende de 2; las pantallas dependen de 2.
5. Tests y mock dependen de todo lo anterior.
6. Docs y build al final, con el resto ya verde.

## Riesgos

- **Strings dentro de Lingui.** `t`… ${formatMoney(…)} …`` no admite JSX: ahí va
  `useMoney(scope)`. Los sitios sueltos usan `<Money>`, que además añade el
  `sr-only`.
- **Layout.** La máscara cambia el ancho; se compensa con `tabular-nums` y
  `letter-spacing`. Se revisa a 390 px.
- **Modo oscuro y contraste.** `.money-masked` no introduce color propio:
  hereda el semántico del contenedor.
- **Editores.** `TransactionEditor` y `BudgetEditor` se quedan como están; la
  excepción queda documentada en `DESIGN.md` y en el spec.
- **Tests de accesibilidad.** `Shell` sin proveedor debe seguir funcionando: el
  contexto por defecto es «todo visible» y `toggle` no-op.

## Verificación

- `npm test` (vitest: privacy, Chart, format, a11y).
- `npm run build` (tsc + vite; regenera `webui/src/main/assets/webapp`).
- `npm run mock` con `?hidden=1`, `?hidden=totals`, `?hidden=transactions` a
  1440×900 y 390×844, claro/oscuro, en/es.
- `npm run i18n:extract` + `msgstr` español; `npm run i18n:compile`.
