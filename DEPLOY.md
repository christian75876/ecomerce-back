# Despliegue en Hetzner + Docker + Cloudflare/Porkbun

Estado del entorno de producción y guía de mantenimiento. El backend ya está desplegado
según lo descrito aquí — esta guía sirve para futuros redeploys y para entender cómo
está armado.

## Estado actual

- **Servidor**: Hetzner Cloud, CX23 (2 vCPU / 4GB RAM), Ubuntu 26.04 LTS, Nuremberg.
  IP pública: `46.225.27.92` (fija mientras no se borre el servidor).
- **Dominio backend**: `https://api.merku.co`, DNS gestionado en Porkbun (registro `A`
  directo a la IP del servidor, sin proxy). Certificado TLS emitido automáticamente por
  Caddy vía Let's Encrypt.
- **Frontend**: Cloudflare Worker `merku` (`https://merku.christian75876.workers.dev`),
  desplegado automáticamente vía Cloudflare Workers Builds al hacer push a `main` del
  repo del frontend.
- **Repo en el servidor**: `/opt/merku-backend`, clonado con una deploy key de solo
  lectura (`merku-backend-prod` en GitHub → Settings → Deploy keys).
- **Stack**: `docker-compose.prod.yml` (Postgres 16 + NestJS + Caddy), red interna
  aislada, sin exponer el puerto de Postgres al host.

## Antes de empezar (si se recrea el entorno desde cero)

- No commitees nunca el `.env` real. `.gitignore`/`.dockerignore` ya lo excluyen.
- Genera todos los secretos nuevos para este entorno (no reutilices los de Railway/dev).
- Guarda el `.env` de producción solo en el servidor (permisos `600`) o en un gestor de
  secretos. No lo pegues en chats, tickets ni documentos compartidos.

## 1. Servidor (ya hecho)

Hetzner Console → proyecto `merku-prod` → servidor `merku-backend-prod` (CX23, Ubuntu,
Nuremberg), con la SSH key `deploy@merku-backend`.

Hardening aplicado:

```bash
# Usuario sin privilegios (deploy), con sudo interactivo
adduser --disabled-password --gecos '' deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Firewall: solo SSH, HTTP, HTTPS (reglas ANTES de activar)
apt update && apt install -y ufw fail2ban
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban

# Swap 2GB (4GB RAM: Postgres + Node conviven mejor)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

> Nota: las tareas de administración se siguen ejecutando como `root` vía llave SSH
> (Hetzner ya deshabilita login root por contraseña). `deploy` queda disponible con
> sudo interactivo para trabajo manual del día a día.

## 2. Docker (ya hecho)

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

## 3. Clonar el repo (ya hecho)

Deploy key de solo lectura generada en el propio servidor y agregada en GitHub →
Settings → Deploy keys (sin write access):

```bash
ssh-keygen -t ed25519 -C "merku-backend-prod-deploy" -f /root/.ssh/repo_deploy_key -N ""
# pegar /root/.ssh/repo_deploy_key.pub en GitHub → Deploy keys

GIT_SSH_COMMAND='ssh -i /root/.ssh/repo_deploy_key -o IdentitiesOnly=yes' \
  git clone git@github.com:christian75876/ecomerce-back.git /opt/merku-backend
```

## 4. `.env` de producción (ya hecho)

`cp .env.example .env` y se completó con: credenciales de DB generadas (no reutilizadas
de dev), `JWT_SECRET` generado con `openssl rand -hex 32`, `DOMAIN=api.merku.co`,
`ALLOWED_ORIGINS=https://merku.christian75876.workers.dev`, admin seed, SMTP (Brevo),
Cloudinary, Brevo API key, VAPID keys. `SENTRY_DSN` y `TURNSTILE_SECRET_KEY` quedaron
vacíos por ahora (ambos son opcionales — el código los omite limpiamente si no están
configurados; se pueden agregar después sin rehacer el despliegue).

Recuerda: el hash de `ADMIN_PASSWORD_HASH` va con cada `$` escapado como `$$` en este
archivo, porque `docker-compose.prod.yml` lo inyecta vía `env_file`.

## 5. Migraciones de base de datos (TypeORM)

`DATABASE_SYNCHRONIZE=false` en producción — el esquema se gestiona con migraciones
versionadas ([src/database/data-source.ts](src/database/data-source.ts) +
`yarn migration:generate` / `migration:run` / `migration:run:prod` en `package.json`).

La migración base (`src/migrations/1787067006765-InitialSchema.ts`) ya se generó y
aplicó contra la base de datos de producción (37 tablas + extensión `uuid-ossp`, que
TypeORM crea automáticamente al ejecutar la migración).

### Aplicar una migración nueva en cada deploy futuro

```bash
cd /opt/merku-backend
GIT_SSH_COMMAND='ssh -i /root/.ssh/repo_deploy_key -o IdentitiesOnly=yes' git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm app npx typeorm migration:run -d dist/database/data-source.js
```

### Generar una migración nueva (cuando cambien las entidades)

Sin necesidad de tener Postgres localmente — usando Docker en el propio servidor (o en
cualquier máquina con Docker):

```bash
docker compose -f docker-compose.prod.yml up -d db
docker run --rm --network merku-backend_merku_net -v /opt/merku-backend:/app -w /app \
  --env-file /opt/merku-backend/.env -e DATABASE_HOST=db -e PORT_DB=5432 \
  node:20-bookworm-slim bash -c "corepack enable && yarn install --frozen-lockfile && yarn migration:generate src/migrations/NombreDelCambio"
```

Revisa el SQL generado, cópialo a tu máquina local, commitea y haz push antes de
correrlo en el servidor real con `migration:run`.

## 6. DNS (ya hecho)

`merku.co` está registrado en Porkbun. Su editor de DNS (con backend de Cloudflare, pero
sigue siendo 100% Porkbun — no requiere cambiar nameservers a una cuenta externa de
Cloudflare) tiene el registro:

```
A    api    46.225.27.92    TTL 600
```

Caddy emitió el certificado real para `api.merku.co` vía HTTP-01 apenas propagó el DNS.

> El dominio temporal usado durante el despliegue inicial
> (`46-225-27-92.sslip.io`, auto-resuelve a la IP sin configuración) ya no se usa, pero
> sigue funcionando como fallback si `DOMAIN` se revierte.

## 7. Stack completo

```bash
cd /opt/merku-backend
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy   # confirma emisión del certificado TLS
curl -I https://api.merku.co/health
```

## 8. Frontend (Cloudflare Worker `merku`)

Repo separado (`ecomerce`), Vite + `wrangler`, desplegado automáticamente por Cloudflare
Workers Builds en cada push a `main`. La URL de la API se hornea en build-time
(`import.meta.env.VITE_API_URL`), así que se configura como variable de **build** en el
dashboard de Cloudflare (Workers & Pages → `merku` → Settings), no como env var runtime:

| Variable | Valor |
|---|---|
| `VITE_API_URL` / `VITE_API_BASE_URL` | `https://api.merku.co/api` |
| `VITE_APP_URL` | `https://merku.christian75876.workers.dev` |
| `VITE_VAPID_PUBLIC_KEY` | la pública del backend (no la privada) |

Cada cambio requiere un rebuild (push a `main` o "Retry deployment" en el dashboard).

`ALLOWED_ORIGINS` en el `.env` del backend debe incluir siempre el origen exacto del
frontend activo (con `https://`, sin slash final) — el CORS en
[src/main.ts](src/main.ts) usa `credentials: true`, así que no acepta `*`.

## 9. Pendientes conocidos

- **Backups de Postgres**: el volumen `pgdata` vive solo en el disco del servidor. Sin
  backup automático — si el servidor se pierde, se pierde la base de datos. Pendiente:
  `pg_dump` programado hacia un Hetzner Storage Box o similar.
- **CI/CD**: el deploy es manual (`git pull` + `docker compose up -d --build` +
  migraciones). Automatizar si el flujo se vuelve frecuente.
- **`railway.toml`**: sigue en el repo del despliegue anterior en Railway. Bórralo
  cuando confirmes que Hetzner es el entorno definitivo.
- **`SENTRY_DSN` / `TURNSTILE_SECRET_KEY`**: vacíos — agregar cuando se configuren esos
  servicios (monitoreo de errores y captcha en login/registro).
