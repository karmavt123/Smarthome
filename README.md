## Setup

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Run

```bash
python run.py
# or: flask --app run.py run --debug
```

## Health check

```bash
curl http://127.0.0.1:5000/api/health
```

Expected:

```json
{ "success": true, "message": "API is running" }
```
