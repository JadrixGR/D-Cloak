# Contrato de API — backend Python (FastAPI / Render)

El frontend consume un único módulo (`src/lib/api/index.ts`). En desarrollo, sin
`VITE_API_BASE_URL`, usa un simulador en memoria; la imagen de producción usa
`/api` bajo el mismo dominio. Todas las respuestas son JSON y las rutas privadas esperan
`Authorization: Bearer <jwt>`.

## Autenticación

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/api/auth/me` | — | `User` |
| POST | `/api/auth/password` | `{ current_password, new_password }` | `204` |

El JWT debe incluir `sub` (id de usuario) y `role` (`admin` \| `user`).
Un `401` provoca cierre de sesión automático en el cliente.

## Modelos

```jsonc
// User
{ "id": "u_1", "email": "a@b.io", "name": "Nova", "role": "admin",
  "status": "active", "created_at": "ISO", "last_login_at": "ISO|null" }

// Profile
{ "id": "pf_1", "name": "Alpha", "status": "running|paused|stopped|error",
  "os": "Windows 11|macOS 14|Linux|Android 14", "fingerprint": "texto",
  "timezone": "America/Lima", "locale": "es-PE",
  "use_default_ip": true, "proxy_id": "px_1|null", "effective_ip": "1.2.3.4",
  "owner_id": "u_1", "owner_name": "Nova",
  "last_session_at": "ISO|null", "sessions_today": 3, "created_at": "ISO" }

// Proxy
{ "id": "px_1", "label": "Residencial US", "type": "http|socks5|ssh",
  "host": "node.net", "port": 9050, "username": "u|null", "country": "US",
  "latency_ms": 84, "detected_ip": "1.2.3.4|null", "last_tested_at": "ISO|null",
  "healthy": true, "profiles_count": 2 }

// ActivityEntry
{ "id": "ac_1", "at": "ISO", "actor_name": "Nova",
  "action": "profile.start|profile.stop|profile.create|profile.delete|profile.update|proxy.test|auth.login|settings.update",
  "target": "Alpha", "detail": "texto", "level": "info|warn|error" }

// PlatformSettings
{ "default_server_ip": "203.0.113.24", "default_timezone": "America/Lima",
  "default_locale": "es-PE", "auto_start_on_create": false,
  "max_concurrent_profiles": 12, "webrtc_protection": true }
```

## Endpoints

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/api/stats/overview` | `{ profiles_total, profiles_running, profiles_paused, sessions_today, proxies_healthy, proxies_total, usage: [{date, sessions, minutes}] }` (7 días) |
| GET | `/api/profiles` | Admin ve todo; usuario estándar solo los suyos |
| POST | `/api/profiles` | `ProfileInput` → `Profile` |
| PATCH | `/api/profiles/{id}` | `ProfileInput` → `Profile` |
| DELETE | `/api/profiles/{id}` | `204` |
| POST | `/api/profiles/{id}/start` | Crea o recupera un Chromium remoto → `{ profile, live_view_url, expires_at }` |
| POST | `/api/profiles/{id}/stop` | Cierra el Chromium y persiste su contexto → `Profile` |
| GET/PUT/DELETE | `/api/profiles/{id}/storage` | Bóveda cifrada de cookies y `localStorage` |
| GET | `/api/proxies` | Pool aislado por propietario; admin ve todo |
| POST | `/api/proxies` | `ProxyInput` → `Proxy` |
| DELETE | `/api/proxies/{id}` | `204` |
| POST | `/api/proxies/{id}/test` | Mide latencia e IP detectada → `Proxy` |
| GET | `/api/activity` | Orden cronológico inverso |
| GET | `/api/users` | Solo admin |
| POST | `/api/users` | Solo admin; entrega `temporary_password` una vez |
| PATCH | `/api/users/{id}` | Solo admin: `{ role?, status? }` |
| GET | `/api/settings` | `PlatformSettings` |
| PUT | `/api/settings` | Solo admin → `PlatformSettings` |

`ProfileInput`: `{ name, os, timezone, locale, use_default_ip, proxy_id }`.
`ProxyInput`: `{ label, type, host, port, username, password, country }`.

## Reglas de negocio en el servidor

1. `use_default_ip: true` fuerza `proxy_id = null` y `effective_ip = default_server_ip`.
2. Al cambiar `default_server_ip` se recalcula la IP efectiva de todos los perfiles que la usan.
3. Los permisos por rol se validan en el backend; el frontend solo oculta la UI.
4. Cada acción relevante genera un `ActivityEntry`.
5. Errores en formato `{ "detail": "mensaje" }` para que el cliente lo muestre tal cual.

## Despliegue en Render

- Blueprint único en `render.yaml`: contenedor Docker + PostgreSQL.
- El contenedor ejecuta Alembic, sirve el frontend y expone FastAPI bajo `/api`.
- Variables: `DATABASE_URL`, `JWT_SECRET`, `PROFILE_DATA_KEY`,
  `ADMIN_INITIAL_PASSWORD`, `DEFAULT_SERVER_IP`.
- Navegador web administrado: `BROWSER_PROVIDER=browserbase`,
  `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `BROWSERBASE_REGION`
  y `BROWSER_SESSION_TIMEOUT_SECONDS` (60-21600).
