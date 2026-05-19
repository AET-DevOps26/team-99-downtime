# base: shared Python + uv setup.
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# dev
FROM base AS dev
WORKDIR /workspace/apps/genai-service
COPY apps/genai-service/pyproject.toml apps/genai-service/uv.lock ./
RUN uv sync --frozen --no-install-project
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=10 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')"
CMD ["uv", "run", "uvicorn", "src.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

# prod
FROM base AS prod
WORKDIR /app
COPY dist/apps/genai-service /app/artifacts
RUN uv pip install --system /app/artifacts/*.whl && rm -rf /app/artifacts
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
