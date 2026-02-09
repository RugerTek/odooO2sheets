# AGENTS

Este repo es para un Google Sheets Add-on que integra con Odoo via endpoints web publicos (sin modulo en Odoo).

## Regla de oro
No implementar pagos/suscripciones/facturacion/invoices. Si aparece la necesidad de limites/cuotas, dejar solo hooks tecnicos sin cobro.

## Tracking
- Requisitos: docs/PRD.md
- Backlog: BACKLOG.md
- Checklist OK/NO-OK: STATUS.md

## Convenciones sugeridas (cuando haya codigo)
- Preferir TypeScript + clasp para Apps Script.
- Separar capas: UI (HTML/JS) vs server (Apps Script) vs connector Odoo.
- No loggear secretos.
- Truncar strings > 1000 chars antes de escribir a Sheets.
- Tratar limites (6 min, 50MB) como errores first-class con mensajes accionables.

## Seguridad
- Default: credenciales en UserProperties (no compartidas).
- Si share: cifrar antes de DocumentProperties o usar backend.
