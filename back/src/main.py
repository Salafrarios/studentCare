import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Path, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .database import get_connection, init_database
from .schemas import (
    AlertResolution,
    AlertStatus,
    AlertStatusUpdate,
    AssistanceRequest,
    LoginRequest,
    NeurodivergentRegistration,
    NotificationType,
    ResolutionResult,
    Role,
    RoomCreate,
    RoomStatus,
    RoomUpdate,
)
from .security import create_access_token, decode_access_token, verify_password


app = FastAPI(
    title="StudentCare API",
    description="API de apoio e monitoramento assistivo do StudentCare.",
    version="1.1.0",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


@app.on_event("startup")
def startup() -> None:
    init_database()


@app.get("/health", tags=["health"])
def health() -> Dict[str, str]:
    return {"status": "ok"}


# ==================== Helpers ====================


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sem usuário.")

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, nome, email, role FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return dict(user)


def require_roles(*roles: Role):
    allowed = {role.value for role in roles}

    def dependency(user: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
        if user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este recurso.",
            )
        return user

    return dependency


def get_room_or_404(connection: sqlite3.Connection, room_id: str) -> sqlite3.Row:
    room = connection.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    if room is None:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    return room


def room_response(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "nome": row["nome"],
        "bloco": row["bloco"],
        "capacidade": row["capacidade"],
        "camera_url": row["camera_url"],
        "status": row["status"],
        "descricao": row["descricao"],
    }


def fetch_alert(connection: sqlite3.Connection, alert_id: str) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT
            a.*,
            r.nome AS sala_nome,
            u.nome AS aluno_nome,
            p.condicao AS aluno_condicao,
            p.contato_emergencia
        FROM alerts a
        LEFT JOIN rooms r ON r.id = a.sala_id
        LEFT JOIN users u ON u.id = a.aluno_user_id
        LEFT JOIN student_profiles p ON p.user_id = a.aluno_user_id
        WHERE a.id = ?
        """,
        (alert_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado.")
    return row


def alert_response(row: sqlite3.Row) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "sala": row["sala_nome"] or row["sala_id"] or "Sala não informada",
        "tipo_crise": row["tipo_crise"],
        "status": row["status"],
        "confianca": row["confianca"],
    }
    if row["aluno_nome"]:
        result["aluno_info"] = {
            "nome": row["aluno_nome"],
            "condicao": row["aluno_condicao"] or "Não informado",
            "contato_emergencia": row["contato_emergencia"] or "Não informado",
        }
    if row["snapshot_url"]:
        result["snapshot_url"] = row["snapshot_url"]
    return result


def add_notification(
    connection: sqlite3.Connection,
    message: str,
    notification_type: NotificationType,
    user_id: Optional[str] = None,
) -> None:
    connection.execute(
        """
        INSERT INTO notifications (id, mensagem, tipo, timestamp, lida, user_id)
        VALUES (?, ?, ?, ?, 0, ?)
        """,
        (
            f"notif-{uuid.uuid4().hex[:12]}",
            message,
            notification_type.value,
            utc_now(),
            user_id,
        ),
    )


# ==================== Auth ====================


@app.post("/api/auth/login", tags=["auth"])
def login(payload: LoginRequest) -> Dict[str, Any]:
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, nome, email, role, senha_hash FROM users WHERE email = ? COLLATE NOCASE",
            (payload.email.strip().lower(),),
        ).fetchone()

    if user is None or not verify_password(payload.senha, user["senha_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    return {
        "token": create_access_token(user["id"], user["role"]),
        "user": {
            "id": user["id"],
            "nome": user["nome"],
            "email": user["email"],
            "role": user["role"],
        },
    }


# ==================== Aluno ====================


@app.get("/api/aluno/perfil", tags=["aluno"])
def get_student_profile(
    user: Dict[str, Any] = Depends(require_roles(Role.aluno)),
) -> Dict[str, Any]:
    with get_connection() as connection:
        profile = connection.execute(
            "SELECT * FROM student_profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()

    response: Dict[str, Any] = {
        "id": user["id"],
        "nome": user["nome"],
        "email": user["email"],
    }
    if profile is not None:
        response["cadastro_neurodivergente"] = {
            "condicao": profile["condicao"],
            "descricao": profile["descricao"],
            "necessidades": profile["necessidades"],
            "contato_emergencia": profile["contato_emergencia"],
        }
        response["data_cadastro"] = profile["data_cadastro"]
    return response


@app.post("/api/aluno/cadastro-neurodivergente", tags=["aluno"])
def save_student_profile(
    payload: NeurodivergentRegistration,
    user: Dict[str, Any] = Depends(require_roles(Role.aluno)),
) -> Dict[str, str]:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO student_profiles
                (user_id, condicao, descricao, necessidades, contato_emergencia, data_cadastro)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                condicao = excluded.condicao,
                descricao = excluded.descricao,
                necessidades = excluded.necessidades,
                contato_emergencia = excluded.contato_emergencia,
                data_cadastro = excluded.data_cadastro
            """,
            (
                user["id"],
                payload.condicao.strip(),
                payload.descricao.strip(),
                payload.necessidades.strip(),
                payload.contato_emergencia.strip(),
                utc_now(),
            ),
        )
    return {"message": "Cadastro realizado com sucesso!"}


# ==================== Professor ====================


@app.get("/api/professor/camera/{sala_id}", tags=["professor"])
def get_camera_stream(
    sala_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.professor)),
) -> Dict[str, str]:
    del user
    with get_connection() as connection:
        room = get_room_or_404(connection, sala_id)
    # RTSP não é reproduzido diretamente pelo elemento <video> do navegador.
    stream_url = (
        room["camera_url"]
        if room["camera_url"]
        and room["camera_url"].startswith(("http://", "https://"))
        else ""
    )
    return {"stream_url": stream_url}


@app.post("/api/professor/chamar-auxilio", tags=["professor"])
def request_assistance(
    payload: AssistanceRequest,
    user: Dict[str, Any] = Depends(require_roles(Role.professor)),
) -> Dict[str, str]:
    request_id = f"chamado-{uuid.uuid4().hex[:12]}"
    with get_connection() as connection:
        room = get_room_or_404(connection, payload.sala)
        connection.execute(
            """
            INSERT INTO assistance_requests
                (id, sala_id, tipo, descricao, created_by, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, 'aberto')
            """,
            (
                request_id,
                room["id"],
                payload.tipo.strip(),
                payload.descricao.strip(),
                user["id"],
                utc_now(),
            ),
        )
        alert_id = f"alerta-{uuid.uuid4().hex[:12]}"
        connection.execute(
            """
            INSERT INTO alerts
                (id, timestamp, sala_id, tipo_crise, status, confianca)
            VALUES (?, ?, ?, ?, 'novo', 1.0)
            """,
            (alert_id, utc_now(), room["id"], payload.tipo.strip()),
        )
        add_notification(
            connection,
            f"Novo chamado de auxílio requisitado: {payload.tipo.strip()} na {room['nome']}",
            NotificationType.alerta,
            None,
        )
    return {"message": "Chamado enviado com sucesso!", "chamado_id": request_id}


# ==================== COACESSI ====================


@app.get("/api/coacessi/alertas", tags=["coacessi"])
def list_alerts(
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> List[Dict[str, Any]]:
    del user
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                a.*,
                r.nome AS sala_nome,
                u.nome AS aluno_nome,
                p.condicao AS aluno_condicao,
                p.contato_emergencia
            FROM alerts a
            LEFT JOIN rooms r ON r.id = a.sala_id
            LEFT JOIN users u ON u.id = a.aluno_user_id
            LEFT JOIN student_profiles p ON p.user_id = a.aluno_user_id
            ORDER BY datetime(a.timestamp) DESC
            """
        ).fetchall()
    return [alert_response(row) for row in rows]


@app.get("/api/coacessi/alertas/{alerta_id}", tags=["coacessi"])
def get_alert_details(
    alerta_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> Dict[str, Any]:
    del user
    with get_connection() as connection:
        return alert_response(fetch_alert(connection, alerta_id))


@app.put("/api/coacessi/alertas/{alerta_id}/iniciar", tags=["coacessi"])
def start_alert_service(
    alerta_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> Dict[str, str]:
    del user
    with get_connection() as connection:
        alert = fetch_alert(connection, alerta_id)
        if alert["status"] == AlertStatus.resolvido.value:
            raise HTTPException(status_code=409, detail="Este alerta já foi resolvido.")
        connection.execute(
            """
            UPDATE alerts
            SET status = ?, atendimento_iniciado_at = ?
            WHERE id = ?
            """,
            (AlertStatus.em_andamento.value, utc_now(), alerta_id),
        )
        add_notification(
            connection,
            f"Atendimento iniciado para {alert['tipo_crise']} em {alert['sala_nome'] or alert['sala_id']}",
            NotificationType.info,
            None,
        )
    return {"message": "Atendimento iniciado com sucesso!"}


@app.patch("/api/coacessi/alertas/{alerta_id}/status", tags=["coacessi"])
def update_alert_status(
    payload: AlertStatusUpdate,
    alerta_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> Dict[str, str]:
    del user
    with get_connection() as connection:
        fetch_alert(connection, alerta_id)
        if payload.status == AlertStatus.resolvido:
            raise HTTPException(
                status_code=400,
                detail="Use o endpoint de resolução para concluir um alerta.",
            )
        connection.execute(
            "UPDATE alerts SET status = ? WHERE id = ?",
            (payload.status.value, alerta_id),
        )
    return {"message": "Status atualizado com sucesso!"}


@app.put("/api/coacessi/alertas/{alerta_id}", tags=["coacessi"])
def resolve_alert(
    payload: AlertResolution,
    alerta_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> Dict[str, str]:
    del user
    with get_connection() as connection:
        alert = fetch_alert(connection, alerta_id)
        connection.execute(
            """
            UPDATE alerts
            SET status = ?, resultado = ?, observacao = ?, resolved_at = ?
            WHERE id = ?
            """,
            (
                AlertStatus.resolvido.value,
                payload.resultado.value,
                payload.observacao.strip(),
                utc_now(),
                alert["id"],
            ),
        )
        label = (
            "crise confirmada"
            if payload.resultado == ResolutionResult.confirmado
            else "falso alarme"
        )
        add_notification(
            connection,
            f"Alerta analisado como {label}: {alert['tipo_crise']} em {alert['sala_nome'] or alert['sala_id']}",
            NotificationType.sucesso,
            None,
        )
    return {"message": "Análise salva com sucesso!"}


@app.get("/api/coacessi/estatisticas", tags=["coacessi"])
def alert_statistics(
    user: Dict[str, Any] = Depends(require_roles(Role.coacessi)),
) -> Dict[str, int]:
    del user
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN resultado = 'falso_alarme' THEN 1 ELSE 0 END) AS falsos,
                SUM(CASE WHEN resultado = 'confirmado' THEN 1 ELSE 0 END) AS confirmados,
                SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) AS analise,
                SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) AS andamento
            FROM alerts
            WHERE date(timestamp) = date('now', 'localtime')
            """
        ).fetchone()
    return {
        "total_alertas_hoje": row["total"] or 0,
        "falsos_alarmes": row["falsos"] or 0,
        "crises_confirmadas": row["confirmados"] or 0,
        "em_analise": row["analise"] or 0,
        "em_andamento": row["andamento"] or 0,
    }


# ==================== Notifications ====================


@app.get("/api/notificacoes", tags=["notificacoes"])
def list_notifications(
    user: Dict[str, Any] = Depends(require_user),
) -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, mensagem, tipo, timestamp, lida
            FROM notifications
            WHERE user_id IS NULL OR user_id = ?
            ORDER BY datetime(timestamp) DESC
            """,
            (user["id"],),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "mensagem": row["mensagem"],
            "tipo": row["tipo"],
            "timestamp": row["timestamp"],
            "lida": bool(row["lida"]),
        }
        for row in rows
    ]


@app.put("/api/notificacoes/{notification_id}/lida", tags=["notificacoes"])
def mark_notification_read(
    notification_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_user),
) -> Dict[str, str]:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET lida = 1
            WHERE id = ? AND (user_id IS NULL OR user_id = ?)
            """,
            (notification_id, user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notificação não encontrada.")
    return {"message": "Notificação marcada como lida"}


# ==================== Admin / rooms ====================


@app.get("/api/admin/salas", tags=["salas"])
def list_rooms(
    user: Dict[str, Any] = Depends(require_roles(Role.admin, Role.professor)),
) -> List[Dict[str, Any]]:
    del user
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM rooms ORDER BY nome").fetchall()
    return [room_response(row) for row in rows]


@app.post("/api/admin/salas", tags=["salas"])
def create_room(
    payload: RoomCreate,
    user: Dict[str, Any] = Depends(require_roles(Role.admin)),
) -> Dict[str, Any]:
    del user
    room_id = f"sala-{uuid.uuid4().hex[:8]}"
    camera_url = payload.camera_url or f"rtsp://camera.universidade.edu.br/stream/{room_id}"
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO rooms
                (id, nome, bloco, capacidade, camera_url, status, descricao, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room_id,
                payload.nome.strip(),
                payload.bloco,
                payload.capacidade,
                camera_url,
                payload.status.value,
                payload.descricao,
                utc_now(),
            ),
        )
        room = connection.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    return {"message": "Sala cadastrada com sucesso!", "sala": room_response(room)}


@app.put("/api/admin/salas/{room_id}", tags=["salas"])
def update_room(
    payload: RoomUpdate,
    room_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.admin)),
) -> Dict[str, Any]:
    del user
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    assignments: List[str] = []
    values: List[Any] = []
    for field, value in fields.items():
        assignments.append(f"{field} = ?")
        values.append(value.value if isinstance(value, RoomStatus) else value)
    values.append(room_id)

    with get_connection() as connection:
        get_room_or_404(connection, room_id)
        connection.execute(
            f"UPDATE rooms SET {', '.join(assignments)} WHERE id = ?", values
        )
        room = connection.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
    return {"message": "Sala atualizada com sucesso!", "sala": room_response(room)}


@app.delete("/api/admin/salas/{room_id}", tags=["salas"])
def delete_room(
    room_id: str = Path(..., min_length=1),
    user: Dict[str, Any] = Depends(require_roles(Role.admin)),
) -> Dict[str, str]:
    del user
    with get_connection() as connection:
        get_room_or_404(connection, room_id)
        connection.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    return {"message": "Sala removida com sucesso!"}
