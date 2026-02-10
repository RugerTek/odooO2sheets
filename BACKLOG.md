# Backlog

Este backlog esta pensado para marcar OK / NO-OK con checkboxes.

## Fase 1 - MVP (core)
- [x] Add-on base (Apps Script): menu + sidebar
- [x] UI: Extracciones, Connections, Ayuda (tabs + dialogs)
- [x] Connections CRUD (title + url + db, acciones: usar/editar/logout/borrar)
- [x] Validacion conectividad: URL accesible + DB + login OK
- [x] Auth Odoo: JSON-RPC /jsonrpc (common.authenticate + object.execute_kw)
- [x] Listado de modelos (selector modulo/modelo) y busqueda
- [x] Selector de campos + orden + sample preview + nested fields (hasta 3 niveles)
- [x] Ejecutar extraccion: search_read y escritura en sheet
- [x] Write mode: REPLACE vs APPEND + header on/off
- [x] Estado por datasource: last_run + runHistory (ultimas 10)
- [ ] Manejo limites: 50MB, celdas/filas (pendiente)
- [x] Manejo limites: 6 min (guard) + truncamiento 1000 chars
- [x] Persistencia: DocumentProperties (connections/datasources) + UserProperties (credentials + draft)

## Fase 2 - Scheduler
- [x] UI scheduler (timezone/hours/days/weekdays/months)
- [x] Crear triggers (dispatcher horario: tick + nextRunAt)
- [x] Credenciales guardadas (requisito para scheduler)
- [x] Errores scheduler con mensajes + runHistory
- [x] Logs basicos por corrida (en cada datasource: runHistory)

## Fase 3 - Colaboracion
- [ ] Modelo de miembros y roles
- [ ] Invitaciones por email (accept/deny)
- [ ] Enforcements por rol (UI + server)
- [ ] Share credentials (cifrado + warning)

## Fase 4 - Advanced options
- [x] Advanced query builder (filtros): Filter Builder (reglas AND) + Advanced JSON
- [ ] Restriccion por permiso Odoo (Administration/Settings)
- [ ] Guardado por datasource

## Infra / Repo
- [x] Definir stack de desarrollo (clasp + TS)
- [ ] CI basico (lint/test) si se usa TS (pendiente)
- [ ] Plantillas de issues/PRs (opcional)
