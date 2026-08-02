## Setup

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

macOS AirPlay Receiver commonly occupies port 5000 — set `PORT=5001` (or any free port) in `.env` if so.

## Face ID model setup

Two models back `/api/face-id/*`, from different sources:

- **InsightFace (`buffalo_l`)** — automatic. Downloads itself into `models/models/buffalo_l/` the first time the app boots (needs network on that first run only).
- **MiniFASNet (liveness/anti-spoof)** — manual, not fetched by the app:

```bash
pip install huggingface_hub

hf download \
  garciafido/minifasnet-v2-anti-spoofing-onnx \
  --local-dir models/minifasnet-download

find models/minifasnet-download -name "*.onnx"
```

If that shows:

```
models/minifasnet-download/minifasnetv2.onnx
```

copy it to the filename the app looks for:

```bash
cp models/minifasnet-download/minifasnetv2.onnx \
   models/minifasnet.onnx
```

`models/` is gitignored — every clone needs this step once. Verify both models loaded via the health check below.

## Run

```bash
python run.py
# or: flask --app run.py run --debug
```

## Health checks

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/face-id/health
```

Expected:

```json
{ "success": true, "message": "API is running" }
```

```json
{ "status": "ok", "modelsLoaded": true }
```

`modelsLoaded: false` means MiniFASNet is missing from `models/` — `/api/face-id/enroll` still works (InsightFace only), but `/api/face-id/verify` will 500 until it's added.
