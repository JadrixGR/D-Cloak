# NovaShield

Panel web futurista para gestionar perfiles de navegador aislados, proxies y
sesiones con autenticación por roles. El frontend de Lovable (TanStack Start)
se integra con una API FastAPI y PostgreSQL en un único despliegue de Render.

> NovaShield es un control plane para privacidad, QA y separación operativa.
> No incluye suplantación de huellas ni mecanismos destinados a eludir controles
> antifraude o de acceso de terceros.

## Capacidades

- Roles `admin` y `user`, contraseñas Argon2 y JWT con expiración.
- Perfiles y proxies aislados por propietario; el administrador puede auditar todo.
- IP compartida del servidor o proxy HTTP/SOCKS5/SSH por perfil.
- Cookies y `localStorage` cifrados por perfil en una bóveda independiente.
- Credenciales de proxy cifradas y nunca devueltas por la API.
- Protección SSRF en las pruebas de proxy: las redes privadas se bloquean por defecto.
- Auditoría, estadísticas, límites de concurrencia y migraciones Alembic.
- Imagen Docker multi-stage y Blueprint `render.yaml` con PostgreSQL.
- Chromium remoto interactivo en una pestaña web, con Context persistente por perfil.

## Navegador remoto

Configura estas variables privadas en Render para activar Browserbase:

```env
BROWSER_PROVIDER=browserbase
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
BROWSERBASE_REGION=us-east-1
BROWSER_SESSION_TIMEOUT_SECONDS=3600
```

Al pulsar **Abrir perfil**, la API crea un Chromium real y devuelve su vista interactiva. Al
pausarlo, el Context remoto conserva cookies, IndexedDB, `localStorage` y demás datos de sesión.
Los proxies HTTP probados se aplican de forma individual; sin proxy se usa la salida de red del
proveedor de navegador.

## Desarrollo local

### Frontend

El modo local conserva los datos simulados de Lovable si no se define la URL:

```bash
bun install
bun run dev
```

Para usar la API local, define `VITE_API_BASE_URL=http://localhost:8000/api`.

### Backend

```bash
cd backend
python -m venv .venv
# Activa el entorno virtual y luego:
pip install -r requirements-dev.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Antes de iniciar, cambia `JWT_SECRET`, `PROFILE_DATA_KEY` y
`ADMIN_INITIAL_PASSWORD`. La documentación OpenAPI queda en `/api/docs`.

## Pruebas

```bash
cd backend
pytest
```

```bash
bun run lint
bun run build
```

## Despliegue en Render

1. Conecta este repositorio en **New > Blueprint**.
2. Render leerá `render.yaml` y creará el servicio Docker y PostgreSQL.
3. Completa los secretos solicitados: `ADMIN_INITIAL_PASSWORD` y
   `DEFAULT_SERVER_IP`.
4. Despliega. El contenedor ejecuta las migraciones y sirve frontend + API bajo
   el mismo dominio, por lo que no hace falta configurar CORS en producción.

Render vuelve a desplegar automáticamente con cada commit en la rama conectada.

## Seguridad operativa

- Rota `ADMIN_INITIAL_PASSWORD` después del primer acceso y no lo confirmes en Git.
- Usa un `PROFILE_DATA_KEY` estable; cambiarlo invalida las bóvedas ya cifradas.
- Mantén `ALLOW_PRIVATE_PROXIES=false` salvo en una red controlada.
- El estado `running` representa una sesión lógica. Un worker de navegador real,
  si se añade, debe consumir la bóveda por un canal privado y ejecutar cada perfil
  en un sandbox independiente.
