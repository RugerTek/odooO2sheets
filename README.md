# Odoo -> Google Sheets Add-on (sin addon en Odoo)

Add-on de Google Sheets (Google Workspace Marketplace) para extraer datos desde Odoo hacia una hoja de calculo, con refresh manual y programado.

## Objetivo
Construir un add-on que permita:
- Conectarse a una instancia Odoo publica usando credenciales de usuario Odoo (sin instalar nada en Odoo).
- Crear extracciones (datasources) por modelo/tabla, seleccionando campos/columnas, orden, filtros y opciones de escritura.
- Refrescar manualmente y programar refresh automatico (horas/dias/mes) con zona horaria.
- (Opcional) Multi-conexion y colaboracion por roles dentro del documento/cuenta.
- (Opcional) Opciones avanzadas tipo "SQL editor" equivalente (domain/query builder), con restriccion de permisos.

## Fuera de alcance
- Pagos, suscripciones, facturacion, creditos/planes, checkout, invoices.
- Se pueden dejar ganchos tecnicos para limites/cuotas, pero sin cobro.

## Documentacion
- `docs/PRD.md` (resumen)
- `docs/REQUIREMENTS_FULL.md` (fuente completa)
- `docs/DEV_SETUP.md` (setup de desarrollo)
- `docs/UX.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY.md`
- `docs/AUTHZ_ROLES.md`
- `docs/LIMITS_QUOTAS.md`

## Seguimiento
- Backlog: `BACKLOG.md`
- Estado actual (OK / NO-OK): `STATUS.md`
