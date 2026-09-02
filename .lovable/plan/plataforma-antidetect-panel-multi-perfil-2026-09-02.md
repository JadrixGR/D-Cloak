# Plataforma Antidetect — Panel Multi-Perfil

Interfaz web futurista (tema oscuro) para gestionar perfiles de navegador antidetect, lista para conectarse a un backend Python en Render vía JWT. En esta primera versión el frontend funciona con datos simulados detrás de una capa de API única, de modo que al existir el backend solo se cambia la URL base.

## Pantallas

- **Login** (`/login`): email + contraseña contra el backend, guarda el JWT, muestra errores claros. Redirige al dashboard.
- **Dashboard** (`/dashboard`): tarjetas de estadísticas (perfiles totales, activos, en pausa, sesiones hoy, proxies sanos), gráfico de uso de los últimos 7 días y actividad reciente.
- **Perfiles** (`/profiles`): tabla/lista densa con nombre, estado, sistema operativo/huella, IP efectiva, proxy asignado, última sesión. Acciones por fila: iniciar, pausar, eliminar (con confirmación). Búsqueda, filtro por estado y creación/edición de perfil en panel lateral, incluyendo elegir "IP del servidor por defecto" o asignar un proxy individual del pool.
- **Proxies** (`/proxies`): pool reutilizable (host, puerto, tipo, país, credenciales), acción de test que muestra latencia e IP detectada, y cuántos perfiles lo usan.
- **Usuarios** (`/admin/users`, solo Administrador): listado de usuarios, rol, estado, alta y cambio de rol.
- **Ajustes** (`/settings`): IP del servidor por defecto, zona horaria/idioma base de la huella, preferencias de arranque; el bloque global solo editable por Administrador.
- **Actividad** (`/activity`): registro cronológico de acciones y sesiones, filtrable por perfil y usuario.

## Roles

- El JWT del backend trae `role` (`admin` | `user`).
- Usuario Estándar: solo sus perfiles, proxies y actividad; sin Usuarios ni ajustes globales.
- Administrador: todo, más gestión de usuarios.
- El guardado real de permisos es responsabilidad del backend; el frontend oculta y bloquea de forma coherente.

## Estética

Tema oscuro profundo con superficies en capas y bordes tenues, acentos neón (cian/violeta) para estados y datos, tipografía técnica de títulos con cuerpo neutro, indicadores de estado luminosos, micro-animaciones al iniciar/pausar y layout totalmente responsive (tabla en desktop, tarjetas en móvil). Definiré 3 direcciones visuales para que elijas antes de construir.

## Detalles técnicos

- TanStack Start + TanStack Query. Rutas protegidas bajo un layout `_authenticated` con guard basado en el token.
- Capa `src/lib/api/` con cliente HTTP (`VITE_API_BASE_URL`), tipos compartidos y adaptadores por recurso; un flag activa el modo mock en memoria mientras el backend no exista.
- Contrato de API que documentaré en `docs/api-contract.md` para implementar en Python/FastAPI:
  - `POST /auth/login`, `GET /auth/me`
  - `GET/POST /profiles`, `PATCH/DELETE /profiles/{id}`, `POST /profiles/{id}/start|stop`
  - `GET/POST /proxies`, `POST /proxies/{id}/test`
  - `GET /stats/overview`, `GET /activity`
  - `GET/POST/PATCH /users`, `GET/PUT /settings`
- Todos los colores como tokens semánticos en `src/styles.css`; sin clases de color fijas en componentes.
- `head()` propio por ruta con título y descripción específicos.

## Fuera de alcance

El backend Python en sí, el motor real de navegadores antidetect y el despliegue en Render. Este trabajo entrega la interfaz completa y el contrato que el backend debe cumplir.
