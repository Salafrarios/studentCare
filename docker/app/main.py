"""Computer vision API used by the Student Care prototype."""

from __future__ import annotations

import io
import os
from contextlib import asynccontextmanager
from typing import Any

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


MODEL_PATH = os.getenv("MODEL_PATH", "")
MODEL: Any = None


def device_name() -> str:
    """Return the active inference device name."""
    if torch.cuda.is_available():
        return torch.cuda.get_device_name(0)
    return "CPU"


def load_model() -> Any:
    """Load an optional Ultralytics model when MODEL_PATH is configured."""
    if not MODEL_PATH:
        return None

    try:
        from ultralytics import YOLO

        model = YOLO(MODEL_PATH)
        model.to("cuda:0" if torch.cuda.is_available() else "cpu")
        return model
    except Exception as exc:  # pragma: no cover - depends on model/runtime files
        raise RuntimeError(f"Não foi possível carregar o modelo '{MODEL_PATH}'.") from exc


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL
    MODEL = load_model()
    yield
    MODEL = None


app = FastAPI(
    title="Student Care - Computer Vision API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/", tags=["health"])
def read_root() -> dict[str, Any]:
    """Return API and accelerator status."""
    return {
        "status": "online",
        "gpu_ativa": torch.cuda.is_available(),
        "dispositivo": device_name(),
        "modelo_carregado": MODEL is not None,
    }


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", tags=["inference"])
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    """Receive an image and optionally run the configured vision model."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Envie um arquivo de imagem.")

    image_bytes = await file.read()
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = image.format or "unknown"
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="O arquivo não é uma imagem válida.") from exc

    predictions: list[dict[str, Any]] = []
    if MODEL is not None:
        results = MODEL(image, verbose=False)
        for result in results:
            for box in result.boxes:
                predictions.append(
                    {
                        "classe": int(box.cls[0]),
                        "confianca": float(box.conf[0]),
                        "caixa": [float(value) for value in box.xyxy[0].tolist()],
                    }
                )

    return {
        "filename": file.filename,
        "formato": image_format,
        "tamanho": {"largura": image.width, "altura": image.height},
        "dispositivo": device_name(),
        "resultado": predictions,
        "modelo_executado": MODEL is not None,
    }
