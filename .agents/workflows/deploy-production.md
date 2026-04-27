# 🌍 Workflow: Despliegue a Producción (Coolify)

Este workflow estandariza el proceso de despliegue del frontend de `BIACP-Dashboard` y las herramientas satélite hacia el entorno de producción en el VPS hospedado en IONOS utilizando **Coolify v4**.

## 1. Preparación del Código (Local)
Antes de subir cualquier cambio a producción, asegúrate de:
- **Verificar Variables de Entorno:** Los secretos y configuraciones críticas deben estar definidos en la interfaz de Environment Variables de Coolify, NO quemados en el código.
- **Sincronización de Base de Datos:** Si cambiaste la estructura de alguna tabla en PostgreSQL (ej. `hecho_inversion_social`), asegúrate de que el código del API (`app/api/...`) coincida exactamente con las columnas actuales para evitar errores `42703` (Undefined Column) o `500 Internal Server Error`.
- **Desactivar Caché Estática (Opcional pero recomendado para DBs en vivo):** Asegurar que las rutas de API que leen de PostgreSQL tengan `export const dynamic = 'force-dynamic';` para prevenir que Next.js entregue datos antiguos cacheados.

## 2. Push a Repositorio
Coolify está conectado directamente al repositorio de GitHub (`ctrianaacp/BIACP-Dashboard`).
Ejecuta los siguientes comandos para subir tus cambios:
```bash
git add .
git commit -m "feat: descripción clara de los cambios"
git push origin main
```

## 3. Despliegue en Coolify
1. Ingresa al panel de administración de Coolify: `http://74.208.130.203:8000`
2. Selecciona el proyecto **BIACP-Dashboard** y luego el recurso correspondiente (ej. `Frontend`).
3. Haz clic en el botón **Deploy** (o **Force Rebuild** si modificaste `package.json` o dependencias críticas).
4. **Monitoreo del Build:** Haz clic en *Show Debug Logs* para observar el progreso. El contenedor se empaquetará utilizando la imagen base y Nixpacks/Docker.

## 4. Post-Despliegue y Monitoreo (Sentinel)
1. Una vez que Coolify indique que el estado es **Healthy**, ingresa a `https://bi.acp.com.co` y realiza un *Hard Refresh* (`Ctrl+F5`) en tu navegador para limpiar el caché del cliente (`react-query`).
2. Verifica el correcto renderizado de los datos en los módulos afectados.
3. **Control de Recursos:** Ve a la pestaña **Metrics** del servidor (`localhost` en Coolify) para monitorear el consumo de CPU y RAM. Si el uso de CPU se mantiene al 100% por tiempos prolongados o la RAM se agota, considera optimizar las consultas SQL.

---
// turbo-all
// Este archivo sirve como guía paso a paso. No contiene comandos automatizables de bash salvo el flujo de git.
