# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Face ID feature implemented per `docs/AI-SERVICE-FACE-ID-SPEC.md` (`/api/face-id/enroll`, `/verify`, `/health`). Pure AI, no business logic — see spec for the Node/Python split of responsibilities. `prediction_routes.py` and `app/services/prediction_service.py` remain empty placeholders for unrelated future feature work — do not add to them unless explicitly asked. No DB, general auth, or background jobs implemented.

## Commands

```bash
# Setup (Python 3.13 required)
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run
python run.py
# or: flask --app run.py run --debug

# Health checks
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/face-id/health   # modelsLoaded:false until MODEL_DIR/minifasnet.onnx is present

# Tests
python -m pytest tests/
```

`tests/` covers request-validation paths only (auth, missing fields) — no mocked models. Fixture-based cases (face match/no-match, liveness fail) need real face images under `tests/fixtures/`, not yet added.

Note: macOS AirPlay Receiver commonly occupies port 5000 — disable it in System Settings, or the server will fail with "Address already in use".

## Architecture

Flask application factory pattern (`app/__init__.py:create_app`), instantiated in `run.py`. `create_app()` registers blueprints, a uniform `{message, details}` JSON error envelope (`app/utils/errors.py`, `AppError`), and calls `load_models()` synchronously at startup — first boot downloads the InsightFace `buffalo_l` pack (~280MB) into `MODEL_DIR`.

- `config.py` — `Config` class reads settings from environment variables via `python-dotenv` (`SECRET_KEY`, `DEBUG`, `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH`, `AI_SERVICE_API_KEY`, `MODEL_DIR`, `LIVENESS_THRESHOLD`), with `BASE_DIR` as the anchor `pathlib.Path`. Keep unrelated config (DB, etc.) out of here.
- `app/routes/` — Blueprints. `health_routes.py` (generic `/api/health`) and `face_id_routes.py` (`/api/face-id/*`) are registered in `create_app`. `prediction_routes.py` is an unrelated empty placeholder — not registered.
- `app/services/face_recognition_service.py` — face detection + ArcFace embedding via `insightface`. `app/services/liveness_service.py` — MiniFASNet anti-spoof scoring (needs `MODEL_DIR/minifasnet.onnx`, not checked into git — supply it separately). `app/services/prediction_service.py` is an unrelated empty placeholder.
- `app/ai/model_loader.py` — loads both models once at startup, memoized; exposes `get_face_app()`, `get_liveness_session()`, `models_ready()`.
- `app/middleware/auth.py` — `require_api_key` decorator checking `X-API-Key` against `AI_SERVICE_API_KEY`; applied to every `/api/face-id/*` route except `/health`.
- `app/utils/file_utils.py` — decodes multipart image uploads into OpenCV BGR arrays; `app/utils/errors.py` — `AppError` + subclasses for the standard error envelope.
- `storage/uploads/` — upload destination; created at runtime by `create_app()` if missing (`.gitkeep` keeps the empty dir tracked in git).
- `models/` — gitignored; holds the InsightFace pack (auto-downloaded) and `minifasnet.onnx` (manual, see below).
- `.env` — local dev environment variables (gitignored, loaded via `load_dotenv()` in `config.py`); `.env.example` documents the required keys without real secrets.

When adding a new feature area, follow the existing pattern: a Blueprint in `app/routes/`, business logic in `app/services/`, registered explicitly inside `create_app()`.

### Getting the liveness model

`app/services/liveness_service.py` expects `MODEL_DIR/minifasnet.onnx` (MiniFASNet from Minivision AI's `Silent-Face-Anti-Spoofing`, ONNX export). It is not fetched automatically — no verified public ONNX release URL was wired into the codebase. Without it, `/api/face-id/health` reports `modelsLoaded: false` and `/verify` fails; `/enroll` is unaffected (it only needs the InsightFace pack).
