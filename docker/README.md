# Student Care — serviço de visão computacional

Microserviço FastAPI para receber imagens e executar, opcionalmente, um modelo Ultralytics em GPU NVIDIA.

Esta pasta contém somente os arquivos de implantação. Não é necessário instalar Docker nesta máquina para preparar ou versionar o projeto. Os comandos abaixo devem ser executados no servidor de destino, onde a API será hospedada.

## Estrutura

- `app/main.py`: API FastAPI, health check e endpoint de predição.
- `requirements.txt`: dependências Python.
- `Dockerfile`: imagem com PyTorch CUDA.
- `docker-compose.yml`: execução com volume de desenvolvimento e GPU.
- `models/`: coloque aqui o arquivo do modelo (`.pt`), sem versioná-lo no Git.

## Executar com Docker Compose no servidor de destino

Na pasta `docker/`:

```bash
mkdir -p models
cp .env.example .env
docker compose build
docker compose up -d
```

Para usar um modelo, defina no `.env` um caminho relativo ao container, por exemplo:

```env
MODEL_PATH=models/yolo.pt
```

Depois, reconstrua ou reinicie o serviço:

```bash
docker compose up -d --build
```

A API ficará disponível em `http://localhost:8000`. A documentação interativa está em `http://localhost:8000/docs`.

## Testar

```bash
curl http://localhost:8000/health
curl http://localhost:8000/
curl -X POST http://localhost:8000/predict -F "file=@./imagem.jpg"
```

## Execução sem GPU

A imagem usa PyTorch com CUDA, mas o serviço retorna `CPU` quando nenhuma GPU está disponível. Para executar sem NVIDIA, remova o bloco `deploy.resources.reservations.devices` do `docker-compose.yml` e, se necessário, use uma imagem base CPU adequada.

## Requisitos do host NVIDIA

No servidor, instale Docker e o NVIDIA Container Toolkit. Valide o acesso da GPU antes de subir a API:

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-runtime-ubuntu22.04 nvidia-smi
```

A pasta `app` é montada como volume para permitir alterações durante o hackathon sem novo build. Em produção, remova esse volume e gere uma imagem imutável.
