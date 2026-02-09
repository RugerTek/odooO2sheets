# UX / Flujos

## Sidebar
Secciones:
- Home / Crear extraccion
- Connections
- Datasources
- Account / Collaboration (opcional)

## Connections
- Lista (Name, Title, URL, DB, flags)
- New connection (form)
- Edit: permite Title y parametros (menos Name)
- Validaciones inline: URL accesible, DB, login OK

## Create Extraction Wizard
Secciones numeradas:
1. Tab Name: dropdown hojas existentes + crear nueva escribiendo y Enter
2. Server: elegir Connection; si credenciales invalidas, login
3. Odoo table: selector modulo + modelo + busqueda
4. Columns: selector de campos + ordenar; mapping field -> header
5. Options: limit, domain (opcional), order_by, write mode (replace/append), headers on/off
6. Save

## Datasources List
- Items: sheet + modelo + estado
- Acciones: Refresh, Edit, Schedule
- Filtros: por conexion, sheet, modelo

## Scheduler Dialog
Campos:
- Timezone (auto-detect, editable)
- Hours (lista o cada N horas desde 00:00)
- Days of month
- Days of week
- Months
Nota: no se fija el minuto exacto (Google decide).

## Mensajes clave (errores)
- Credenciales expiradas: pedir re-login; si scheduler activo sin remember, marcar error.
- Instancia inaccesible: "Instance not reachable (must be publicly accessible)".
- Dataset grande: runtime > 6 min o > 50MB: abortar y recomendar filtros/segmentacion.
- Permisos insuficientes: bloquear advanced.
