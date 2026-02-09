# Seguridad

## Almacenamiento de secretos
- Default: credenciales en UserProperties (solo el usuario).
- Si Share credentials = true: scope DOCUMENT.
  - Opcion A (sin backend): guardar en DocumentProperties cifrado.
  - Opcion B (con backend): guardar en backend con ACL y rotacion.

## Encriptacion (sin backend)
- AES-GCM.
- Clave derivada de un secreto del proyecto + salt por documento.
- Rotacion: versionar el esquema de cifrado.

## Reautenticacion
- Si session invalida/401: pedir login.
- Scheduler requiere Remember my credentials.

## Restriccion de advanced
- Advanced request (SQL-like/domain editor) solo si el usuario Odoo tiene privilegio Administration/Settings.

## Advertencias UX
- Si Share credentials: mostrar warning claro (otros editores podran refrescar sin login propio).
