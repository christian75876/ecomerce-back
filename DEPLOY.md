# Despliegue en Hetzner + Cloudflare (DNS-only) + Docker

Guía operativa para llevar este backend a un servidor Hetzner Cloud (2 vCPU / 4GB RAM,
p. ej. CX22) usando el stack de `docker-compose.prod.yml` (Postgres + NestJS + Caddy con
TLS automático), con Cloudflare únicamente como DNS (nube gris, sin proxy).

## 0. Antes de empezar

- No commitees nunca el `.env` real. `.gitignore`/`.dockerignore` ya lo excluyen.
- Genera todos los secretos nuevos para este entorno (no reutilices los de Railway/dev).
- Guarda el `.env` de producción solo en el servidor (permisos `600`) o en un gestor de
  secretos. No lo pegues en chats, tickets ni documentos compartidos.

## 1. Crear el servidor en Hetzner

1. Crea un servidor Cloud (CX22 o equivalente 2 vCPU / 4GB), imagen **Ubuntu 24.04**,
   región cercana a tus usuarios.
2. Agrega tu llave SSH pública al crear el servidor (no uses contraseña).
3. Anota la IP pública — la necesitas para el DNS y el firewall.

### 1.1 Hardening inicial (por SSH, como root la primera vez)

```bash
adduser deploy
usermod -aG sudo deploy
# copia tu authorized_keys a /home/deploy/.ssh/authorized_keys

# Firewall: solo SSH, HTTP y HTTPS
apt update && apt install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Swap (recomendado en 4GB RAM: build de TS + Postgres + Node conviven mejor)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

A partir de aquí, conéctate como `deploy`, no como `root`.

## 2. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
# cierra sesión y vuelve a entrar para que el grupo tome efecto
docker compose version
```

## 3. DNS en Cloudflare (modo DNS-only)

Caddy emite el certificado TLS automáticamente contra Let's Encrypt vía HTTP-01, lo cual
requiere que la petición llegue directo a tu servidor. Por eso el registro debe estar en
**modo "DNS only" (nube gris)**, no proxied (naranja):

1. En Cloudflare → DNS, crea un registro `A` con el subdominio del API
   (p. ej. `api.tudominio.com`) → IP del servidor Hetzner.
2. Verifica que el ícono de la nube esté **gris** (DNS only), no naranja.
3. Espera propagación (`dig api.tudominio.com` debe devolver la IP del servidor).

> Si más adelante quieres activar el proxy naranja de Cloudflare (WAF, caché, ocultar la
> IP), hazlo **después** de que Caddy ya tenga el certificado emitido y funcionando, y
> configura el modo SSL/TLS de Cloudflare en "Full (strict)".

## 4. Clonar el repo y configurar `.env`

```bash
git clone <url-del-repo> merku-backend
cd merku-backend
cp .env.example .env
nano .env
```

Completa en el `.env` real (valores de ejemplo a reemplazar):

| Variable | Cómo generarla |
|---|---|
| `USERNAME_DB` / `DATABASE_PASSWORD` / `DATABASE_NAME` | valores fuertes, propios de este entorno |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | `node -e "console.log(require('bcrypt').hashSync('tu-password', 10))"` — **recuerda escapar cada `$` como `$$`** en este `.env` porque lo usa `docker-compose.prod.yml` vía `env_file` |
| `DOMAIN` | el subdominio del backend, p. ej. `api.merku.co` (mientras `merku.co` no esté aprobado, usa el dominio/subdominio que sí tengas activo) |
| `ALLOWED_ORIGINS` | orígenes del frontend, sin slash final. Hoy: `https://merku.christian75876.workers.dev`. Cuando `merku.co` se apruebe, añade `https://merku.co,https://www.merku.co` (separados por coma, sin espacios) |
| `SMTP_*`, `CLOUDINARY_*`, `BREVO_API_KEY`, `VAPID_*`, `SENTRY_DSN`, `TURNSTILE_SECRET_KEY` | credenciales reales de cada servicio |
| `DB_SSL` | déjalo en `false` — Postgres corre en el mismo docker-compose, no es una DB en la nube |

## 5. Migraciones de base de datos (TypeORM)

Este proyecto corre con `DATABASE_SYNCHRONIZE=false` en producción: el esquema se
gestiona con **migraciones versionadas de TypeORM**, no con sincronización automática.
Se agregó el andamiaje en [src/database/data-source.ts](src/database/data-source.ts) y
los scripts en `package.json` (`migration:generate`, `migration:run`, `migration:run:prod`).

### 5.1 Generar la migración base (una sola vez, pendiente)

Como este entorno de desarrollo no tenía Docker/Postgres disponibles, **la migración
base (`InitialSchema`) todavía no está generada**. Hazlo antes del primer despliegue,
en tu máquina local con Docker o directamente en el servidor:

```bash
# Levanta solo la DB de desarrollo (vacía) y las envs para conectarte a ella
docker compose up -d db
export DATABASE_HOST=localhost PORT_DB=5432 USERNAME_DB=postgres DATABASE_PASSWORD=postgres DATABASE_NAME=postgres

# Genera la migración a partir del estado actual de las entidades
yarn migration:generate src/migrations/InitialSchema

# Revisa el SQL generado antes de commitear
cat src/migrations/*-InitialSchema.ts
```

Commitea el archivo generado en `src/migrations/`. A partir de ahí, cualquier cambio de
entidad se versiona igual: `yarn migration:generate src/migrations/NombreDelCambio`.

> Si vas a **migrar datos existentes** desde Railway (pg_dump/pg_restore) en vez de
> arrancar con una base vacía, no ejecutes la migración base contra esos datos — la
> tabla `migrations` debe marcarse manualmente como si ya se hubiera aplicado, para no
> intentar recrear tablas que ya existen. Avísame si este es el caso y lo resolvemos
> antes de aplicar migraciones en el servidor real.

### 5.2 Aplicar migraciones en el servidor (cada deploy)

Con el stack ya construido pero antes de servir tráfico:

```bash
docker compose -f docker-compose.prod.yml up -d --build db
docker compose -f docker-compose.prod.yml run --rm app npx typeorm migration:run -d dist/database/data-source.js
```

## 6. Levantar el stack completo

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f caddy   # confirma que emitió el certificado TLS
```

Verifica:

```bash
curl -I https://api.tudominio.com/health
```

## 7. Mantenimiento / pendientes conocidos

- **Backups de Postgres**: el volumen `pgdata` vive solo en el disco del servidor. No
  hay backup automático configurado todavía — si el servidor se pierde, se pierde la
  base de datos. Cuando quieras, lo resolvemos con un servicio de `pg_dump` programado
  hacia un Hetzner Storage Box o similar.
- **CI/CD**: el deploy es manual (`git pull` + `docker compose up -d --build` +
  migraciones). Si el flujo se vuelve frecuente, conviene automatizarlo.
- **`railway.toml`**: sigue en el repo del despliegue anterior en Railway. Bórralo
  cuando confirmes que Hetzner es el entorno definitivo.

## 8. Conectar el frontend de Cloudflare Pages

El frontend hoy vive en `https://merku.christian75876.workers.dev` (y en el futuro también
en `https://merku.co` / `https://www.merku.co` cuando se apruebe el dominio). Para que
pueda hablar con el backend:

1. En el `.env` del backend, `ALLOWED_ORIGINS` debe incluir **exactamente** esos orígenes
   (con `https://`, sin slash final, separados por coma). El CORS de
   [src/main.ts](src/main.ts) usa `credentials: true`, así que no acepta `*` — cada
   origen debe estar listado de forma explícita.
2. En el proyecto de Cloudflare Pages (dashboard → tu proyecto → Settings → Environment
   variables), configura la variable que el frontend usa como base URL de la API (su
   nombre depende del framework del frontend, p. ej. `VITE_API_URL` o similar) apuntando
   a `https://api.merku.co` (o el dominio real del backend). Vuelve a desplegar el
   proyecto de Pages para que tome el nuevo valor.
3. Verifica en el navegador (DevTools → Network) que las llamadas del frontend a la API
   no muestren errores de CORS y que las cookies/headers de auth viajen correctamente.
