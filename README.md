# YoloHome — Smart Home System

Đồ án đa ngành (DADN) — HCMUT, HK253.

Hệ thống nhà thông minh gồm 4 thành phần: web React, API Node/Express, dịch vụ AI Python (nhận diện khuôn mặt + lệnh giọng nói) và MySQL. Hạ tầng chạy bằng Docker Compose.

*[English version below](#yolohome--smart-home-system-english)*

| Service | Công nghệ | Cổng | Trong Compose |
|---|---|---|---|
| `frontend` | React 19, Vite, Tailwind | 8000 | chưa |
| `backend` | Node 20, Express 5, Prisma | 3000 | ✓ |
| `ai-service` | Python 3.11, Flask, ONNX Runtime | 5000 | ✓ |
| `mysql` | MySQL 8.0 | nội bộ | ✓ |

---

## 1. Lấy source code

```bash
git clone https://github.com/karmavt123/Smarthome.git
cd Smarthome
code .
```

Đặt ở thư mục nào cũng được. Compose không bind-mount source vào container — code được `COPY` vào image lúc build — nên vị trí thư mục không ảnh hưởng tốc độ.

Trên Windows nên dùng **Git Bash** thay cho PowerShell: PS 5.1 không hỗ trợ `&&`, `curl` là alias của `Invoke-WebRequest`, và console mặc định không phải UTF-8 nên chuỗi tiếng Việt truyền qua dòng lệnh bị hỏng.

---

## 2. Cấu trúc thư mục

```text
Smarthome/
├── docker-compose.yml
├── .env.example                    # mẫu cấu hình, copy thành .env
├── .gitattributes                  # ép LF, đánh dấu .onnx là binary
└── apps/
    ├── backend/
    │   ├── Dockerfile
    │   ├── docker-entrypoint.sh    # migrate -> seed -> start
    │   ├── prisma/                 # schema, migrations, seed.js
    │   └── src/
    │       ├── controllers/  routes/  services/
    │       ├── middlewares/  config/  utils/
    │       └── simulator/          # thiết bị ảo
    ├── frontend/
    │   ├── public/models/          # weights face-api.js (tải qua postinstall)
    │   └── src/
    │       └── components/  pages/  hooks/  services/
    └── ai-service/
        ├── Dockerfile
        ├── docker-entrypoint.sh
        ├── model-seed/
        │   └── minifasnet.onnx     # weights chống giả mạo (commit trong repo)
        ├── app/
        │   ├── routes/  services/  ai/  middleware/  utils/
        │   └── faces/              # ảnh hiệu chỉnh (gitignored)
        └── tools/                  # script đo ngưỡng
```

`ai-service` là dịch vụ AI thuần — nhận ảnh trả embedding, nhận text trả ý định. Toàn bộ logic nghiệp vụ (quyền sở hữu, khoá 3 lần sai, dự phòng PIN, nhật ký mở cửa) nằm ở `backend`.

---

## 3. Yêu cầu môi trường

- Windows 10/11, macOS hoặc Linux
- Docker Desktop
- Git, curl
- Node.js 20 (chỉ cần khi chạy frontend)
- RAM trống ≥ 6 GB, ổ đĩa trống ≥ 10 GB

Kiểm tra:

```bash
docker version
docker compose version
git --version
node --version
```

Nếu build `ai-service` báo hết bộ nhớ trên Windows: Docker Desktop chạy trên nền WSL2 và mặc định chỉ lấy một phần RAM của máy. Cấp thêm bằng cách tạo `C:\Users\<user>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Rồi chạy `wsl --shutdown` trong PowerShell để áp dụng.

---

## 4. Khởi động dự án

Tạo file cấu hình:

```bash
cp .env.example .env
```

Sinh 2 khoá JWT (chạy **2 lần**, lấy 2 chuỗi khác nhau, dán vào `.env`):

```bash
docker run --rm node:20-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Build và chạy:

```bash
docker compose up --build -d
```

Lần đầu mất **10–20 phút** (biên dịch `insightface`, nướng ~750 MB model vào image). Lần sau ~30 giây.

Kiểm tra container:

```bash
docker compose ps
```

Đợi `smarthome-mysql` và `smarthome-ai-service` đều `(healthy)`.

Chạy frontend:

```bash
cd apps/frontend
cp .env.example .env
npm ci
npm run start
```

Mở http://localhost:8000

---

## 5. Kiểm tra hệ thống

Backend:

```bash
curl http://localhost:3000/health
```

ai-service:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/face-id/health     # modelsLoaded phải là true
curl http://localhost:5000/api/voice/health
```

Thử phân loại lệnh giọng nói:

```bash
curl -X POST http://localhost:5000/api/voice/intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-face-id-key" \
  -d '{"text":"bật đèn phòng khách"}'
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

---

## 6. Dữ liệu mẫu và tài khoản

Tài khoản mặc định:

```text
admin@admin.com / password
```

Seed tự chạy lúc khởi động (`SEED_ON_BOOT=true`), tạo 2 nhà **Seed: Nhà chính** và **Seed: Nhà villa**. Seed là idempotent — chạy lại chỉ thay thế, không nhân bản.

Hai nhà này là dữ liệu **tĩnh**, thiết bị luôn `offline`. Muốn dữ liệu **sống** thì bật trình mô phỏng:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"password"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -X POST http://localhost:3000/api/simulator/bootstrap \
  -H "Authorization: Bearer $TOKEN"
```

Lệnh này tạo nhà **Simulation Home** với 4 thiết bị `sim-*`, 3 cảm biến sinh số đo mỗi 5 giây và 3 luật cảnh báo.

Trong web app nhớ **chọn nhà "Simulation Home"**. Thiết bị `seed-*` vĩnh viễn `offline` — đó là thiết kế, không phải lỗi.

---

## 7. Git workflow

Không làm việc trực tiếp trên `main`.

Tạo branch cho mỗi task:

```bash
git switch main
git pull origin main
git switch -c feature/<ten-task>
```

Merge code mới nhất từ `main` vào branch mình:

```bash
git switch main
git pull origin main
git switch feature/<ten-task>
git merge main
```

Sau khi hoàn thành:

```bash
git status
git add .
git commit -m "feat: describe the change"
git push -u origin feature/<ten-task>
```

Tạo Pull Request `feature/<ten-task>` → `main`, một thành viên khác review và chạy thử trước khi merge.

Sau khi merge:

```bash
git switch main
git pull origin main
git branch -d feature/<ten-task>
```

Quy ước tên branch:

```text
feature/...   chức năng mới
fix/...       sửa lỗi
test/...      kiểm thử
docs/...      tài liệu
chore/...     cấu hình hoặc bảo trì
```

Ví dụ commit message:

```text
feat: add MQTT client for Yolo:Bit telemetry
fix: correct face match threshold for ArcFace embeddings
build: add Docker Compose stack
docs: update setup instructions
```

---

## 8. Nguyên tắc làm việc nhóm

- Không push trực tiếp vào `main`.
- Mỗi task một branch riêng, Pull Request nhỏ và tập trung.
- Ít nhất một thành viên khác review trước khi merge.
- Không commit `.env`, mật khẩu, secret hay **ảnh khuôn mặt** (dữ liệu sinh trắc học).
- `main` phải luôn ở trạng thái chạy và demo được.
- **Không chạy `npm install` trên Windows.** npm trên Windows bỏ sót dependency lồng của các gói `wasm32-wasi`, làm `package-lock.json` không nhất quán và `npm ci` trong Docker sẽ hỏng. Cài local thì dùng `npm ci`. Cần thêm/gỡ package thì sinh lại lock trong Linux:

```bash
docker run --rm -v "$PWD/apps/backend:/app" -w /app node:20-slim \
  npm install --package-lock-only --no-audit --no-fund
```

---

## 9. Dừng hệ thống

Dừng container nhưng giữ dữ liệu:

```bash
docker compose down
```

Xoá cả container và volume:

```bash
docker compose down -v
```

Lệnh có `-v` sẽ **xoá sạch database**, lần khởi động sau sẽ migrate và seed lại từ đầu.

---

## 10. Hiệu chỉnh ngưỡng AI

Ba ngưỡng dưới đây **phải đo trên dữ liệu thật**, không kế thừa giá trị mặc định — chúng phụ thuộc vào model, phiên bản thư viện và điều kiện chụp.

| Ngưỡng | Script | Trạng thái |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | `tools/measure_faces.py` | đang đo |
| `LIVENESS_THRESHOLD` | `tools/measure_liveness.py` | chưa đo |
| `VOICE_INTENT_THRESHOLD` | `tools/measure_voice.py` | **0.73** (fastembed 0.8.0) |

```bash
# Khuôn mặt: cần >=2 người, >=3 ảnh mỗi người
# Đặt trong apps/ai-service/app/faces/, tên file <ten-nguoi>_<so>.jpg
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_faces.py /app/app/faces

# Chống giả mạo: thư mục ảnh thật và ảnh chụp lại màn hình
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_liveness.py /app/live /app/spoof

# Giọng nói
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_voice.py
```

Chụp ảnh hiệu chỉnh bằng **đúng webcam và đúng phòng sẽ dùng hôm demo**. Đổi phiên bản `fastembed` hoặc `insightface` thì phải đo lại.

---

## 11. Xử lý sự cố

**`npm ci` báo `EUSAGE ... Missing: @emnapi/...`**
Lock bị `npm install` trên Windows ghi đè. Chạy `git checkout -- apps/*/package-lock.json`.

**`exec ./docker-entrypoint.sh: no such file or directory`**
Script bị CRLF. Chạy `git rm --cached -r . && git reset --hard`.

**ai-service khởi động lại liên tục**
`minifasnet.onnx` hỏng hoặc tải thiếu. Kiểm `ls -lh apps/ai-service/model-seed/` — phải ~1.7 MB.

**Backend dừng ngay khi khởi động**
Thiếu biến trong `.env`. Log liệt kê đủ mọi biến thiếu cùng lúc.

**Nhận diện khuôn mặt luôn thất bại**
`FACE_MATCH_THRESHOLD` chưa hiệu chỉnh. Xem mục 10.

**Bấm bật/tắt thiết bị thỉnh thoảng báo lỗi**
`SIMULATOR_COMMAND_FAILURE_RATE` > 0. Đặt về `0` trước khi demo.

**Tiếng Việt hiển thị thành `Nh� ch�nh`**
Console Windows sai codepage. Chạy `chcp 65001` hoặc dùng Git Bash.

---
---

# YoloHome — Smart Home System (English)

Interdisciplinary project (DADN) — HCMUT, semester 253.

A smart home system with four components: a React web client, a Node/Express API, a Python AI service (face recognition + voice intent) and MySQL. Infrastructure runs on Docker Compose.

| Service | Stack | Port | In Compose |
|---|---|---|---|
| `frontend` | React 19, Vite, Tailwind | 8000 | not yet |
| `backend` | Node 20, Express 5, Prisma | 3000 | yes |
| `ai-service` | Python 3.11, Flask, ONNX Runtime | 5000 | yes |
| `mysql` | MySQL 8.0 | internal | yes |

---

## 1. Getting the source code

```bash
git clone https://github.com/karmavt123/Smarthome.git
cd Smarthome
code .
```

Any directory works. Compose does not bind-mount the source into the containers — the code is `COPY`'d into the image at build time — so the location has no effect on performance.

On Windows, prefer **Git Bash** over PowerShell: PS 5.1 has no `&&`, `curl` is an alias for `Invoke-WebRequest`, and the default console is not UTF-8, so Vietnamese strings passed on the command line get mangled.

---

## 2. Directory layout

```text
Smarthome/
├── docker-compose.yml
├── .env.example                    # config template, copy to .env
├── .gitattributes                  # forces LF, marks .onnx as binary
└── apps/
    ├── backend/
    │   ├── Dockerfile
    │   ├── docker-entrypoint.sh    # migrate -> seed -> start
    │   ├── prisma/                 # schema, migrations, seed.js
    │   └── src/
    │       ├── controllers/  routes/  services/
    │       ├── middlewares/  config/  utils/
    │       └── simulator/          # virtual devices
    ├── frontend/
    │   ├── public/models/          # face-api.js weights (postinstall)
    │   └── src/
    │       └── components/  pages/  hooks/  services/
    └── ai-service/
        ├── Dockerfile
        ├── docker-entrypoint.sh
        ├── model-seed/
        │   └── minifasnet.onnx     # anti-spoof weights (committed)
        ├── app/
        │   ├── routes/  services/  ai/  middleware/  utils/
        │   └── faces/              # calibration photos (gitignored)
        └── tools/                  # threshold measurement scripts
```

`ai-service` is pure AI — images in, embeddings out; text in, intent out. All business logic (ownership, 3-strike lockout, PIN fallback, access logging) lives in `backend`.

---

## 3. Requirements

- Windows 10/11, macOS or Linux
- Docker Desktop
- Git, curl
- Node.js 20 (only needed to run the frontend)
- 6 GB free RAM, 10 GB free disk

Verify:

```bash
docker version
docker compose version
git --version
node --version
```

If the `ai-service` build runs out of memory on Windows: Docker Desktop runs on a WSL2 backend that claims only part of the machine's RAM by default. Raise it by creating `C:\Users\<user>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Then run `wsl --shutdown` in PowerShell to apply.

---

## 4. Starting the project

Create the config file:

```bash
cp .env.example .env
```

Generate two JWT secrets (run **twice**, use two different strings in `.env`):

```bash
docker run --rm node:20-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Build and run:

```bash
docker compose up --build -d
```

The first build takes **10–20 minutes** — `insightface` compiles from source and ~750 MB of model weights are baked into the image. Later builds take about 30 seconds.

Check the containers:

```bash
docker compose ps
```

Wait until `smarthome-mysql` and `smarthome-ai-service` both report `(healthy)`.

Run the frontend:

```bash
cd apps/frontend
cp .env.example .env
npm ci
npm run start
```

Open http://localhost:8000

---

## 5. Health checks

Backend:

```bash
curl http://localhost:3000/health
```

ai-service:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/face-id/health     # modelsLoaded must be true
curl http://localhost:5000/api/voice/health
```

Voice intent:

```bash
curl -X POST http://localhost:5000/api/voice/intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-face-id-key" \
  -d '{"text":"bật đèn phòng khách"}'
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

---

## 6. Seed data and test account

Default account:

```text
admin@admin.com / password
```

Seeding runs on boot (`SEED_ON_BOOT=true`) and creates two homes, **Seed: Nhà chính** and **Seed: Nhà villa**. The seed is idempotent — rerunning replaces rather than duplicates.

Those homes are **static**; their devices stay `offline`. For **live** data, start the simulator:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"password"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -X POST http://localhost:3000/api/simulator/bootstrap \
  -H "Authorization: Bearer $TOKEN"
```

This creates a **Simulation Home** with 4 `sim-*` devices, 3 sensors emitting a reading every 5 seconds, and 3 alert rules.

In the web app, select **Simulation Home**. `seed-*` devices stay `offline` forever — that is by design, not a bug.

---

## 7. Git workflow

Never work directly on `main`.

Create a branch per task:

```bash
git switch main
git pull origin main
git switch -c feature/<task-name>
```

Merge the latest `main` into your branch:

```bash
git switch main
git pull origin main
git switch feature/<task-name>
git merge main
```

When finished:

```bash
git status
git add .
git commit -m "feat: describe the change"
git push -u origin feature/<task-name>
```

Open a Pull Request `feature/<task-name>` → `main`. Another member reviews and runs it before merging.

After the merge:

```bash
git switch main
git pull origin main
git branch -d feature/<task-name>
```

Branch naming:

```text
feature/...   new functionality
fix/...       bug fix
test/...      tests
docs/...      documentation
chore/...     config or maintenance
```

Example commit messages:

```text
feat: add MQTT client for Yolo:Bit telemetry
fix: correct face match threshold for ArcFace embeddings
build: add Docker Compose stack
docs: update setup instructions
```

---

## 8. Team rules

- Never push directly to `main`.
- One branch per task; keep Pull Requests small and focused.
- At least one other member reviews before merging.
- Never commit `.env`, passwords, secrets, or **face photos** (biometric data).
- `main` must always be runnable and demoable.
- **Never run `npm install` on Windows.** npm on Windows omits the nested dependencies of `wasm32-wasi` packages, leaving `package-lock.json` inconsistent and breaking `npm ci` inside Docker. Use `npm ci` for local installs. To add or remove a package, regenerate the lock inside Linux:

```bash
docker run --rm -v "$PWD/apps/backend:/app" -w /app node:20-slim \
  npm install --package-lock-only --no-audit --no-fund
```

---

## 9. Stopping the system

Stop containers, keep data:

```bash
docker compose down
```

Remove containers and volumes:

```bash
docker compose down -v
```

The `-v` flag **wipes the database**; the next start will migrate and seed from scratch.

---

## 10. AI threshold calibration

The three thresholds below **must be measured against real data** rather than inherited from defaults — they depend on the model, the library version and the capture conditions.

| Threshold | Script | Status |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | `tools/measure_faces.py` | in progress |
| `LIVENESS_THRESHOLD` | `tools/measure_liveness.py` | not measured |
| `VOICE_INTENT_THRESHOLD` | `tools/measure_voice.py` | **0.73** (fastembed 0.8.0) |

```bash
# Faces: at least 2 people, 3+ photos each.
# Place them in apps/ai-service/app/faces/, named <person>_<n>.jpg
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_faces.py /app/app/faces

# Anti-spoofing: one folder of real captures, one of photos of a screen
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_liveness.py /app/live /app/spoof

# Voice
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_voice.py
```

Capture calibration photos with **the same webcam and the same room used for the demo**. Changing the `fastembed` or `insightface` version invalidates the measurement.

---

## 11. Troubleshooting

**`npm ci` fails with `EUSAGE ... Missing: @emnapi/...`**
The lock was overwritten by `npm install` on Windows. Run `git checkout -- apps/*/package-lock.json`.

**`exec ./docker-entrypoint.sh: no such file or directory`**
The script has CRLF endings. Run `git rm --cached -r . && git reset --hard`.

**ai-service restarts in a loop**
`minifasnet.onnx` is corrupt or truncated. Check `ls -lh apps/ai-service/model-seed/` — it should be ~1.7 MB.

**Backend exits immediately on start**
Missing variables in `.env`. The log lists every missing variable at once.

**Face recognition always fails**
`FACE_MATCH_THRESHOLD` has not been calibrated. See section 10.

**Device on/off occasionally errors out**
`SIMULATOR_COMMAND_FAILURE_RATE` is above 0. Set it to `0` before the demo.

**Vietnamese text renders as `Nh� ch�nh`**
Wrong Windows console codepage. Run `chcp 65001` or use Git Bash.
