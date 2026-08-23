"""In confidence cho cac cau mau de chon VOICE_INTENT_THRESHOLD.

  docker compose exec ai-service python tools/measure_voice.py
"""
import sys, glob, os
sys.path.insert(0, "/app")
from config import Config
from app.ai.model_loader import load_models
from app.services.voice_intent_service import classify_intent

load_models(Config.MODEL_DIR)

LENH = [
    "bật đèn", "mở đèn phòng khách giúp tôi", "cho tôi bật cái đèn lên",
    "tắt đèn đi", "bật quạt lên", "tắt quạt giúp tôi", "cho quạt chạy đi",
    "mở cửa ra", "đóng cửa lại giúp tôi", "khoá cửa",
    "bật đèn phòng ngủ", "tắt hết đèn trong nhà",
]
KHONG_PHAI_LENH = [
    "hôm nay trời đẹp quá", "mấy giờ rồi", "nhiệt độ phòng bao nhiêu",
    "tôi đói bụng quá", "gọi cho mẹ", "alo alo", "ừ đúng rồi đó",
]
PHU_DINH = ["đừng bật đèn", "khoan hãy tắt quạt", "không cần mở cửa đâu"]

def run(title, phrases):
    print(f"\n=== {title} ===")
    out = []
    for t in phrases:
        r = classify_intent(t, 0.0)
        if r is None:
            print(f"  ------  TU CHOI          {t}")
            out.append(0.0)
            continue
        out.append(r["confidence"])
        print(f"  {r['confidence']:.4f}  {r['deviceType']:>5}/{r['action']:<9}  {t}")
    return out

a = run("LENH THAT (muon confidence CAO)", LENH)
b = run("KHONG PHAI LENH (muon THAP)", KHONG_PHAI_LENH)
c = run("PHU DINH (bay - xem no doan gi)", PHU_DINH)

print(f"\nLenh that THAP nhat   : {min(a):.4f}")
print(f"Khong phai lenh CAO nhat: {max(b):.4f}")
if max(b) < min(a):
    print(f"*** TACH ROI. VOICE_INTENT_THRESHOLD de nghi = {(min(a) + max(b)) / 2:.2f} ***")
else:
    print("*** CHONG NHAU — them cau mau vao SEED_PHRASES hoac chap nhan bo sot. ***")
print(f"\nPhu dinh cao nhat: {max(c):.4f}  <- cao hon nguong = lo hong, can chan bang regex")
