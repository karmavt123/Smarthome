"""Do diem liveness tren anh that vs anh gia de chon LIVENESS_THRESHOLD.

  docker cp ./live  smarthome-ai-service:/app/live
  docker cp ./spoof smarthome-ai-service:/app/spoof
  docker compose exec ai-service python tools/measure_liveness.py /app/live /app/spoof
"""
import sys, glob, os
sys.path.insert(0, "/app")
import cv2
from config import Config
from app.ai.model_loader import load_models
from app.services.liveness_service import _score_frame

load_models(Config.MODEL_DIR)

def scan(folder, label):
    scores = []
    skipped = 0
    for p in sorted(glob.glob(os.path.join(folder, "*"))):
        if not p.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        img = cv2.imread(p)
        if img is None:
            continue
        s = _score_frame(img)
        if s is None:
            print(f"  KHONG THAY MAT (bo qua)    {os.path.basename(p)}")
            skipped += 1
            continue
        scores.append(s)
        print(f"  {s:.4f}   {os.path.basename(p)}")
    if scores:
        print(f"  --> {label}: min {min(scores):.4f}  max {max(scores):.4f}  ({len(scores)} anh hop le, {skipped} bi bo qua)")
    else:
        print(f"  (khong co anh hop le - {skipped} bi bo qua)")
    return scores

print("=== ANH THAT (muon diem CAO) ===");  real = scan(sys.argv[1], "that")
print("\n=== ANH GIA (muon diem THAP) ==="); fake = scan(sys.argv[2], "gia")

if real and fake:
    lo, hi = min(real), max(fake)
    print(f"\nThat THAP nhat: {lo:.4f}   Gia CAO nhat: {hi:.4f}")
    if hi < lo:
        print(f"*** TACH ROI. LIVENESS_THRESHOLD de nghi = {(lo + hi) / 2:.2f} ***")
    else:
        print("*** CHONG NHAU -> can them anh de xac nhan, dung chon nguong voi it du lieu. ***")