#!/bin/sh
set -e

mkdir -p "$MODEL_DIR"

# minifasnet.onnx khong tu tai duoc -> lay tu model-seed (commit trong git)
if [ -f /app/model-seed/minifasnet.onnx ]; then
  cp -n /app/model-seed/minifasnet.onnx "$MODEL_DIR/minifasnet.onnx"
  echo "→ minifasnet.onnx san sang"
else
  echo "⚠ Khong thay model-seed/minifasnet.onnx — /api/face-id/verify se loi"
fi

echo "→ Khoi dong ai-service..."
exec gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:5000 run:app
