import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Generator

from .security import hash_password


BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE = BACKEND_DIR / "data" / "studentcare.db"
DATABASE_PATH = Path(os.getenv("STUDENTCARE_DATABASE", str(DEFAULT_DATABASE)))


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _utc_iso(minutes_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def _migrate_alerts_table(connection: sqlite3.Connection) -> None:
    table = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'alerts'"
    ).fetchone()
    table_sql = (table[0] if table else "") or ""
    if "em_andamento" in table_sql:
        return

    # SQLite não permite alterar diretamente uma constraint CHECK. Recriamos
    # somente esta tabela para aceitar o novo status do fluxo de atendimento.
    connection.execute("DROP INDEX IF EXISTS idx_alerts_timestamp")
    connection.execute("ALTER TABLE alerts RENAME TO alerts_legacy")
    connection.execute(
        """
        CREATE TABLE alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sala_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
            tipo_crise TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'novo'
                CHECK (status IN ('novo', 'em_analise', 'em_andamento', 'resolvido')),
            confianca REAL NOT NULL DEFAULT 0,
            aluno_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            snapshot_url TEXT,
            resultado TEXT CHECK (resultado IN ('confirmado', 'falso_alarme')),
            observacao TEXT,
            resolved_at TEXT,
            atendimento_iniciado_at TEXT
        )
        """
    )
    connection.execute(
        """
        INSERT INTO alerts
            (id, timestamp, sala_id, tipo_crise, status, confianca,
             aluno_user_id, snapshot_url, resultado, observacao, resolved_at)
        SELECT
            id, timestamp, sala_id, tipo_crise, status, confianca,
            aluno_user_id, snapshot_url, resultado, observacao, resolved_at
        FROM alerts_legacy
        """
    )
    connection.execute("DROP TABLE alerts_legacy")
    connection.execute("CREATE INDEX idx_alerts_timestamp ON alerts(timestamp)")


def _ensure_demo_alert_updates(connection: sqlite3.Connection) -> None:
    """Atualiza o banco local antigo para o cenário usado pelo frontend atual."""
    demo_user = connection.execute(
        "SELECT id FROM users WHERE email = ?", ("aluno@teste.com",)
    ).fetchone()
    if demo_user is None:
        return

    now = _utc_iso()
    connection.execute(
        """
        INSERT OR IGNORE INTO users (id, nome, email, senha_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-006",
            "Pedro Santos",
            "pedro@teste.com",
            hash_password("123456"),
            "aluno",
            now,
        ),
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO student_profiles
            (user_id, condicao, descricao, necessidades, contato_emergencia, data_cadastro)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "usr-006",
            "TEA",
            "Sensibilidade a estímulos intensos.",
            "Comunicação objetiva e ambiente calmo.",
            "(81) 98765-4321",
            now,
        ),
    )

    connection.execute(
        """
        UPDATE alerts
        SET timestamp = ?, sala_id = ?, tipo_crise = ?, status = ?, confianca = ?,
            aluno_user_id = ?, resultado = NULL, resolved_at = NULL
        WHERE id = 'alerta-003'
        """,
        ( _utc_iso(25), "sala-103", "Meltdown", "em_andamento", 0.88, "usr-006"),
    )
    connection.execute(
        """
        UPDATE alerts
        SET timestamp = ?, sala_id = ?, tipo_crise = ?, status = ?, confianca = ?,
            aluno_user_id = NULL, resultado = NULL, resolved_at = NULL
        WHERE id = 'alerta-004'
        """,
        (_utc_iso(45), "sala-202", "Crise de Pânico", "novo", 0.85),
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO alerts
            (id, timestamp, sala_id, tipo_crise, status, confianca, resultado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "alerta-005",
            _utc_iso(120),
            "auditorio",
            "Meltdown",
            "resolvido",
            0.41,
            "falso_alarme",
        ),
    )


def init_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                senha_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('aluno', 'professor', 'coacessi', 'admin')),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS student_profiles (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                condicao TEXT NOT NULL,
                descricao TEXT NOT NULL,
                necessidades TEXT NOT NULL,
                contato_emergencia TEXT NOT NULL,
                data_cadastro TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                bloco TEXT,
                capacidade INTEGER NOT NULL DEFAULT 40,
                camera_url TEXT,
                status TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo', 'inativo', 'manutencao')),
                descricao TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                sala_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
                tipo_crise TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'novo'
                    CHECK (status IN ('novo', 'em_analise', 'em_andamento', 'resolvido')),
                confianca REAL NOT NULL DEFAULT 0,
                aluno_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                snapshot_url TEXT,
                resultado TEXT CHECK (resultado IN ('confirmado', 'falso_alarme')),
                observacao TEXT,
                resolved_at TEXT,
                atendimento_iniciado_at TEXT
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                mensagem TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('alerta', 'info', 'sucesso')),
                timestamp TEXT NOT NULL,
                lida INTEGER NOT NULL DEFAULT 0,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS assistance_requests (
                id TEXT PRIMARY KEY,
                sala_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
                tipo TEXT NOT NULL,
                descricao TEXT NOT NULL,
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                timestamp TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'aberto'
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, lida);
            """
        )

        _migrate_alerts_table(connection)

        if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
            _ensure_demo_alert_updates(connection)
            return

        now = _utc_iso()
        users = [
            ("usr-001", "Wilian de Lima Santos", "aluno@teste.com", "aluno"),
            ("usr-002", "Prof. João da Silva", "professor@teste.com", "professor"),
            ("usr-003", "Carla Rodrigues", "coacessi@teste.com", "coacessi"),
            ("usr-004", "Carlos Eduardo (TI)", "admin@teste.com", "admin"),
            ("usr-005", "João Oliveira", "joao@teste.com", "aluno"),
            ("usr-006", "Pedro Santos", "pedro@teste.com", "aluno"),
        ]
        connection.executemany(
            "INSERT INTO users (id, nome, email, senha_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (user_id, nome, email, hash_password("123456"), role, now)
                for user_id, nome, email, role in users
            ],
        )

        profiles = [
            (
                "usr-001",
                "TEA",
                "Sensibilidade sensorial em ambientes muito movimentados.",
                "Lugar calmo e pausas frequentes.",
                "(81) 99999-1234",
                now,
            ),
            (
                "usr-005",
                "Ansiedade Generalizada",
                "Pode precisar de apoio em situações de estresse intenso.",
                "Comunicação tranquila e tempo para reorganização.",
                "(81) 98888-5678",
                now,
            ),
            (
                "usr-006",
                "TEA",
                "Sensibilidade a estímulos intensos.",
                "Comunicação objetiva e ambiente calmo.",
                "(81) 98765-4321",
                now,
            ),
        ]
        connection.executemany(
            """
            INSERT INTO student_profiles
                (user_id, condicao, descricao, necessidades, contato_emergencia, data_cadastro)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            profiles,
        )

        rooms = [
            ("sala-101", "Sala 101", "Bloco A - Térreo", 45, "rtsp://camera.universidade.edu.br/stream/sala-101", "ativo", "Equipada com câmera PTZ de alta resolução e microfone direcional."),
            ("sala-102", "Sala 102", "Bloco A - 1º Andar", 50, "rtsp://camera.universidade.edu.br/stream/sala-102", "ativo", "Sala de aula padrão para turmas de ciclo básico."),
            ("sala-103", "Sala 103", "Bloco A - 1º Andar", 40, "rtsp://camera.universidade.edu.br/stream/sala-103", "ativo", "Sala com isolamento acústico."),
            ("sala-201", "Sala 201", "Bloco B - 2º Andar", 60, "rtsp://camera.universidade.edu.br/stream/sala-201", "manutencao", "Câmera em calibração pelo setor de TI."),
            ("sala-202", "Sala 202", "Bloco B - 2º Andar", 55, "rtsp://camera.universidade.edu.br/stream/sala-202", "ativo", "Sala ampla com ventilação natural."),
            ("lab-info-1", "Lab. Informática 1", "Prédio de Tecnologia - 2º Andar", 35, "rtsp://camera.universidade.edu.br/stream/lab-info-1", "ativo", "Laboratório com 35 estações de trabalho e câmera de ângulo aberto."),
            ("lab-info-2", "Lab. Informática 2", "Prédio de Tecnologia - 2º Andar", 35, "rtsp://camera.universidade.edu.br/stream/lab-info-2", "ativo", "Laboratório voltado a disciplinas de computação gráfica."),
            ("auditorio", "Auditório Central", "Centro de Convenções", 220, "rtsp://camera.universidade.edu.br/stream/auditorio", "ativo", "Auditório principal com duas câmeras interconectadas."),
        ]
        connection.executemany(
            """
            INSERT INTO rooms
                (id, nome, bloco, capacidade, camera_url, status, descricao, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [room + (now,) for room in rooms],
        )

        alerts = [
            ("alerta-001", _utc_iso(5), "sala-101", "Meltdown", "novo", 0.92, "usr-001", None, None),
            ("alerta-002", _utc_iso(18), "lab-info-1", "Crise de Ansiedade", "em_analise", 0.78, "usr-005", None, None),
            ("alerta-003", _utc_iso(25), "sala-103", "Meltdown", "em_andamento", 0.88, "usr-006", None, None),
            ("alerta-004", _utc_iso(45), "sala-202", "Crise de Pânico", "novo", 0.85, None, None, None),
            ("alerta-005", _utc_iso(120), "auditorio", "Meltdown", "resolvido", 0.41, None, None, "falso_alarme"),
        ]
        connection.executemany(
            """
            INSERT INTO alerts
                (id, timestamp, sala_id, tipo_crise, status, confianca, aluno_user_id, snapshot_url, resultado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            alerts,
        )

        notifications = [
            ("notif-001", "Novo alerta detectado na Sala 101 — possível meltdown", "alerta", _utc_iso(5), 0, "usr-003"),
            ("notif-002", "Crise de ansiedade detectada no Lab. Informática 1", "alerta", _utc_iso(18), 0, "usr-003"),
            ("notif-003", "Chamado de auxílio enviado com sucesso para a Sala 103", "sucesso", _utc_iso(60), 1, "usr-002"),
        ]
        connection.executemany(
            "INSERT INTO notifications (id, mensagem, tipo, timestamp, lida, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            notifications,
        )
