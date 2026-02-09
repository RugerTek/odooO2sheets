# Requerimientos (Fuente Completa)

Este documento preserva el detalle completo de requerimientos, definiciones, FR/NFR, flujos y criterios de aceptacion, para que el repo tenga la esencia completa del producto.

## 0) Objetivo del producto

Construir un Google Sheets Add-on (extension) que permita a usuarios de Google Sheets:

- Conectarse a una instancia Odoo (sin instalar nada en Odoo) usando credenciales de usuario Odoo.
- Crear extracciones/datasources para traer datos desde una tabla/modelo de Odoo hacia una hoja de calculo, eligiendo columnas/campos, orden y opciones de extraccion.
- Actualizar/refrescar manualmente cada datasource y tambien programar actualizaciones automaticas por horarios/dias/mes con zona horaria.
- (Opcional, pero parte del mismo funcionamiento) Permitir multi-conexion (varias instancias Odoo/companias) y colaboracion por roles dentro del documento/cuenta.
- Incluir opciones avanzadas como "SQL Editor / Advanced SQL request" (o equivalente), con restriccion de permisos.

Fuera de alcance:
- Cualquier sistema de pagos, suscripciones, facturacion, creditos/planes, checkout, gestion de invoices.
- Si se pueden dejar ganchos tecnicos para limites/cuotas, pero sin cobro.

## 1) Principios y experiencia de usuario (UX)

### 1.1 Instalacion y arranque

- El add-on se instala desde Google Workspace Marketplace y aparece como menu en Google Sheets ("Extensions/Add-ons").
- No requiere instalar ningun modulo/addon en Odoo; se conecta via web a la instancia publica.

### 1.2 Navegacion dentro de Sheets

El add-on abre un sidebar (panel lateral) con:

- Home / "Crear extraccion"
- Conexiones (Connections)
- Datasources (lista de extracciones)
- Cuenta / Colaboracion (opcional, sin pagos)

Desde el menu del add-on tambien se accede a secciones (como "Connections" y "My Account").

## 2) Conceptos clave y definiciones

### 2.1 Connection (Conexion)

Representa un vinculo con una instancia Odoo (empresa/DB) y define:

- Name (tecnico, inmutable): string, minusculas alfanumerico, no editable luego. Ej: master, main, dev, company1.
- Title (descriptivo): string editable, para elegir entre varias conexiones.
- Web Address: URL publica accesible de Odoo (https://...).
- Database: nombre tecnico de la base en Odoo (no necesariamente igual al dominio).
- Store connections (bool): si true, la conexion queda disponible para otros documentos/otras hojas (segun estrategia de storage).
- Share credentials (bool): si true, se comparten credenciales para que otros editores del doc no deban loguearse individualmente (con advertencias de seguridad).

### 2.2 Credentials (Credenciales)

- Usuario y password (o token) de Odoo para autenticar sesion.
- Deben poder expirar y requerir re-login.
- Opcion "Remember my credentials" para permitir refrescos automaticos incluso si expiran (renovacion automatica / reauth).

### 2.3 Datasource / Extraction (Extraccion)

Un "job" configurado que:

- Usa una Connection
- Define un modelo Odoo (tabla)
- Define columnas/campos + orden
- Define filtros/limites
- Define hoja destino (Tab Name)
- Puede refrescar manual/automatico
- Mantiene estado (ultima corrida, errores, duracion, filas traidas, etc.)

## 3) Requerimientos funcionales (FR)

### FR-1: Gestion de conexiones

- Crear conexion con campos: Name, Title, Web Address, Database, Store connections, Share credentials.
- Listar conexiones existentes.
- Seleccionar conexion para usar en extracciones.
- Editar Title y parametros (excepto Name inmutable).
- Validar conectividad:
  - URL accesible
  - Database provista
  - Login OK
- Almacenar conexion por defecto "en el documento actual" y si "Store connections = true" guardar a nivel cuenta/usuario (segun diseno).

### FR-2: Autenticacion contra Odoo

- En el momento de usar una conexion, si no hay credenciales validas:
  - Prompt de login (usuario+password Odoo).
- Soportar "Remember my credentials":
  - Guarda credenciales/refresh token (segun metodo elegido) para permitir automatizaciones.
- Restringir funciones avanzadas:
  - "Advanced SQL request" solo si el usuario Odoo tiene privilegio "Administration / Settings".

### FR-3: Crear extraccion (wizard)

Flujo "Create extraction" con:

- Tab Name:
  - Dropdown con hojas existentes.
  - Permitir crear hoja nueva escribiendo nombre y presionando Enter.
- Server:
  - Elegir una Connection.
  - Si credenciales expiran o primera vez, pedir login.
  - Opcion/checkbox "Remember my credentials" visible en login.
- Odoo table:
  - Selector de modulo y luego tabla/modelo.
  - Busqueda por descripcion o nombre tecnico.
  - Confirmacion con boton check.
- Column selector:
  - Popup para seleccionar campos/columnas y ordenarlas (drag/drop o up/down).
  - Guardar mapping: campo tecnico Odoo -> header en sheet (por defecto el label, editable opcional).
- Opciones de extraccion:
  - Limit (numero de filas a traer). Debe advertir que Odoo por defecto puede devolver solo ~80 registros si no se ajusta.
  - Filtros basicos (dominio Odoo) (opcional pero recomendado para dataset grande).
  - Orden (order by) (opcional).
  - Modo "Replace sheet" vs "Append" (recomendado).
  - Encabezados (header row) on/off (recomendado on).
- Guardar Datasource.

### FR-4: Ejecutar/Refrescar extraccion

Boton "Refresh" por datasource:

- Ejecuta query a Odoo
- Vuelca resultado en la hoja destino.
- Mostrar estado:
  - Last refresh timestamp
  - Rows fetched
  - Duration
  - Error message si falla
- Manejo de limites:
  - Si excede 6 min de ejecucion en Google Apps Script, cortar con error sugerido ("filtrar por fecha o id").
  - Si excede 50MB transferencia, cortar/avisar.

### FR-5: Scheduler (actualizaciones automaticas)

En opciones del datasource: checkbox "Refresh automatically".

Al activar, abrir popup "Schedule configuration" con parametros:

- Timezone (auto-detect, editable)
- Hours: lista fija o intervalo (cada N horas desde 00:00)
- Days: dias del mes (ej 1..7)
- Days of week: dias de semana (ej lunes-viernes)
- Month: meses del ano (por defecto todos)

Nota: no se elige el minuto exacto; Google lo decide.

Requisitos:
- Requiere credenciales recordadas (si no, advertir y bloquear scheduler).
- Crear triggers (Apps Script) por datasource o un trigger maestro que despacha.

### FR-6: Colaboracion / roles (sin pagos)

Implementar un modo "account sharing / collaborative access" equivalente en funcionalidad:

- Owner/Admin puede invitar miembros (por email Google).
- Roles disponibles (exactos, como o2sheet):
  - Can read and refresh requests
  - Can update requests and options
  - Can create requests and change advanced options (incluye SQL Editor, Email scheduler, cambiar scheduler)
  - Can view invoices and change subscription informations (en este proyecto: renombrar a "Can view account settings" y NO incluir pagos/invoices)
  - Can handle members

Reglas:
- Si un usuario no tiene "Handle members" no ve links de invitacion.
- El invitado recibe email y puede aceptar/denegar.

Nota de seguridad:
- Si se activa "Share credentials" en la conexion, otros usuarios pueden refrescar sin login propio.

### FR-7: Opciones avanzadas (SQL Editor / Advanced request)

Habilitar modo avanzado que permita:

- Query avanzada (preferentemente usando ORM/domain+fields, o si se usa SQL, que sea controlado).
- Requisito: usuario Odoo con permisos de administracion/configuracion.
- Guardar la configuracion por datasource.

Nota:
- En Odoo SaaS/Online, SQL directo suele no estar permitido por APIs publicas; por eso, "SQL Editor" puede ser un "Advanced domain editor" o un "query builder" que se traduzca a search_read/read_group.

## 4) Requerimientos no funcionales (NFR)

### NFR-1: Seguridad y almacenamiento de secretos

- Por defecto, credenciales en UserProperties (Apps Script), no compartidas.
- Si "Share credentials" = true: guardar credenciales en DocumentProperties cifradas (accesible a editores) o en backend con control de acceso.
- Encriptacion recomendada: AES-GCM con clave derivada de un secreto del proyecto + salt por documento (si no hay backend).

### NFR-2: Performance y cuotas

Respetar limitaciones documentadas:

- Odoo: timeouts por workers/CPU/memoria.
- Google:
  - 5 millones de celdas por spreadsheet
  - 40.000 filas nuevas por operacion
  - 1000 caracteres por celda (truncar)
  - 6 min por refresh manual
  - 50MB por request
  - 100k calls/dia (depende de API/quota)

### NFR-3: Observabilidad

- Log por ejecucion: datasource_id, doc_id, user_id, duracion, filas, error.
- Pantalla "Run history" (opcional).

### NFR-4: Compatibilidad

- Funciona en major versions of Odoo (objetivo: v12+; ideal v13-v17).
- Odoo Cloud / On-prem publico.

## 5) Diseno tecnico propuesto (arquitectura)

### 5.1 Componentes

- Google Sheets Add-on (Apps Script)
- UI: sidebar + dialogs
- Storage: PropertiesService (user/doc/script)
- Triggers: time-driven triggers
- Conector Odoo
  - HTTP(s) a endpoints Odoo
  - Auth (JSON-RPC)
  - Query (search_read, read, read_group)
  - Manejo de sesion/cookies o token

Backend propio (opcional):
- Encriptacion central
- Sharing seguro entre usuarios
- Historial de ejecuciones
- Control de roles avanzado

### 5.2 Integracion Odoo (sin addon)

- Requisito: Web Address publicamente accesible.
- Autenticacion: JSON-RPC `/web/session/authenticate`
- Llamadas: `/web/dataset/call_kw` para search_read, etc.
- Database name obligatorio.

### 5.3 Modelo de datos (minimo viable)

Connection
- id (uuid)
- name (string, immutable)
- title (string)
- odoo_url (string)
- odoo_db (string)
- store_connections (bool)
- share_credentials (bool)
- created_by (google_user_email)
- created_at, updated_at

Credential
- connection_id
- scope: USER o DOCUMENT (segun share_credentials)
- odoo_username
- secret_encrypted (password/session/refresh)
- expires_at (opcional)

Datasource
- id (uuid)
- document_id (spreadsheetId)
- sheet_name (tab name)
- connection_id
- odoo_model (string)
- fields: array[{field_name, label, type, order}]
- domain (string/json) opcional
- order_by (string) opcional
- limit (int)
- write_mode (REPLACE/APPEND)
- header (bool)
- scheduler_enabled (bool)
- scheduler_config: {timezone, hours, days, weekdays, months}
- last_run: {status, at, rows, duration_ms, error}

Member/Role (si implementas colaboracion)
- account_id/document_id
- email
- role enum (5 niveles)
- invited_at, accepted_at, status

## 6) UI / Flujos detallados

### 6.1 Connections Page

- Tabla con conexiones (Name, Title, URL, DB, flags)
- Boton "New connection"
- Form:
  - Name (helper: "no editable luego")
  - Title
  - Web Address
  - Database (link "how to find DB name")
  - Store connections (checkbox)
  - Share credentials (checkbox)
  - CTA: Save
  - Validaciones inline

### 6.2 Create Extraction Wizard

Pantalla con secciones numeradas:
- Tab Name
- Server
- Odoo table
- Columns
- Options
- Save

### 6.3 Datasources List

Cada datasource:
- Nombre (sheet + modelo)
- Estado ultima corrida
- Botones: Refresh, Edit, Schedule
- Filtros: por conexion, por sheet, por modelo

### 6.4 Scheduler Dialog

Campos exactamente como docs:
- Timezone
- Hours (interval o lista)
- Days (del mes)
- Days of week
- Month
- Mensaje: "No se puede fijar minuto exacto"

### 6.5 Collaboration / Account

- Seccion "Members"
- Invite member (si role permite)
- Lista con roles desplegable
- Revocar acceso

## 7) Reglas de permisos (autorizacion)

Mapear roles a acciones:

- Can read and refresh requests
  - Ver conexiones/datasources
  - Refresh manual
  - No editar

- Can update requests and options
  - Todo lo anterior
  - Editar datasources existentes
  - No crear ni borrar datasources

- Can create requests and change advanced options
  - Crear/borrar datasources
  - Acceder a advanced options (SQL/advanced query)
  - Gestionar scheduler

- Can view account settings
  - Ver configuracion de cuenta/documento

- Can handle members
  - Invitar/editar/revocar miembros

## 8) Manejo de errores y edge cases

- Credenciales expiradas
  - Si 401/invalid session: pedir login
  - Si scheduler activo y credenciales no recordadas: marcar datasource en error y notificar

- Dataset demasiado grande
  - runtime > 6 min: abortar con sugerencia
  - transferencia > 50MB: abortar/avisar
  - limites de celdas/filas: abortar y recomendar dividir

- Truncamiento por celda
  - string > 1000 chars: truncar y loggear

- Odoo inaccesible
  - DNS/timeout: error "Instance not reachable (must be publicly accessible)"

- Permisos insuficientes
  - Bloquear advanced sin "Administration/Settings"

## 9) Criterios de aceptacion (Acceptance Criteria)

- AC-1 Conexion: crear Connection y testear login exitoso.
- AC-2 Extraccion basica: crear datasource (hoja, conexion, modelo, columnas, limit) y refrescar con headers + filas.
- AC-3 Scheduler: activar y correr automatico segun config.
- AC-4 Colaboracion: invitar miembro, aceptar, acciones segun rol.
- AC-5 Limitaciones: detectar/cortar por limites y mostrar mensajes orientativos.

## 10) Implementacion sugerida (tareas por fases)

Fase 1 - MVP
- Add-on + sidebar
- Connections CRUD
- Auth Odoo
- Create extraction (sheet/model/fields/limit)
- Refresh manual
- Persistencia por documento/usuario

Fase 2 - Scheduler
- UI scheduler + triggers
- Remember credentials
- Estado de corrida + logs basicos

Fase 3 - Colaboracion
- Roles + invitaciones
- Share credentials (cifrado y advertencias)

Fase 4 - Advanced options
- Query builder avanzado (domain/fields/order/aggregations)
- "SQL-like editor" traducido a API Odoo

## 11) Notas de compliance y permisos Google

- El add-on va a requerir permisos para ver/editar/crear/borrar spreadsheets del usuario.
- Debe incluir pantalla de consentimiento y politica de privacidad (aunque no haya pagos).

## 12) Definiciones de "misma funcionalidad" (no debe faltar)

Checklist minimo:
- Conectar a Odoo sin instalar nada en Odoo
- Crear multiples conexiones
- Crear extracciones con seleccion de modelo y columnas
- Refrescar manualmente y ver estado
- Programar refresh automatico con timezone/hours/days/weekdays/month
- Manejar credenciales (expiran + remember)
- Colaboracion por roles (sin pagos)
- Manejo de limitaciones (6 min, 50MB, filas/celdas, truncamiento)
