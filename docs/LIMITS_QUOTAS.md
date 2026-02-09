# Limites y Cuotas

## Google Apps Script / Sheets
- 6 min por ejecucion de refresh manual (aprox).
- 50MB por request.
- 5M celdas por spreadsheet.
- Limites de filas nuevas por operacion (ej: 40.000).
- 1000 caracteres por celda: truncar y loggear.

## Odoo
- Timeouts segun workers/CPU/memoria.
- Endpoints publicos: JSON-RPC.

## Comportamiento esperado
- Si runtime > 6 min: abortar y sugerir filtrar por fecha/id.
- Si > 50MB: abortar y sugerir segmentar.
- Si excede celdas/filas: abortar y recomendar dividir.
