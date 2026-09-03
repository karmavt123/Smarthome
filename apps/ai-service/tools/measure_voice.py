"""In confidence cho cac cau mau de chon VOICE_INTENT_THRESHOLD.

  docker compose exec ai-service python tools/measure_voice.py
"""
import sys
sys.path.insert(0, "/app")
from config import Config
from app.ai.model_loader import load_models
from app.services.voice_intent_service import classify_intent, _score_intents, NONE_LABEL, NEGATION

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
PHU_DINH = [
    "đừng bật đèn", "khoan hãy tắt quạt", "không cần mở cửa đâu",
    "không bật đèn", "không tắt quạt",
]

def run(title, phrases, show_regex=False):
    print(f"\n=== {title} ===")
    out_real = []
    for t in phrases:
        scores = _score_intents(t)
        best_real_label, best_real_conf = max(
            ((k, v) for k, v in scores.items() if k != NONE_LABEL),
            key=lambda kv: kv[1],
        )
        r = classify_intent(t, Config.VOICE_INTENT_THRESHOLD)
        verdict = "CHAP NHAN" if r else "TU CHOI  "
        tag = f"  regex_hit={bool(NEGATION.search(t))}" if show_regex else ""
        print(f"  {verdict}  best_real={best_real_label[0]}/{best_real_label[1]}:{best_real_conf:.4f}{tag}  {t}")
        out_real.append(best_real_conf)
    return out_real

a = run("LENH THAT (muon confidence CAO)", LENH)
b = run("KHONG PHAI LENH (muon confidence-voi-y-dinh-that THAP)", KHONG_PHAI_LENH)
c = run("PHU DINH (bay - phai bi TU CHOI het, VA phai regex_hit=True)", PHU_DINH, show_regex=True)

print(f"\nNguong dang dung: {Config.VOICE_INTENT_THRESHOLD}")
print(f"Lenh that THAP nhat: {min(a):.4f}")
print(f"Khong-phai-lenh CAO nhat: {max(b):.4f}")
print(f"Phu dinh CAO nhat: {max(c):.4f}")