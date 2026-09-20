FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY database/ ./database/
COPY frontend/ ./frontend/
COPY security/ ./security/
COPY scripts/ ./scripts/
COPY core.c ./
COPY README.md ./

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "backend.server:app"]
