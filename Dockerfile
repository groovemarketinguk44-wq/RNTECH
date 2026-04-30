FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data /app/uploads/images /app/uploads/videos

ENV DATA_DIR=/app/data
ENV UPLOAD_DIR=/app/uploads
ENV FRONTEND_DIR=/app/frontend

EXPOSE 8000

CMD ["sh", "-c", "python seed.py && uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
