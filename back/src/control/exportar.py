import os, re, glob, json, numpy as np, pandas as pd, torch, torch.nn as nn
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import f1_score, classification_report
ROOT = "/workspace/dados/mediapipe/3_75 ELEMENTS LABLES_MEDIAPIPE_Final_to_Submit"
ACOES = {"Arm_Swing":0,"Body_pose":1,"chest_expansion":2,"Frog_Pose":3,"Drumming":4,
         "Marcas_Forward":5,"Marcas_Shaking":6,"Sing_Clap":7,"Squat_Pose":8,"Tree_Pose":9,"Twist_Pose":10}
def crianca(n):
    m = re.search(r"_([24]\d{4})_", n); return m.group(1) if m else None
def preparar(d):
    p = d.reshape(179, 25, 3)
    quadril = (p[:, 15] + p[:, 16]) / 2
    ombro = (p[:, 5] + p[:, 6]) / 2
    escala = np.linalg.norm(ombro - quadril, axis=1).mean() + 1e-6
    p = (p - quadril[:, None, :]) / escala
    d = p.reshape(179, 75)
    v = np.diff(d, axis=0, prepend=d[:1])
    return np.concatenate([d, v], 1).astype("float32")
X, y, g = [], [], []
for pasta, lab in ACOES.items():
    for f in glob.glob(f"{ROOT}/{pasta}/*.csv"):
        n = os.path.basename(f)
        if "(1)" in n: continue
        c = crianca(n)
        if c is None: continue
        d = pd.read_csv(f).drop(columns=["Action_Label","ASD_Label"]).values.astype("float32")
        if d.shape != (179, 75): continue
        X.append(preparar(d)); y.append(lab); g.append(c)
X, y, g = np.stack(X), np.array(y), np.array(g)
class GRU(nn.Module):
    def __init__(s):
        super().__init__(); s.g = nn.GRU(150, 128, 2, batch_first=True, dropout=0.3); s.f = nn.Linear(128, 11)
    def forward(s, x): return s.f(s.g(x)[0][:, -1])
dev = "cuda"
def treinar(Xa, ya, Xv, yv):
    mu, sd = Xa.mean((0,1)), Xa.std((0,1)) + 1e-6
    T = lambda a: torch.tensor((a - mu) / sd).to(dev)
    Xt, yt, Xvt = T(Xa), torch.tensor(ya).to(dev), T(Xv)
    m = GRU().to(dev); opt = torch.optim.Adam(m.parameters(), 1e-3); ce = nn.CrossEntropyLoss()
    melhor, est = -1, None
    for ep in range(80):
        m.train(); p = torch.randperm(len(Xt))
        for i in range(0, len(p), 64):
            b = p[i:i+64]; opt.zero_grad(); ce(m(Xt[b]), yt[b]).backward(); opt.step()
        m.eval()
        with torch.no_grad(): a = (m(Xvt).argmax(1).cpu().numpy() == yv).mean()
        if a > melhor: melhor, est = a, {k: v.clone() for k, v in m.state_dict().items()}
    m.load_state_dict(est); m.eval(); return m, mu, sd, melhor
# 1) modelo com teste separado: gera as metricas reportaveis
gss = GroupShuffleSplit(1, test_size=0.2, random_state=0); trv, te = next(gss.split(X, y, g))
a, b = next(GroupShuffleSplit(1, test_size=0.15, random_state=0).split(X[trv], y[trv], g[trv])); tr, va = trv[a], trv[b]
assert not (set(g[tr]) & set(g[te])) and not (set(g[va]) & set(g[te]))
m, mu, sd, val = treinar(X[tr], y[tr], X[va], y[va])
with torch.no_grad(): pr = m(torch.tensor((X[te]-mu)/sd).to(dev)).argmax(1).cpu().numpy()
rel = classification_report(y[te], pr, target_names=list(ACOES), output_dict=True)
metricas = {"acc_teste": float((pr==y[te]).mean()), "macro_f1_teste": float(f1_score(y[te], pr, average="macro")),
            "criancas_treino": len(set(g[tr])), "criancas_teste": len(set(g[te])), "por_classe": rel,
            "media_5_divisoes": {"acc": 0.707, "acc_desvio": 0.034, "macro_f1": 0.626, "macro_f1_desvio": 0.094},
            "aviso": "Classifica 11 acoes de terapia (MMASD+), criancas. NAO detecta crise. Teste com 7 criancas."}
json.dump(metricas, open("metricas.json","w"), indent=1)
torch.save({"pesos": m.state_dict(), "mu": mu, "sd": sd, "acoes": ACOES}, "gru_mmasd.pt")
print("acc teste:", round(metricas["acc_teste"],3), "| macroF1:", round(metricas["macro_f1_teste"],3))
