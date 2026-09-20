from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    aluno = "aluno"
    professor = "professor"
    coacessi = "coacessi"
    admin = "admin"


class RoomStatus(str, Enum):
    ativo = "ativo"
    inativo = "inativo"
    manutencao = "manutencao"


class AlertStatus(str, Enum):
    novo = "novo"
    em_analise = "em_analise"
    em_andamento = "em_andamento"
    resolvido = "resolvido"


class NotificationType(str, Enum):
    alerta = "alerta"
    info = "info"
    sucesso = "sucesso"


class ResolutionResult(str, Enum):
    confirmado = "confirmado"
    falso_alarme = "falso_alarme"


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    senha: str = Field(min_length=1)


class NeurodivergentRegistration(BaseModel):
    condicao: str = Field(min_length=1)
    descricao: str = Field(min_length=1)
    necessidades: str = Field(min_length=1)
    contato_emergencia: str = Field(min_length=1)


class AssistanceRequest(BaseModel):
    sala: str = Field(min_length=1)
    tipo: str = Field(min_length=1)
    descricao: str = Field(min_length=1)


class AlertResolution(BaseModel):
    resultado: ResolutionResult
    observacao: str = ""


class AlertStatusUpdate(BaseModel):
    status: AlertStatus


class RoomCreate(BaseModel):
    nome: str = Field(min_length=1)
    bloco: Optional[str] = None
    capacidade: int = Field(default=40, ge=1, le=500)
    camera_url: Optional[str] = None
    status: RoomStatus = RoomStatus.ativo
    descricao: Optional[str] = None


class RoomUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1)
    bloco: Optional[str] = None
    capacidade: Optional[int] = Field(default=None, ge=1, le=500)
    camera_url: Optional[str] = None
    status: Optional[RoomStatus] = None
    descricao: Optional[str] = None
