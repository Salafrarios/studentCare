# StudentCare — Backend

API REST do StudentCare feita com FastAPI e SQLite.

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
- `GET/PUT/PATCH /api/coacessi/alertas`
- `PUT /api/coacessi/alertas/{alerta_id}/iniciar`
- `GET /api/coacessi/estatisticas`
- `GET/PUT /api/notificacoes`
- `GET/POST/PUT/DELETE /api/admin/salas`

A autorização é feita por Bearer token JWT e as rotas verificam o papel do usuário no backend.
