# Backlog

Este backlog esta pensado para marcar OK / NO-OK con checkboxes.

## Fase 1 - MVP (core)
- [ ] Add-on base (Apps Script): menu + sidebar
- [ ] UI: Home/Crear extraccion, Connections, Datasources
- [ ] Connections CRUD (Name inmutable, Title editable)
- [ ] Validacion conectividad: URL accesible + DB + login OK
- [ ] Auth Odoo: JSON-RPC /web/session/authenticate
- [ ] Listado de modelos (selector modulo/modelo) y busqueda
- [ ] Selector de campos + orden + mapping a headers
- [ ] Ejecutar extraccion: search_read y escritura en sheet
- [ ] Write mode: REPLACE vs APPEND
- [ ] Estado por datasource: last_run (timestamp, filas, duracion, error)
- [ ] Manejo limites: 6 min, 50MB, celdas/filas, truncamiento 1000 chars
- [ ] Persistencia: DocumentProperties (datasources) + UserProperties (credentials)

## Fase 2 - Scheduler
- [ ] UI scheduler (timezone/hours/days/weekdays/months)
- [ ] Crear triggers (dispatcher o por datasource)
- [ ] Remember my credentials (requisito para scheduler)
- [ ] Reintentos/errores scheduler con mensajes en UI
- [ ] Logs basicos por corrida (doc_id, user_id, datasource_id, duracion, filas, error)

## Fase 3 - Colaboracion
- [ ] Modelo de miembros y roles
- [ ] Invitaciones por email (accept/deny)
- [ ] Enforcements por rol (UI + server)
- [ ] Share credentials (cifrado + warning)

## Fase 4 - Advanced options
- [ ] Advanced query builder (domain editor, order_by, agregaciones)
- [ ] Restriccion por permiso Odoo (Administration/Settings)
- [ ] Guardado por datasource

## Infra / Repo
- [ ] Definir stack de desarrollo (clasp + TS o Apps Script puro)
- [ ] CI basico (lint/test) si se usa TS
- [ ] Plantillas de issues/PRs (opcional)
