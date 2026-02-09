# Roles / Autorizacion

Roles (alineados a "Collaborative access", sin pagos):

1) Can read and refresh requests
- Ver conexiones/datasources
- Refresh manual
- No editar

2) Can update requests and options
- Todo lo anterior
- Editar datasources existentes
- No crear/borrar datasources

3) Can create requests and change advanced options
- Crear/borrar datasources
- Acceder a advanced options
- Gestionar scheduler

4) Can view account settings
- Ver configuracion de cuenta/documento (sin invoices/pagos)

5) Can handle members
- Invitar/editar/revocar miembros

Regla: si no tiene "Can handle members", no ve acciones de invitacion.
