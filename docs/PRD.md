# Odoo -> Google Sheets Add-on (sin addon en Odoo)

Add-on de Google Sheets (Google Workspace Marketplace) para extraer datos desde Odoo hacia una hoja de calculo, con refresh manual y programado.

## Objetivo
Construir un add-on que permita:
- Conectarse a una instancia Odoo publica usando credenciales de usuario Odoo (sin instalar nada en Odoo).
- Crear extracciones (datasources) por modelo/tabla, seleccionando campos/columnas, orden, filtros y opciones de escritura.
- Refrescar manualmente y programar refresh automatico (horas/dias/mes) con zona horaria.
- (Opcional, mismo funcionamiento) Multi-conexion y colaboracion por roles dentro del documento/cuenta.
- (Opcional) Opciones avanzadas tipo "SQL editor" equivalente (domain/query builder), con restriccion de permisos.

## Fuera de alcance
- Pagos, suscripciones, facturacion, creditos/planes, checkout, invoices.
- Se pueden dejar ganchos tecnicos para limites/cuotas, pero sin cobro.

## Conceptos
- Connection: URL + DB + flags (store/share) para una instancia Odoo.
- Credentials: usuario/password (o token) con expiracion; opcion "Remember".
- Datasource/Extraction: job configurado (modelo, campos, filtros, limit, sheet destino, write mode, scheduler, estado).

## Documentacion
- docs/PRD.md
- docs/UX.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/SECURITY.md
- docs/AUTHZ_ROLES.md
- docs/LIMITS_QUOTAS.md

## Seguimiento
- Backlog: BACKLOG.md
- Estado actual (OK / NO-OK): STATUS.md
"@ | Set-Content -Encoding UTF8 -Path (Join-Path c:\Users\fabri\Downloads\odoo-sheets-addon "README.md");

@"
# Esencia del Producto (PRD)

## 0) Objetivo del producto
Construir un Google Sheets Add-on que permita a usuarios de Google Sheets:
- Conectarse a una instancia Odoo (sin instalar nada en Odoo) usando credenciales de usuario Odoo.
- Crear extracciones/datasources para traer datos desde un modelo Odoo hacia una sheet, eligiendo campos/columnas, orden y opciones de extraccion.
- Actualizar/refrescar manualmente cada datasource y tambien programar actualizaciones automaticas por horarios/dias/mes con zona horaria.
- (Opcional) Multi-conexion (varias instancias Odoo/companias) y colaboracion por roles dentro del documento/cuenta.
- Incluir opciones avanzadas tipo "SQL Editor / Advanced request" (o equivalente) con restriccion de permisos.

Fuera de alcance: pagos/suscripciones/facturacion/creditos/planes/checkout/invoices.

## 1) Principios UX
### Instalacion y arranque
- Instalacion via Google Workspace Marketplace.
- Aparece como menu en Google Sheets (Extensions/Add-ons).
- No requiere instalar modulo/addon en Odoo; se conecta via web a instancia publica.

### Navegacion
Sidebar con secciones:
- Home / Crear extraccion
- Connections
- Datasources
- Account / Collaboration (opcional; sin pagos)

## 2) Conceptos clave
### 2.1 Connection
Campos:
- Name (tecnico, inmutable): string minusculas alfanumerico; no editable luego.
- Title (descriptivo): editable.
- Web Address: URL publica Odoo.
- Database: nombre tecnico DB Odoo.
- Store connections (bool): disponible para otros docs/hojas segun storage.
- Share credentials (bool): comparte credenciales entre editores (con advertencias).

### 2.2 Credentials
- Usuario y password (o token).
- Deben expirar y requerir re-login.
- Opcion "Remember my credentials" para automatizaciones.

### 2.3 Datasource / Extraction
Job configurado que:
- Usa una Connection
- Define modelo Odoo
- Define campos + orden
- Define filtros/limites
- Define sheet destino
- Refresca manual/automatico
- Mantiene estado (ultima corrida, error, duracion, filas)

## 3) Requerimientos funcionales (FR)
- FR-1: Gestion de conexiones (CRUD + validacion conectividad).
- FR-2: Autenticacion contra Odoo (login, remember, restriccion advanced).
- FR-3: Wizard de creacion de extraccion.
- FR-4: Ejecutar/refrescar extraccion y escribir en sheet.
- FR-5: Scheduler (triggers) con timezone + reglas horas/dias/mes.
- FR-6: Colaboracion/roles (sin pagos).
- FR-7: Opciones avanzadas (domain/query builder / "SQL-like" a APIs).

## 4) No funcionales (NFR)
- Seguridad de secretos: UserProperties por defecto; si share, cifrado en DocumentProperties o backend.
- Performance/cuotas: runtime 6 min, 50MB, limites de celdas/filas, truncamiento strings.
- Observabilidad: logs por ejecucion y (opcional) run history.
- Compatibilidad: objetivo Odoo v12+ (ideal v13-v17), Odoo Cloud/on-prem publico.

## 5) Arquitectura (alto nivel)
- Google Sheets Add-on (Apps Script): sidebar + dialogs.
- Storage: PropertiesService (user/doc/script).
- Triggers: time-driven.
- Conector Odoo: JSON-RPC authenticate + call_kw (search_read/read/read_group).
- Backend propio (opcional): sharing seguro, historial, cifrado central, control roles.

## 6) Permisos (resumen)
Roles (alineados a collaborative access, sin pagos): ver docs/AUTHZ_ROLES.md.

## 7) Criterios de aceptacion
- AC-1: Connection creada y login OK con URL publica + DB.
- AC-2: Extraccion basica crea datasource y refresca llenando sheet con headers + filas.
- AC-3: Scheduler corre automaticamente segun config.
- AC-4: Colaboracion por roles funciona.
- AC-5: Limites detectados y mensajes orientativos.
