import os, re, glob, numpy as np, pandas as pd, torch, torch.nn as nn
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report
ROOT = "/workspace/dados/mediapipe/3_75 ELEMENTS LABLES_MEDIAPIPE_Final_to_Submit"
ACOES = {"Arm_Swing":0,"Body_pose":1,"chest_expansion":2,"Frog_Pose":3,"Drumming":4,
         "Marcas_Forward":5,"Marcas_Shaking":6,"Sing_Clap":7,"Squat_Pose":8,"Tree_Pose":9,"Twist_Pose":10}
def crianca(nome):
    m = re.search(r"_([24]\d{4})_", nome)
    return m.group(1) if m else None
X, y, g = [], [], []
for pasta, lab in ACOES.items():
    for f in glob.glob(f"{ROOT}/{pasta}/*.csv"):
        nome = os.path.basename(f)
        if "(1)" in nome: continue
        cid = crianca(nome)
        if cid is None: continue
        d = pd.read_csv(f).drop(columns=["Action_Label","ASD_Label"]).values.astype("float32")
        if d.shape != (179, 75): continue
        d = d - d[:, 0:3].mean(0, keepdims=True).repeat(25, 1).reshape(1, 75) if False else d
        X.append(d); y.append(lab); g.append(cid)
X, y, g = np.stack(X), np.array(y), np.array(g)
print("clipes:", len(X), "criancas:", len(set(g)))
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
tr, te = next(gss.split(X, y, g))
print("criancas treino/teste:", len(set(g[tr])), len(set(g[te])), "| sobreposicao:", len(set(g[tr]) & set(g[te])))
mu, sd = X[tr].mean((0,1)), X[tr].std((0,1)) + 1e-6
X = (X - mu) / sd
dev = "cuda"
class GRU(nn.Module):
    def __init__(s):
        super().__init__(); s.g = nn.GRU(75, 128, 2, batch_first=True, dropout=0.3); s.f = nn.Linear(128, 11)
    def forward(s, x): return s.f(s.g(x)[0][:, -1])
m = GRU().to(dev); opt = torch.optim.Adam(m.parameters(), 1e-3); ce = nn.CrossEntropyLoss()
Xt, yt = torch.tensor(X[tr]).to(dev), torch.tensor(y[tr]).to(dev)
Xe, ye = torch.tensor(X[te]).to(dev), y[te]
for ep in range(30):
    m.train(); p = torch.randperm(len(Xt))
    for i in range(0, len(p), 64):
        b = p[i:i+64]; opt.zero_grad(); ce(m(Xt[b]), yt[b]).backward(); opt.step()
    m.eval()
    with torch.no_grad(): pr = m(Xe).argmax(1).cpu().numpy()
    print(ep, "acc teste (criancas nao vistas):", round((pr == ye).mean(), 3))
print(classification_report(ye, pr, target_names=list(ACOES)))
