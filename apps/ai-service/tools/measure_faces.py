"""Do khoang cach embedding giua cac anh de chon FACE_MATCH_THRESHOLD.

  docker cp ./faces smarthome-ai-service:/app/faces
  docker compose exec ai-service python tools/measure_faces.py /app/faces

Ten file: <ten-nguoi>_<so>.jpg  -> script gom nhom theo phan truoc dau '_'.
"""
import sys, glob, os, itertools
import cv2
sys.path.insert(0, "/app")
from config import Config
from app.ai.model_loader import load_models
from app.services.face_recognition_service import get_embedding, euclidean_distance

folder = sys.argv[1] if len(sys.argv) > 1 else "/app/faces"
load_models(Config.MODEL_DIR)

paths = sorted(p for p in glob.glob(os.path.join(folder, "*"))
               if p.lower().endswith((".jpg", ".jpeg", ".png")))
if not paths:
    sys.exit(f"Khong thay anh nao trong {folder}")

emb = {}
for p in paths:
    img = cv2.imread(p)
    if img is None:
        print(f"  bo qua (khong doc duoc): {os.path.basename(p)}"); continue
    try:
        emb[p] = get_embedding(img)
    except Exception as e:
        print(f"  bo qua ({type(e).__name__}): {os.path.basename(p)}")

who = lambda p: os.path.basename(p).split("_")[0]
same, diff = [], []
for a, b in itertools.combinations(sorted(emb), 2):
    d = euclidean_distance(emb[a], emb[b])
    (same if who(a) == who(b) else diff).append((d, os.path.basename(a), os.path.basename(b)))

for title, rows in [("CUNG NGUOI (muon NHO)", same), ("KHAC NGUOI (muon LON)", diff)]:
    print(f"\n=== {title} — {len(rows)} cap ===")
    for d, a, b in sorted(rows):
        print(f"  {d:.4f}   {a}  vs  {b}")

if same and diff:
    hi, lo = max(d for d, *_ in same), min(d for d, *_ in diff)
    print(f"\nCung nguoi XA nhat  : {hi:.4f}")
    print(f"Khac nguoi GAN nhat : {lo:.4f}")
    if hi < lo:
        print(f"\n*** Hai cum TACH ROI. FACE_MATCH_THRESHOLD de nghi = {(hi + lo) / 2:.2f} ***")
    else:
        print(f"\n*** Hai cum CHONG NHAU. Chon an toan (it nhan nham) = {lo - 0.05:.2f} ***")
