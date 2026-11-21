# SPEC: datos-pantalla (M4)

Estado: **implementado**. Vista «Datos» en el rail (icono de ajustes) con
pestañas por entidad, tablas, paneles de edición y confirmación de borrado.

## Pantalla

- `?view=datos` (entrada en `navigation.ts`); el botón de ajustes del rail deja
  de estar deshabilitado y muestra icono + etiqueta «Datos».
- Pestañas segmentadas: **Categorías · Métodos · Etiquetas · Divisas ·
  Precios**. Cada una una tarjeta con tabla, `+ Nueva` y fila con `Editar` /
  `Eliminar`.
- **Categorías**: árbol con sangría por nivel, tipo (Gasto/Ingreso/Neutro),
  panel con nombre, padre (`SearchSelect`, sin descendientes propios) y tipo.
  Al borrar una categoría en uso se abre «Borrar categoría» con `Move to`
  (`SearchSelect`) y `Mover y borrar`; sin movimientos borra directo.
- **Métodos**: nombre, tipo, numerado y tipos de cuenta (checkboxes).
- **Etiquetas**: nombre.
- **Divisas**: código, símbolo, dígitos, tipo; alta con código editable y
  edición sin él; el error de «en uso» se muestra en la tarjeta.
- **Precios**: selector de activo (divisas no fiat), tabla fecha/valor/fuente y
  panel de fecha + precio; guardar reemplaza el precio manual de esa fecha.
- Todo el texto por `t`/`<Trans>`; los datos no dependen de la cuenta
  seleccionada (la vista se abre aunque no haya cuentas).

## QA

- `?view=datos`, `?view=datos&tab=divisas`, `?view=datos&tab=precios`,
  `?view=datos&new=1` (abre el alta de la pestaña activa).
- Mock: 1440×900 y 390×844, ambos temas e idiomas; sin scroll horizontal en
  móvil (las pestañas hacen wrap y las tablas mantienen sus columnas).
- **Dispositivo**: una categoría remapeada y un precio editado desde la web se
  ven al instante en la app.
