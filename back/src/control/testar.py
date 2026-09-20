"""Teste manual de inferência do checkpoint gru_mmasd.pt na CPU.

Uso:
    python testar.py                 # janela sintética (só valida shape/carregamento)
    python testar.py caminho.csv     # roda com um clipe real do MMASD+ (179x75, mesmas
                                      # colunas usadas no treino, sem Action_Label/ASD_Label)

Este repositório não tinha um testar.py nem um CSV de exemplo do MMASD+; este
script cobre a tarefa "1) rode testar.py e confirme que o modelo carrega e
roda na CPU". Sem um clipe real do dataset não é possível validar a acurácia
aqui — apenas o carregamento do checkpoint e o formato da inferência.
"""
import sys
from pathlib import Path

import numpy as np

from deteccao import ModeloAcoes

CAMINHO_CHECKPOINT = str(Path(__file__).resolve().parent / "gru_mmasd.pt")


def carregar_janela(caminho_csv: str) -> np.ndarray:
    import pandas as pd

    df = pd.read_csv(caminho_csv)
    df = df.drop(columns=[c for c in ("Action_Label", "ASD_Label") if c in df.columns])
    dados = df.values.astype("float32")
    if dados.shape != (179, 75):
        raise ValueError(f"CSV com shape {dados.shape}, esperado (179, 75).")
    return dados


def main() -> None:
    modelo = ModeloAcoes(CAMINHO_CHECKPOINT)

    if len(sys.argv) > 1:
        janela = carregar_janela(sys.argv[1])
        origem = sys.argv[1]
    else:
        rng = np.random.default_rng(0)
        janela = rng.normal(size=(179, 75)).astype("float32")
        origem = "sintético (aleatório, só para validar shape/execução na CPU)"

    resultado = modelo.prever(janela)
    print(f"entrada: {origem}")
    print(f"ação prevista: {resultado['acao']} | confiança: {resultado['confianca']:.3f}")
    print("probabilidades:", {k: round(v, 3) for k, v in resultado["probabilidades"].items()})


if __name__ == "__main__":
    main()
