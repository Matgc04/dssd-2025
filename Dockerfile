# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=/app \
    APP_ENV=production

WORKDIR ${APP_HOME}

RUN pip install --upgrade pip poetry

COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main --no-root

COPY tercera-entrega ./tercera-entrega

EXPOSE 8080

CMD ["sh","-c","exec gunicorn --chdir tercera-entrega --bind 0.0.0.0:${PORT:-8080} main:app"]
