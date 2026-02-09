# Dev Setup (local)

Este repo genera un proyecto de Google Apps Script a partir de TypeScript y lo deja listo para subir con `clasp`.

## Requisitos
- Node.js instalado.
- Acceso a una cuenta Google con permiso para crear Apps Script / Google Sheets add-ons.

## Instalar dependencias
En PowerShell (en este entorno, usar `npm.cmd`):

```powershell
cd "C:\Users\fabri\Downloads\odoo-sheets-addon"
npm.cmd install
```

## Build
Genera `dist/` con:
- `dist/Code.js` (server-side, bundle)
- `dist/appsscript.json` (manifest)
- `dist/ui/sidebar.html` (UI)

```powershell
npm.cmd run build
```

## Crear proyecto Apps Script (clasp)
1) Login:
```powershell
npx clasp login
```

2) Crear un proyecto vinculado a Google Sheets:
```powershell
npx clasp create --type sheets --title "Odoo O2Sheets (dev)"
```

3) Configurar `.clasp.json` para subir `dist/`:
Editar `.clasp.json` y dejar:
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "dist"
}
```

4) Subir el codigo:
```powershell
npx clasp push
```

5) Abrir el editor:
```powershell
npx clasp open
```

## Probar en Google Sheets
- Recargar la spreadsheet.
- Menu: `Odoo O2Sheets` -> `Open sidebar`.

