#!/usr/bin/env bash
# Builda as imagens e sobe a stack no Docker Swarm. Único pré-requisito:
# Docker instalado. Uso: ./deploy-swarm.sh
set -euo pipefail
cd "$(dirname "$0")"

docker swarm init >/dev/null 2>&1 || true  # sem erro se já for um swarm

docker build -t studentcare-back:latest ./back
docker build -t studentcare-front:latest ./front

docker stack deploy -c docker-stack.yml studentcare

cat <<'EOF'

Stack "studentcare" no ar.
  Front: http://localhost:3000
  Back:  http://localhost:8000/docs

OBS: em modo swarm não há acesso à webcam (limitação do Swarm, não deste
projeto) — use a fonte "arquivo" (.mp4) na API de detecção, ou rode com
`docker compose up` na máquina com a câmera para detecção ao vivo.
EOF
