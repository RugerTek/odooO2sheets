# Arquitectura

## Componentes
- Google Sheets Add-on (Apps Script)
- UI: sidebar + dialogs
- Storage: PropertiesService (UserProperties, DocumentProperties, ScriptProperties)
- Scheduler: time-driven triggers (por datasource o trigger maestro dispatcher)
- Conector Odoo (HTTP): JSON-RPC

## Integracion Odoo (sin addon)
- Autenticacion: /web/session/authenticate
- Llamadas dataset: /web/dataset/call_kw (e.g. search_read, ead, ead_group)
- Requiere odoo_url publica + odoo_db

## Estrategia de ejecucion
- Manual refresh: accion UI -> Apps Script server -> Odoo -> write to sheet
- Automatic refresh: trigger -> lookup datasources -> run -> update last_run + logs

## Backend opcional
Motivos:
- Sharing seguro de credenciales entre usuarios
- Historial de ejecuciones central
- Encriptacion centralizada
- Control de roles mas robusto

Sin backend: 100% Apps Script con limitaciones y cuidado de seguridad.
