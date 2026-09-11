#!/bin/sh
set -e

# MODEL_DIR trong rong lam `mkdir -p ""` that bai va `set -e` giet container truoc khi
# kip log gi. Compose luon set bien nay; default o day cho truong hop `docker run` tay.
# Export de tien trinh Python thay duoc dung gia tri nay, khong phai doan lai.
MODEL_DIR="${MODEL_DIR:-/app/models}"
export MODEL_DIR
# `mkdir -p` that bai khi $MODEL_DIR da ton tai nhung LA MOT FILE THUONG (go sai duong
# dan trong .env, hoac mount nham mot file vao cho thu muc). Voi `set -e` truoc day script
# chet ngay tai day, exit 1, khong mot dong log — container restart-loop va nguoi dung
# khong biet vi sao. Ca file nay duoc viet de "mat Face ID chu khong chet", nen loi nay
# cung phai theo dung nguyen tac do: canh bao roi chay tiep, cac API khac van phuc vu.
if ! mkdir -p "$MODEL_DIR" 2>/dev/null; then
  echo "⚠ Khong tao duoc thu muc model '$MODEL_DIR' (dang ton tai nhung khong phai thu muc?)"
fi

SEED_FILE=/app/model-seed/minifasnet.onnx
DEST_FILE="$MODEL_DIR/minifasnet.onnx"
# minifasnet.onnx that ~1.74MB; nguong 1MB de bat file tai hong
# (vi du ban 15-byte da gap, do tai nham ten tren HuggingFace)
MIN_LIVENESS_BYTES=1000000

# `|| echo 0` la BAT BUOC: voi `set -e`, mot phep gan `var=$(cmd)` mang exit status cua
# cmd, nen mot file ton tai nhung khong doc duoc (mount sai quyen) se giet script ngay
# tai dong gan — truoc ca dong log dau tien cua chinh no.
# `2>/dev/null` phai bao TRUOC CA phep chuyen huong `< "$1"`, khong chi bao `wc`. Shell
# mo file *truoc khi* chay wc, nen loi "cannot open: Permission denied" la do CHINH SHELL
# in ra va `wc ... 2>/dev/null` khong che duoc — no van ro ri ra stderr cua container roi
# lan vao `docker logs`. Boc trong `{ ...; } 2>/dev/null` moi phu ca phep mo file.
file_size() {
  if [ -r "$1" ] && [ -f "$1" ]; then
    { wc -c < "$1"; } 2>/dev/null || echo 0
  else
    echo 0
  fi
}

seed_size=$(file_size "$SEED_FILE")
dest_size=$(file_size "$DEST_FILE")

if [ "$seed_size" -ge "$MIN_LIVENESS_BYTES" ]; then
  # Ghi de khi file dich thieu HOAC hong. Truoc day dung `cp -n` nen mot file dich hong
  # san (rat de xay ra khi mount volume cho $MODEL_DIR de khoi tai lai buffalo_l) duoc
  # giu nguyen, ma log van bao "san sang" kem size cua file NGUON.
  if [ "$dest_size" -lt "$MIN_LIVENESS_BYTES" ]; then
    # `|| true`: MODEL_DIR mount read-only thi cp that bai. Do la ly do de chay giam
    # chuc nang (mat Face ID), khong phai ly do de container khong bao gio khoi dong —
    # dong log ben duoi da hua "cac API khac van chay", phai giu dung loi hua do.
    cp "$SEED_FILE" "$DEST_FILE" 2>/dev/null || echo "⚠ Khong ghi duoc $DEST_FILE (mount read-only?)"
    dest_size=$(file_size "$DEST_FILE")
  fi
elif [ "$seed_size" -gt 0 ]; then
  echo "⚠ model-seed/minifasnet.onnx chi co ${seed_size} byte (nghi ngo tai hong) — BO QUA"
else
  echo "⚠ Khong doc duoc model-seed/minifasnet.onnx"
fi

# Kiem chinh FILE SE DUOC NAP, khong phai file nguon.
if [ "$dest_size" -ge "$MIN_LIVENESS_BYTES" ]; then
  echo "→ minifasnet.onnx san sang (${dest_size} byte)"
else
  echo "⚠ $DEST_FILE khong dung (${dest_size} byte) — /api/face-id/verify se loi, cac API khac van chay"
fi

echo "→ Khoi dong ai-service..."
exec gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:5000 run:app
