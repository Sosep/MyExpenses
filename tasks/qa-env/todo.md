# Tareas: entorno y QA pendiente

Informe de QA del sandbox `10.100.3.182` (18-nov-2026). Aquí queda lo que no es
una capacidad nueva: la verificación que no se pudo hacer y lo que la bloquea.

## Entorno de pruebas (hecho, se conserva)

- Cuenta `Sandbox` (id 1) con 144 movimientos en 6 meses (jun–nov 2026), 12
  divididas, 12 pagos con método, nóminas y devoluciones. Saldo 499.535 =
  resumen global. **Se queda** para la copia de seguridad.
- Presupuesto `QA mensual` (MONTH, 1.600 €), con total de periodo 1.800 € en
  noviembre y `oneTime`.
- Recordatorio: el API no crea categorías, beneficiarios, etiquetas ni métodos,
  así que los movimientos del sandbox no tienen categoría.
- Mock con volumen: `MOCK_QA_SEED=1 npm run mock`.

## Bloqueado: pasada interactiva

El panel de navegador no pinta ("window is not being drawn"), así que no se pudo
pulsar la UI. Pendiente con el APK `…universal-signed.apk` (18-nov 09:56):

- [ ] Dashboard: KPIs del mes contra `/reports/summary`, gráfico de 12 meses.
- [ ] Transacciones: agrupación MONTH/WEEK/DAY/YEAR, plegar y desplegar **todos**
      los meses (el bug corregido), rango (Historial / Este mes / 3 meses /
      Este año), búsqueda con y sin acentos, filtros por importe, estado y
      transferencias, chips y "cargar más".
- [ ] Detalle de transacción y edición simple; borrado con confirmación.
- [ ] Informes: resumen, desglose por categoría/beneficiario/método/etiqueta,
      drill-down, "No category".
- [ ] Presupuestos: detalle (reparto, importe del periodo, histórico), editor con
      filtro, duplicar y borrar; presupuesto `NONE`.
- [ ] Ficheros: listado y descarga (device-level).
- [ ] Ambos temas y ambos idiomas; 1440×900 y 390×844; sin desbordamiento
      horizontal y sin errores de consola.

## Bloqueado: transferencias

Hace falta una **segunda cuenta**. Hoy el sandbox tiene una y `POST /accounts` no
existe; se resuelve con [`SPEC-cuentas-escritura.md`](../SPEC-cuentas-escritura.md).

- [ ] Crear dos cuentas por HTTP y hacer una transferencia entre ellas.
- [ ] Comprobar las dos caras, mismo `uuid`, importes espejo y saldos.
- [ ] Editar la transferencia desde cualquiera de las dos caras.
- [ ] Borrar una cara y comprobar que desaparece la pareja.

## Hallazgos abiertos: estado

- [x] `GET /accounts/{id}`, `typeName` y `openingBalanceMinor` (`SPEC-api-contrato`).
- [x] `limit`/`offset` fuera de rango → 400.
- [x] Búsqueda sin acentos (`SPEC-busqueda-acentos`).
- [x] `versionName` 4.1.5 / versionCode 893.
- [x] Vistas y detalle de transacción con historial (`SPEC-navegacion-historial`).
- [x] Enlace del presupuesto a Transacciones (`SPEC-presupuesto-movimientos`, opción B).
- [ ] Panel de alta de cuenta en la SPA (la API ya está).
- [ ] Resto de paneles en la URL: detalle de presupuesto, editores, drill-down de
      informes y confirmaciones; hoy se abren desde estado.
- [ ] Unificar la caché de maestros: Transacciones usa `['transaction-references']`
      y presupuestos `['references']`; hoy se piden dos veces.
