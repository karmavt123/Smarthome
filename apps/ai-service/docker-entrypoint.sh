#!/bin/sh
set -e

mkdir -p "$MODEL_DIR"

# minifasnet.onnx that ~1.74MB; nguong 1MB de bat file tai hong som
# (vi du ban 15-byte da gap, do tai nham ten tren HuggingFace)
MIN_LIVENESS_BYTES=1000000

if [ -f /app/model-seed/minifasnet.onnx ]; then
  actual_size=$(wc -c < /app/model-seed/minifasnet.onnx)
  if [ "$actual_size" -ge "$MIN_LIVENESS_BYTES" ]; then
    cp -n /app/model-seed/minifasnet.onnx "$MODEL_DIR/minifasnet.onnx"
    echo "→ minifasnet.onnx san sang (${actual_size} byte)"
  else
    echo "⚠ model-seed/minifasnet.onnx chi co ${actual_size} byte (nghi ngo tai hong) — BO QUA. /api/face-id/verify se loi cho toi khi thay file dung"
  fi
else
  echo "⚠ Khong thay model-seed/minifasnet.onnx — /api/face-id/verify se loi"
fi

echo "→ Khoi dong ai-service..."
exec gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:5000 run:app