# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Base Flask API skeleton only. No AI model loading, prediction logic, database, auth, or background jobs are implemented yet — those are placeholder files reserved for future work. Do not add them unless explicitly asked.

## Commands

```bash
# Setup (Python 3.13 required)
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run
python run.py
# or: flask --app run.py run --debug

# Health check
curl http://127.0.0.1:5000/api/health
```

There is no test suite, linter, or formatter configured yet (`tests/` is empty).

Note: macOS AirPlay Receiver commonly occupies port 5000 — disable it in System Settings, or the server will fail with "Address already in use".

## Architecture

Flask application factory pattern (`app/__init__.py:create_app`), instantiated in `run.py`.

- `config.py` — `Config` class reads settings from environment variables (`SECRET_KEY`, `DEBUG`, `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH`), with `BASE_DIR` as the anchor `pathlib.Path`. Do not add DB/AI config here — keep it minimal.
- `app/routes/` — Blueprints. `health_routes.py` (`health_bp`, registered in `create_app`) is the only implemented one. `prediction_routes.py` is an empty placeholder blueprint for future feature work — not yet registered.
- `app/services/`, `app/utils/`, `app/ai/` — empty placeholder modules for future business logic, file handling, and AI model loading respectively. Each currently contains only a `"""Reserved for future implementation."""` docstring.
- `storage/uploads/` — upload destination; created at runtime by `create_app()` if missing (`.gitkeep` keeps the empty dir tracked in git).
- `.env` — local dev environment variables (gitignored); `.env.example` documents the required keys without real secrets.

When adding a new feature area, follow the existing pattern: a Blueprint in `app/routes/`, business logic in `app/services/`, registered explicitly inside `create_app()`.
