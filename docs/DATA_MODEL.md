# Modelo de Datos (MVP)

## Connection
- id (uuid)
- name (string, immutable)
- title (string)
- odoo_url (string)
- odoo_db (string)
- store_connections (bool)
- share_credentials (bool)
- created_by (google_user_email)
- created_at, updated_at

## Credential
- connection_id
- scope: USER | DOCUMENT (segun share_credentials)
- odoo_username
- secret_encrypted (password/session/refresh)
- expires_at (opcional)

## Datasource
- id (uuid)
- document_id (spreadsheetId)
- sheet_name
- connection_id
- odoo_model
- fields: array[{field_name, label, type, order}]
- domain (string/json) opcional
- order_by (string) opcional
- limit (int)
- write_mode (REPLACE | APPEND)
- header (bool)
- scheduler_enabled (bool)
- scheduler_config: {timezone, hours, days, weekdays, months}
- last_run: {status, at, rows, duration_ms, error}

## Member/Role (si hay colaboracion)
- account_id/document_id
- email
- role (enum 5 niveles)
- invited_at, accepted_at, status
