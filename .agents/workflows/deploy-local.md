---
description: despliega en local sin pisar los puertos en uso
---

Para desplegar el frontend de BIACP-Dashboard en un puerto libre y configurar la redirección de MSAL automáticamente:

1. **Identificar puerto libre**:
   Busca puertos disponibles a partir del 3000 (ej: 3001, 3002).
   
2. **Actualizar .env.local**:
   Modifica `NEXT_PUBLIC_REDIRECT_URI` para que coincida con el puerto elegido:
   `NEXT_PUBLIC_REDIRECT_URI=http://localhost:<port>`

3. **Ejecutar servidor**:
   // turbo
   `npm run dev -- -p <port>`

4. **Verificación**:
   Asegúrate de que el login redirija correctamente al nuevo puerto. Si hay un error de "Redirect URI mismatch", regístralo en Azure Portal.
