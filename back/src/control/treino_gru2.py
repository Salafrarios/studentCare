import os, re, glob, numpy as np, pandas as pd, torch, torch.nn as nn
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, f1_score
ROOT = "/workspace/dados/mediapipe/3_75 ELEMENTS LABLES_MEDIAPIPE_Final_to_Submit"
ACOES = {"Arm_Swing":0,"Body_pose":1,"chest_expansion":2,"Frog_Pose":3,"Drumming":4,
         "Marcas_Forward":5,"Marcas_Shaking":6,"Sing_Clap":7,"Squat_Pose":8,"Tree_Pose":9,"Twist_Pose":10}
def crianca(n):
    m = re.search(r"_([24]\d{4})_", n); return m.group(1) if m else None
X, y, g = [], [], []
for pasta, lab in ACOES.items():
    for f in glob.glob(f"{ROOT}/{pasta}/*.csv"):
        n = os.path.basename(f)
        if "(1)" in n: continue
        c = crianca(n)
        if c is None: continue
        d = pd.read_csv(f).drop(columns=["Action_Label","ASD_Label"]).values.astype("float32")
        if d.shape != (179, 75): continue
        p = d.reshape(179, 25, 3)
        quadril = (p[:, 15] + p[:, 16]) / 2
        ombro = (p[:, 5] + p[:, 6]) / 2               # indices 5 e 6 = ombros
        escala = np.linalg.norm(ombro - quadril, axis=1).mean() + 1e-6
        p = (p - quadril[:, None, :]) / escala
        d = p.reshape(179, 75)
        v = np.diff(d, axis=0, prepend=d[:1])
        X.append(np.concatenate([d, v], 1)); y.append(lab); g.append(c)
X, y, g = np.stack(X).astype("float32"), np.array(y), np.array(g)
print("clipes:", len(X), "criancas:", len(set(g)), "| entrada:", X.shape)
class GRU(nn.Module):
    def __init__(s):
        super().__init__(); s.g = nn.GRU(150, 128, 2, batch_first=True, dropout=0.3); s.f = nn.Linear(128, 11)
    def forward(s, x): return s.f(s.g(x)[0][:, -1])
dev = "cuda"; accs, f1s = [], []
for seed in range(5):
    gss = GroupShuffleSplit(1, test_size=0.2, random_state=seed)
    trv, te = next(gss.split(X, y, g))
    gss2 = GroupShuffleSplit(1, test_size=0.15, random_state=seed)
    a, b = next(gss2.split(X[trv], y[trv], g[trv])); tr, va = trv[a], trv[b]
    assert not (set(g[tr]) & set(g[te])) and not (set(g[va]) & set(g[te])) and not (set(g[tr]) & set(g[va]))
    mu, sd = X[tr].mean((0,1)), X[tr].std((0,1)) + 1e-6
    T = lambda i: torch.tensor((X[i] - mu) / sd).to(dev)
    Xt, yt, Xv, Xe = T(tr), torch.tensor(y[tr]).to(dev), T(va), T(te)
    m = GRU().to(dev); opt = torch.optim.Adam(m.parameters(), 1e-3); ce = nn.CrossEntropyLoss()
    melhor, estado = -1, None
    for ep in range(80):
        m.train(); p = torch.randperm(len(Xt))
        for i in range(0, len(p), 64):
            bt = p[i:i+64]; opt.zero_grad(); ce(m(Xt[bt]), yt[bt]).backward(); opt.step()
        m.eval()
        with torch.no_grad(): accv = (m(Xv).argmax(1).cpu().numpy() == y[va]).mean()
        if accv > melhor: melhor, estado = accv, {k: v.clone() for k, v in m.state_dict().items()}
    m.load_state_dict(estado); m.eval()
    with torch.no_grad(): pr = m(Xe).argmax(1).cpu().numpy()
    accs.append((pr == y[te]).mean()); f1s.append(f1_score(y[te], pr, average="macro"))
    print(f"divisao {seed}: val={melhor:.3f} teste acc={accs[-1]:.3f} macroF1={f1s[-1]:.3f} | criancas teste={len(set(g[te]))}")
print(f"MEDIA: acc={np.mean(accs):.3f} +- {np.std(accs):.3f} | macroF1={np.mean(f1s):.3f} +- {np.std(f1s):.3f}")
