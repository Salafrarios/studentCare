FROM python:3.12-slim

WORKDIR /app

# libgl1/libglib2.0-0: exigidos pelo opencv-contrib-python (dependência do
# mediapipe) mesmo sem abrir janela.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src

ENV STUDENTCARE_DATABASE=/app/data/studentcare.db
VOLUME ["/app/data"]

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
