FROM python:3.12-slim

WORKDIR /app

# libgl1/libglib2.0-0/libegl1/libgles2: exigidos pelo opencv-contrib-python
# e pelo runtime do mediapipe (libEGL.so.1, libGLESv2.so.2) mesmo rodando só
# em CPU, sem GUI — sem eles o PoseLandmarker falha ao iniciar.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 libegl1 libgles2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --timeout/--retries: o torch (~200MB) estoura o timeout padrão do pip (15s)
# em redes mais lentas/instáveis, derrubando o build no meio do download.
RUN pip install --no-cache-dir --timeout=180 --retries=5 -r requirements.txt

COPY src ./src

ENV STUDENTCARE_DATABASE=/app/data/studentcare.db
VOLUME ["/app/data"]

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
