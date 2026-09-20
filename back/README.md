# StudentCare — Backend

API REST do StudentCare feita com FastAPI e SQLite. Para rodar tudo (front +
back) com um único comando, veja `../README.md` (seção 10, Docker).

## Executar no Linux/macOS (sem Docker)

No diretório `back`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## Executar no Windows

No diretório `back`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Se o PowerShell bloquear a ativação do ambiente virtual:

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000
```

A documentação interativa ficará disponível em `http://localhost:8000/docs`.

O banco SQLite é criado automaticamente em `back/data/studentcare.db`.

## Usuários de demonstração

Todos usam a senha `123456`:

- `aluno@teste.com` — aluno
- `professor@teste.com` — professor
- `coacessi@teste.com` — coacessi
- `admin@teste.com` — administrador de TI

## Ligar o Next.js à API

O frontend usa o mock por padrão. Para usar esta API, crie `front/.env.local` com:

```env
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Depois reinicie o servidor do frontend.

## Endpoints implementados

- `POST /api/auth/login`
- `GET/POST /api/aluno/perfil` e `/api/aluno/cadastro-neurodivergente`
- `GET /api/professor/camera/{sala_id}`
- `POST /api/professor/chamar-auxilio`
- `POST /api/deteccao/iniciar`, `POST /api/deteccao/parar[?sala_id=]`, `GET /api/deteccao/status[?sala_id=]`
- `GET/PUT/PATCH /api/coacessi/alertas`
- `PUT /api/coacessi/alertas/{alerta_id}/iniciar`
- `GET /api/coacessi/estatisticas`
- `GET/PUT /api/notificacoes`
- `GET/POST/PUT/DELETE /api/admin/salas`

A autorização é feita por Bearer token JWT e as rotas verificam o papel do usuário no backend.

## Detecção de ações via esqueleto (`src/control`)

Módulo que lê uma câmera, um arquivo `.mp4` já existente ou uma câmera IP,
extrai só o **esqueleto** com MediaPipe Pose (nunca vídeo bruto) e roda um
GRU treinado no MMASD+ numa janela deslizante de 179 frames (~9s a 20fps).

O checkpoint (`src/control/gru_mmasd.pt`) e o modelo de pose do MediaPipe
(`src/model/pose_landmarker_lite.task`) já ficam versionados no repositório —
não é preciso baixar nada à parte, só `pip install -r requirements.txt` (já
inclui torch/mediapipe CPU-only) ou `docker compose up` (ver `../README.md`
na raiz do projeto).

### As 3 fontes e como elas se relacionam com as salas

`fonte` no `POST /iniciar` é um destes três valores, e cada um se comporta
diferente em relação às salas:

- **`webcam`**: usa a webcam física ligada no servidor (`indice_camera`,
  padrão `0`). É um **canal único global**: só existe uma webcam física, então
  enquanto ela estiver rodando, **toda sala** que consultar `GET /status`
  (com qualquer `sala_id`, ou nenhum) recebe a mesma imagem/previsão.
- **`arquivo`**: roda sobre um `.mp4` já existente no disco do servidor
  (`caminho_arquivo`, caminho absoluto — não é upload). Mesmo comportamento de
  canal único global que a webcam (é o "vídeo de teste", serve pra simular
  uma câmera sem precisar de uma de verdade).
- **`camera_ip`**: usa o campo `camera_url` já cadastrado da própria sala
  (`POST/PUT /api/admin/salas`, mesmo endpoint que já existia). Cada sala com
  `camera_url` tem seu **canal independente** — dá pra rodar detecção de
  várias salas com câmera IP ao mesmo tempo, cada uma vendo só a sua própria
  câmera. Erro 400 se a sala não tiver `camera_url` cadastrada.

`POST /parar` e `GET /status` aceitam `?sala_id=` opcional: se a sala tiver um
canal `camera_ip` próprio rodando, ele tem prioridade; senão cai no canal
global (`webcam`/`arquivo`); sem nenhum dos dois rodando, mostra o último
estado conhecido (ou ocioso).

### Uso

Com o servidor rodando (`uvicorn src.main:app --port 8000`) e autenticado como
`professor` ou `admin`:

```bash
# webcam (canal global — toda sala vai mostrar essa mesma detecção)
curl -X POST localhost:8000/api/deteccao/iniciar -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sala_id":"sala-101","fonte":"webcam","indice_camera":0}'

# arquivo mp4 já existente no disco do servidor (também canal global)
curl -X POST localhost:8000/api/deteccao/iniciar -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sala_id":"sala-101","fonte":"arquivo","caminho_arquivo":"/caminho/para/clipe.mp4"}'

# câmera IP da própria sala (canal independente; precisa ter camera_url cadastrado antes)
curl -X POST localhost:8000/api/deteccao/iniciar -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sala_id":"sala-102","fonte":"camera_ip"}'

curl "localhost:8000/api/deteccao/status?sala_id=sala-101" -H "Authorization: Bearer $TOKEN"
curl -X POST "localhost:8000/api/deteccao/parar?sala_id=sala-101" -H "Authorization: Bearer $TOKEN"
```

`GET /status` devolve `acao_prevista`, `confianca`, o `esqueleto` (25 pontos
2D, para uma interface desenhar por cima, nunca a imagem), `buffer_frames`
(0 a 179, enche antes da primeira previsão), `erro` (motivo se a fonte falhar
ao abrir) e `gatilho_automatico_ativo`. Teste manual de carregamento do
modelo (sem câmera): `python src/control/testar.py`.

### Limitações — leia antes de usar

- **Não é diagnóstico.** O modelo classifica 11 **posturas de terapia** do
  dataset MMASD+ (Arm_Swing, Body_pose, chest_expansion, Frog_Pose, Drumming,
  Marcas_Forward, Marcas_Shaking, Sing_Clap, Squat_Pose, Tree_Pose,
  Twist_Pose) — ele **não detecta crise, agitação ou emoção**. Acurácia
  ~70% em crianças não vistas no treino (ver `src/control/metricas.json`).
- Treinado com 32 crianças em terapia; pode não generalizar para outros
  contextos (sala de aula comum, adultos, outras câmeras/ângulos).
- O **botão manual do professor** (`/api/professor/chamar-auxilio`) é o
  mecanismo principal de alerta e não depende deste módulo.
- O gatilho automático (`GATILHO_AUTOMATICO_ATIVO`) vem **desligado por
  padrão**. Se ligado (`=true`), ele dispara um alerta sozinho — sem o
  professor clicar em nada — sempre que a confiança de **qualquer uma das
  11 posturas de terapia** passar de `GATILHO_CONFIANCA_MINIMA` (padrão
  `0.7`), respeitando um `GATILHO_COOLDOWN_SEGUNDOS` (padrão `60`) pra não
  criar um alerta a cada frame. **Isso não é detecção de crise**: o alerta
  gerado registra a ação e a confiança reais (ex.: "Ação detectada
  automaticamente: Arm_Swing (84% de confiança)") — vai disparar toda vez
  que alguém fizer um desses exercícios, não só numa crise real. Ligar isso
  foi uma decisão explícita de quem está rodando este deploy, ciente da
  limitação (ver `src/control/deteccao.py::avaliar_gatilho_automatico`); o
  **botão manual do professor continua sendo o mecanismo mais confiável**.
- A reamostragem de vídeo para ~20fps usa passo fixo (vizinho mais próximo),
  não interpolação.
- Verificado neste projeto: carregamento do checkpoint e inferência (CPU) com
  janela sintética e via `testar.py`; abertura de webcam e de arquivo `.mp4`
  pelo `ServicoCaptura`; janela deslizante enchendo e liberando previsão;
  parada ao fim do arquivo; erros de fonte inválida reportados em
  `erro` no status. **Não verificado**: acurácia com um clipe real do
  MMASD+ (nenhum CSV de exemplo do dataset estava disponível neste
  ambiente) nem com uma câmera física captando uma pessoa real (o ambiente
  de desenvolvimento usado não tinha uma webcam física conectada).
