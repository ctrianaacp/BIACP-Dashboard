---
description: Despliegue local estandarizado en el puerto 3002
---

Para desplegar el frontend de BIACP-Dashboard siempre en el puerto 3002 (estándar para MSAL):

1. **Prerrequisito**:
   Asegúrate de que `NEXT_PUBLIC_REDIRECT_URI` en `frontend/.env.local` sea `http://localhost:3002`.

2. **Ejecutar servidor**:
   // turbo
   `npm run dev -- -p 3002`

3. **Verificación**:
   Accede a [http://localhost:3002](http://localhost:3002) y verifica que el login funcione correctamente.
