FROM oven/bun:1.2.22 AS frontend

WORKDIR /frontend
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY components.json tsconfig.json vite.config.ts eslint.config.js ./
COPY public ./public
COPY src ./src
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN bun run build

FROM python:3.13.7-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN addgroup --system novashield && adduser --system --ingroup novashield novashield
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./
COPY --from=frontend /frontend/.output/public ./static
RUN chown -R novashield:novashield /app
USER novashield

EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
