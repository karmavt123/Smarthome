"""Do diem liveness tren anh that vs anh gia de chon LIVENESS_THRESHOLD.

  docker cp ./live  smarthome-ai-service:/app/live     # mat that truoc webcam
  docker cp ./spoof smarthome-ai-service:/app/spoof    # chup lai man hinh dien thoai
  docker compose exec ai-service python tools/measure_liveness.py /app/live /app/spoof
"""
import sys, glob, os
import cv2
from config import Config
from app.ai.model_loader import load_models
from app.services.liveness_service import compute_liveness

load_models(Config.MODEL_DIR)

def scan(folder, label):
    scores = []
    for p in sorted(glob.glob(os.path.join(folder, "*"))):
        if not p.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        img = cv2.imread(p)
        if img is None:
            continue
        s = compute_liveness([img])
        scores.append(s)
        print(f"  {s:.4f}   {os.path.basename(p)}")
    print(f"  --> {label}: min {min(scores):.4f}  max {max(scores):.4f}" if scores else "  (khong co anh)")
    return scores

print("=== ANH THAT (muon diem CAO) ===");  real = scan(sys.argv[1], "that")
print("\n=== ANH GIA (muon diem THAP) ==="); fake = scan(sys.argv[2], "gia")

if real and fake:
    lo, hi = min(real), max(fake)
    print(f"\nThat THAP nhat: {lo:.4f}   Gia CAO nhat: {hi:.4f}")
    if hi < lo:
        print(f"*** TACH ROI. LIVENESS_THRESHOLD de nghi = {(lo + hi) / 2:.2f} ***")
    else:
        print("*** CHONG NHAU -> pipeline tien xu ly nhieu kha nang SAI, dung chinh nguong. ***")
