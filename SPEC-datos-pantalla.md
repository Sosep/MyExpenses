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
  El borrado pide confirmación. Si la rama está en uso (transacciones,
  plantillas o asignaciones) se abre «Borrar categoría» con `Move to`
  (`SearchSelect`) y `Mover y borrar`; sin uso borra directo.
- **Métodos**: nombre, tipo, numerado y tipos de cuenta (checkboxes).
- **Etiquetas**: nombre.
- **Divisas**: código, símbolo, dígitos, tipo; alta con código editable y
  edición sin él; el error de «en uso» se muestra en la tarjeta.
- **Precios**: selector de activo (divisas no fiat), tabla fecha/valor/fuente y
  panel de fecha + precio; guardar reemplaza el precio manual de esa fecha.
  Todos los borrados (categoría, método, etiqueta, divisa, precio) piden
  confirmación y nombran el objeto.
- Todo el texto por `t`/`<Trans>`; los datos no dependen de la cuenta
  seleccionada (la vista se abre aunque no haya cuentas).
- Cada editor es una entrada de historial (`useHistoryPanel`): atrás cierra el
  panel y deja al usuario en Datos; cerrar desde la UI consume esa entrada.
- En móvil las tablas no desbordan: Divisas oculta símbolo y dígitos para que
  `Editar`/`Eliminar` sigan dentro de la tarjeta y el resto usa padding compacto.
  La barra inferior conserva las seis secciones, Datos incluida.

## QA

- `?view=datos`, `?view=datos&tab=divisas`, `?view=datos&tab=precios`,
  `?view=datos&new=1` (abre el alta de la pestaña activa).
- Mock: 1440×900 y 390×844, ambos temas e idiomas; sin scroll horizontal en
  móvil (las pestañas hacen wrap y las tablas ocultan o compactan columnas, con
  las acciones visibles).
- **Dispositivo**: una categoría remapeada y un precio editado desde la web se
  ven al instante en la app.
