---
description: Despliegue local estandarizado en el puerto 3002 con conexión a BD
---

Para desplegar el frontend de BIACP-Dashboard en el puerto 3002 (estándar para MSAL) de manera segura y conectarse a la Base de Datos de Producción aislada:

1. **Configuración de variables (.env.local)**:
   Asegúrate de que:
   - `NEXT_PUBLIC_REDIRECT_URI=http://localhost:3002`
   - `DATABASE_URL` apunte a `localhost` con el puerto mapeado por el túnel (ej. `postgresql://...localhost:5433...`)

2. **Abrir Túnel SSH a la Base de Datos**:
   La DB de producción solo acepta conexiones locales por seguridad. Abre una nueva terminal y ejecuta:
   // turbo
   `npm run tunnel`
   *(Introduce la contraseña del VPS cuando se solicite y deja esta terminal abierta).*

3. **Ejecutar servidor frontend**:
   En otra terminal, levanta el proyecto:
   // turbo
   `npm run dev`

4. **Verificación**:
   Accede a [http://localhost:3002](http://localhost:3002) y verifica que el login funcione y los paneles carguen los datos correctamente.
