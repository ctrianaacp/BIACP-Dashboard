# 🛡️ Workflow: Despliegue Producción y Hardening VPS

Este workflow documenta el proceso estándar para levantar un servidor de producción desde cero, desplegar la aplicación BIACP-Dashboard a través de Coolify y asegurar el servidor contra amenazas externas.

## 1. Arquitectura Base
- **Hosting:** IONOS VPS M (Ubuntu 24.04 LTS).
- **Orquestador:** Coolify (vía Docker).
- **Aplicación:** Next.js compilado como `standalone`.
- **Base de Datos:** PostgreSQL interno gestionado por Coolify.

---

## 2. Proceso de Despliegue en Coolify

Para evitar problemas de autenticación SSH entre el servidor y GitHub:
1. **GitHub:** El repositorio (`ctrianaacp/BIACP-Dashboard`) debe estar configurado como **Public** temporal o permanentemente, dado que las contraseñas reales (`DATABASE_URL`, `AZURE_CLIENT_ID`) no residen en el código, sino en el panel de variables de entorno de Coolify.
2. **Coolify UI:** 
   - Crear recurso "Public Repository".
   - Establecer puerto expuesto en `3000`.
   - Crear base de datos PostgreSQL y copiar la `Internal Database URL`.
   - Añadir la URL copiada a la variable `DATABASE_URL` del contenedor de Next.js.
   - Presionar **Deploy**.

---

## 3. Configuración de DNS y SSL

- **SiteGround:** Agregar un único **Registro A** en el panel DNS.
  - **Name:** `bi`
  - **IP:** `74.208.130.203` (o la IP correspondiente del VPS).
- **Coolify:** Definir el dominio completo (`https://bi.acp.com.co`) en la configuración del servicio. Coolify solicitará a Let's Encrypt el certificado SSL automáticamente.

---

## 4. Hardening y Seguridad del Servidor (Aplicado)

Para proteger el VPS frente a ataques de fuerza bruta y escaneos automáticos de puertos, se ejecutó el siguiente protocolo:

### Acceso SSH Restringido
- **Usuario administrador seguro:** Se creó el usuario `acpadmin` con privilegios `sudo`.
- **Desactivación de contraseñas:** Se modificó `/etc/ssh/sshd_config` (`PasswordAuthentication no`). El servidor **solo acepta Llaves Criptográficas (ED25519)**.
- **Acceso Root deshabilitado:** No se permite iniciar sesión directa como `root` (`PermitRootLogin no`).

### Protección Activa de Red
- **Fail2Ban:** Monitorea intentos de acceso fallidos en SSH y banea la IP atacante de inmediato.
- **UFW (Uncomplicated Firewall):** Sólo permite tráfico entrante por los puertos estrictamente necesarios:
  - `22`: SSH (Protegido por llaves).
  - `80`: HTTP (Para redirecciones SSL).
  - `443`: HTTPS (Aplicación y servicios cifrados).
  - `8000`: Coolify UI.

### Mantenimiento Automático
- **Unattended-Upgrades:** Configurado para instalar parches de seguridad críticos del núcleo de Ubuntu de forma silenciosa en segundo plano cada noche.

> [!IMPORTANT]
> **Comando de acceso de emergencia:** Si se necesita entrar a la consola del servidor desde la máquina administradora Windows (donde reside la llave `.ssh/id_ed25519`), el comando correcto es:
> `ssh -i "$env:USERPROFILE\.ssh\id_ed25519" acpadmin@74.208.130.203`
