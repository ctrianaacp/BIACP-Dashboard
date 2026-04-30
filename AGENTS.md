# 🤖 Sistema de Agentes BIACP-Dashboard

Este documento define las reglas de desarrollo, la arquitectura de agentes y los workflows operativos para el proyecto BIACP-Dashboard.

## 📜 Reglas de Oro del Proyecto

1.  **Estética Premium**: Todo desarrollo visual debe ser impactante ("WOW"). Utilizamos gradientes suaves, micro-animaciones, sombras profundas y tipografía moderna (Inter/Outfit).
2.  **Cero Placeholders**: No se permiten imágenes o datos de relleno. Si falta un recurso, se genera o se consulta la fuente real.
3.  **Normalización Estricta**: Los datos provenientes de Excel/SharePoint deben pasar por el motor de normalización (`lib/normalizacion.ts`) para garantizar integridad.
4.  **Seguridad First**: Toda consulta a SharePoint debe validarse con MSAL. No se exponen secretos en el frontend.
5.  **Performance y Tablas de Detalle**: Las descargas de Excel desde Graph API deben usar el método XLSX directo para archivos pequeños. Para volúmenes masivos de datos en PostgreSQL (ej. >500k registros), las agregaciones de KPIs/gráficas deben hacerse siempre en la base de datos, y las tablas detalladas (`DataTable`) deben recibir una muestra cruda limitada (ej. `LIMIT 2000`) para no colapsar el navegador, manteniendo así los filtros tipo Excel funcionales.
6.  **Fuente de Verdad (Base de Datos)**: Para volúmenes masivos de datos (ej. Bienes y Servicios, Empleo, Inversión Social), la fuente de verdad es la base de datos **PostgreSQL** alojada en producción, gestionada a través de ingestas de los sub-agentes ETL de Python. El Frontend debe consultar esta DB usando el pool de `lib/db.ts` con caché dinámico (`force-dynamic`).

---

## 👥 Roles y Sub-Agentes

Para optimizar el desarrollo, utilizaremos los siguientes perfiles especializados:

| Agente | Especialidad | Responsabilidad |
| :--- | :--- | :--- |
| **Orchestrator** | Arquitectura | Gestión del estado global y rutas. |
| **Designer** | UI/UX | Implementación de componentes visuales de alto nivel (ApexCharts, CSS). |
| **Data Analyst** | ETL/Graph | Conexión con Microsoft Graph API y normalización de datos. |
| **QA/Validator** | Testing | Verificación de tipos en TypeScript y consistencia de datos. |

---

## 🛠️ Workflows (.agents/workflows/)

### 🌍 Despliegue a Producción (Coolify)
Flujo oficial para compilar y lanzar el Dashboard en el VPS.
1. Ejecuta el workflow `deploy-production.md` o revisa el documento en `.agents/workflows/deploy-production.md`.
2. Sigue los pasos de commits en Git, recarga en Coolify y monitoreo con Sentinel.

### 🚀 Despliegue Local (Estándar Puerto 3007)
Para desplegar el frontend de forma consistente con MSAL y conectarse a la Base de Datos de Producción:
1. **Túnel SSH Obligatorio:** Como política de seguridad, la base de datos PostgreSQL de producción está aislada en Coolify (`127.0.0.1`). Debes abrir un Túnel SSH mapeando a la base de datos correcta (`ssh -L 5433:127.0.0.1:5432 root@74.208.130.203 -N`) y asegurar que tu `DATABASE_URL` en `.env.local` apunte a `localhost:5433`. *(Nota: la BD en el VPS corre internamente en el 5432).*
2. Asegurar que `NEXT_PUBLIC_REDIRECT_URI=http://localhost:3007` en `.env.local`.
3. Usar el workflow `deploy-3007.md` (o el script `npm run tunnel` / `npm run dev`).
4. Ejecutar `npm run dev -- -p 3007` (se recomienda usar los scripts en `package.json` para levantar el túnel y el server automáticamente).

### 📊 Integración de Nuevas Fuentes
1. Registrar archivo en `SHAREPOINT_FILES` (`lib/graphClient.ts`).
2. Definir interfaz de datos en el componente.
3. Mapear columnas usando alias (`r["Col"] ?? r["COL"]`).
4. Aplicar normalización de Departamento/Municipio/Operadora.

### 🔬 Laboratorio de Normalización
1. Probar nuevas reglas en `/dashboard/admin/normalizacion`.
2. Validar fuzzy matching con catálogos DANE/Operadoras.
3. Integrar regla validada en `lib/normalizacion.ts`.

---

## 📂 Estructura de Conocimiento
- `AGENTS.md`: Este archivo.
- `lib/normalizacion.ts`: Cerebro de transformación de datos.
- `lib/graphClient.ts`: Motor de comunicación con SharePoint.
- `app/dashboard/`: Vistas de indicadores.
