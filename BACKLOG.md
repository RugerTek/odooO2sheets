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
- [x] Advanced query builder (filtros): OR + grupos visuales (hasta 3 niveles)
- [ ] Restriccion por permiso Odoo (Administration/Settings)
- [ ] Guardado por datasource

## UX / Pulido
- [ ] Conexiones: al editar/usar conexion, que el flujo para editar columnas sea consistente y no confuso (simplificar)
- [ ] UI: arreglar quiebres visuales (overflow de textos largos, responsive)
- [x] Columnas: input "Agregar por path" (ej: move_id.partner_id....display_name) que auto-seleccione la columna si existe (hasta 3 niveles)
- [ ] Columnas: mejorar feedback cuando "Cargar columnas" / "Actualizar sample" falla (error mas claro)
- [x] Sidebar: loader fijo arriba para feedback mientras procesa (runServer)
- [x] Ocultar info tecnica por defecto (doc id, etc) y dejarla en "Debug" / "Info tecnica"
- [ ] Documentacion: como usarlo en otras planillas (template vs add-on publicado)

## Infra / Repo
- [x] Definir stack de desarrollo (clasp + TS)
- [ ] CI basico (lint/test) si se usa TS (pendiente)
- [ ] Plantillas de issues/PRs (opcional)
