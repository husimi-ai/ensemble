# Team-assembly worker (spec T4, task 010). Deployable to Fly.io / Render /
# Cloud Run as a small always-available service.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install deps first so the layer caches across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App sources (flat module dir; imports are `assemble`/`pool`, so keep WORKDIR).
COPY assemble.py pool.py app.py ./

EXPOSE 8080

# 1 worker: solves run occasionally, not per request; bump for concurrency.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "app:app"]
