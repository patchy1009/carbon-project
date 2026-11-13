
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ocr.txt .

RUN pip install --no-cache-dir -r requirements-ocr.txt

COPY scripts/ ./scripts/

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "api:app", "--app-dir", "scripts", "--host", "0.0.0.0", "--port", "8000"]
