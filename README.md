# YoloHome — Smart Home System

Đồ án đa ngành (DADN) — HCMUT, HK253.

Hệ thống nhà thông minh gồm 4 thành phần: web React, API Node/Express, dịch vụ AI Python (nhận diện khuôn mặt + lệnh giọng nói) và MySQL. Thiết bị thật kết nối qua MQTT. Toàn bộ chạy bằng một lệnh Docker Compose.

*[English version below](#yolohome--smart-home-system-english)*

| Service | Công nghệ | Cổng | Trong Compose |
|---|---|---|---|
| `frontend` | React 19, Vite, Tailwind | 8000 | ✓ |
| `backend` | Node 20, Express 5, Prisma, MQTT | 3000 | ✓ |
| `ai-service` | Python 3.11, Flask, ONNX Runtime | 5000 | ✓ |
| `mysql` | MySQL 8.0 | nội bộ | ✓ |

```
Yolo:Bit ──MQTT──▶ mqtt.ohstem.vn ──MQTT──▶ backend ──▶ MySQL
                                               │
                                               ├──SSE───▶ frontend
                                               └──HTTP──▶ ai-service
```

---

## 1. Lấy source code

```bash
git clone https://github.com/karmavt123/Smarthome.git
cd Smarthome
code .
```

Đặt ở thư mục nào cũng được — chế độ demo không bind-mount source, code được `COPY` vào image lúc build.

Trên Windows nên dùng **Git Bash** thay cho PowerShell: PS 5.1 không hỗ trợ `&&`, `curl` là alias của `Invoke-WebRequest`, và console mặc định không phải UTF-8 nên chuỗi tiếng Việt truyền qua dòng lệnh bị hỏng.

---

## 2. Cấu trúc thư mục

```text
Smarthome/
├── docker-compose.yml              # base - che do demo
├── docker-compose.override.yml     # dev - Docker tu dong doc chong len
├── .env.example                    # mau cau hinh, copy thanh .env
├── .gitattributes                  # ep LF, danh dau .onnx la binary
└── apps/
    ├── backend/
    │   ├── Dockerfile
    │   ├── docker-entrypoint.sh    # migrate -> seed -> bootstrap board -> start
    │   ├── prisma/
    │   │   ├── seed.js             # 2 nha mau, du lieu tinh
    │   │   └── bootstrap-board.js  # nha + 4 thiet bi cho board that
    │   └── src/
    │       ├── controllers/  routes/  services/
    │       ├── middlewares/  config/  utils/
    │       ├── mqtt/               # ket noi OhStem
    │       │   ├── channel-map.js  # anh xa kenh V1-V6 <-> thiet bi
    │       │   ├── client.js       # subscribe, nhan telemetry
    │       │   └── commands.js     # publish lenh dieu khien
    │       └── simulator/          # thiet bi ao
    ├── frontend/
    │   ├── Dockerfile              # multi-stage: node build -> nginx
    │   ├── nginx.conf              # SPA fallback + proxy /api + SSE
    │   ├── public/models/          # weights face-api.js (tai qua postinstall)
    │   └── src/
    │       └── components/  pages/  hooks/  services/
    └── ai-service/
        ├── Dockerfile
        ├── docker-entrypoint.sh
        ├── model-seed/
        │   └── minifasnet.onnx     # weights chong gia mao (commit trong repo)
        ├── app/
        │   ├── routes/  services/  ai/  middleware/  utils/
        │   └── faces/              # anh hieu chinh (gitignored)
        └── tools/                  # script do nguong
```

`ai-service` là dịch vụ AI thuần — nhận ảnh trả embedding, nhận text trả ý định. Toàn bộ logic nghiệp vụ (quyền sở hữu, khoá 3 lần sai, dự phòng PIN, nhật ký mở cửa) nằm ở `backend`. Nhờ vậy `ai-service` chết thì hệ thống chỉ mất Face ID và giọng nói, phần còn lại chạy bình thường.

---

## 3. Yêu cầu môi trường

- Windows 10/11, macOS hoặc Linux
- Docker Desktop
- Git, curl
- RAM trống ≥ 6 GB, ổ đĩa trống ≥ 10 GB

Không cần cài Node hay Python trên máy — mọi thứ chạy trong container.

```bash
docker version
docker compose version
git --version
```

Nếu build `ai-service` báo hết bộ nhớ trên Windows: Docker Desktop chạy trên nền WSL2 và mặc định chỉ lấy một phần RAM. Tạo `C:\Users\<user>\.wslconfig`:

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

Điền `MQTT_USERNAME` (xem mục 7). Bỏ trống cũng chạy được, chỉ là không có thiết bị thật.

### Hai chế độ

```bash
# DEV - hot reload, vite dev server trong container
docker compose up -d --build

# DEMO - build san, nginx phuc vu file tinh
docker compose -f docker-compose.yml up -d --build
```

Docker **tự động** đọc `docker-compose.override.yml` khi không chỉ định `-f`. Đó là toàn bộ khác biệt giữa hai lệnh.

> ⚠️ **Đổi chế độ thì phải có `--build`.** Hai chế độ dựng hai image khác nhau (`smarthome-frontend-dev` từ stage node, `smarthome-frontend` từ stage nginx). Thiếu `--build` là chạy nhầm image cũ, lỗi `npm: not found` hoặc trang trắng.

Lần build đầu mất **10–20 phút**: `insightface` biên dịch từ mã nguồn và ~750 MB trọng số mô hình được nướng vào image. Lần sau ~30 giây.

```bash
docker compose ps
```

Đợi `smarthome-mysql` và `smarthome-ai-service` đều `(healthy)`, rồi mở **http://localhost:8000**

---

## 5. Kiểm tra hệ thống

```bash
curl http://localhost:3000/health                  # OK
curl http://localhost:5000/api/health
curl http://localhost:5000/api/face-id/health      # modelsLoaded phai la true
curl http://localhost:5000/api/voice/health
curl http://localhost:8000/api/health              # qua nginx proxy
```

Thử phân loại lệnh giọng nói:

```bash
curl -X POST http://localhost:5000/api/voice/intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-face-id-key" \
  -d '{"text":"bật đèn phòng khách"}'
```

Swagger UI: http://localhost:3000/api-docs

---

## 6. Dữ liệu mẫu và tài khoản

```text
admin@admin.com / password
```

Entrypoint của backend chạy 3 bước mỗi lần boot, tất cả đều idempotent:

| Bước | Biến bật/tắt | Kết quả |
|---|---|---|
| `prisma migrate deploy` | luôn chạy | schema mới nhất |
| `prisma/seed.js` | `SEED_ON_BOOT` | 2 nhà **Seed: Nhà chính**, **Seed: Nhà villa** |
| `prisma/bootstrap-board.js` | `BOOTSTRAP_BOARD_ON_BOOT` | nhà **Nha that (Yolo:Bit)** + 4 thiết bị |

Hai nhà seed là dữ liệu **tĩnh**, thiết bị luôn `offline`. Muốn dữ liệu **sống** không cần phần cứng thì bật trình mô phỏng:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"password"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -X POST http://localhost:3000/api/simulator/bootstrap \
  -H "Authorization: Bearer $TOKEN"
```

Lệnh này tạo nhà **Simulation Home** với 4 thiết bị `sim-*`, 3 cảm biến sinh số đo mỗi 5 giây và 3 luật cảnh báo.

Trong web app nhớ **chọn đúng nhà**. Thiết bị `seed-*` vĩnh viễn `offline` — đó là thiết kế, không phải lỗi.

---

## 7. Thiết bị thật qua MQTT

Board Yolo:Bit nói chuyện với backend qua broker MQTT của OhStem. Không có gateway trung gian.

### Bản đồ kênh

| Kênh | Hướng | Nội dung | Thiết bị trong DB |
|---|---|---|---|
| `V1` | board → server | nhiệt độ | `yolobit-sensor` |
| `V2` | board → server | độ ẩm | `yolobit-sensor` |
| `V3` | board → server | ánh sáng | `yolobit-sensor` |
| `V4` | server → board | bật/tắt đèn | `yolobit-light` |
| `V5` | server → board | bật/tắt quạt | `yolobit-fan` |
| `V6` | server → board | mở/đóng cửa | `yolobit-door` |

Topic MQTT: `<MQTT_USERNAME>/feeds/<kênh>`. Payload chiều xuống là `"1"` / `"0"`.

Board là **một** thiết bị vật lý nhưng trong DB là **bốn** bản ghi `devices`, vì cột `device_type` chỉ nhận một giá trị. Tiền tố `yolobit-` là thứ nối chúng lại; khi telemetry về, cả bốn cùng được đánh dấu `online`.

### Cấu hình

Tạo tài khoản tại https://app.ohstem.vn → **Bảng điều khiển IoT** → tạo panel. `Username` hiện ở góc trên phải chính là giá trị điền vào:

```
MQTT_USERNAME=<username cua ban>
```

> Chọn username **riêng biệt** (ví dụ `smarthome-dadn253`). Topic MQTT chỉ ngăn cách bằng username trên broker dùng chung — đặt `smarthome` là dễ đụng dữ liệu nhóm khác.

### Test không cần board

Trên dashboard OhStem kéo widget vào panel và gán kênh:

- 3 **thanh trượt** → `V1` (0–60), `V2` (0–100), `V3` (0–1000)
- 3 **công tắc** → `V4`, `V5`, `V6`

Bấm `▶` để vào chế độ chạy. Kéo slider → log backend hiện `[mqtt] V1 = 28 °C` và số đổi trên web app không cần F5. Bấm bật đèn trên web → công tắc `V4` trên dashboard tự gạt.

> Dải giá trị của slider phải nằm trong `min_value`/`max_value` của cảm biến (khai trong `bootstrap-board.js`). Vượt ngoài dải thì `validateReading()` ném lỗi và **cả gói tin bị bỏ**.

### Chương trình cho board

```
1. Ket noi WiFi (2.4GHz - Yolo:Bit khong vao duoc 5GHz)
2. Ket noi IoT voi Username da dat o tren
3. Lap moi 5 giay:
     doc DHT20            -> gui nhiet do len V1, do am len V2
     doc cam bien anh sang -> gui len V3
4. Nhan tu V4: "1" bat LED,   "0" tat LED
   Nhan tu V5: "1" bat quat,  "0" tat quat
   Nhan tu V6: "1" mo servo,  "0" dong servo
```

Nhịp 5 giây khớp với `DEVICE_OFFLINE_AFTER_SECONDS=60` — phải trượt 12 lần liên tiếp mới bị coi là mất kết nối.

### Hạn chế đã biết

Khối lệnh Yolo:Bit không có đường phản hồi, nên lệnh điều khiển dùng **mô hình lạc quan**: publish xong coi như đã thực thi. Hệ thống xác nhận *lệnh đã gửi*, không xác nhận *cơ cấu chấp hành đã tác động*.

Bù lại bằng `connection_status`, do telemetry thật (V1–V3) cập nhật: rút điện board → hết telemetry → sau 60 giây thành `offline` → lệnh sau đó thất bại với `failure_reason: "Device is offline"`.

---

## 8. Git workflow

Không làm việc trực tiếp trên `main`.

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

## 9. Nguyên tắc làm việc nhóm

- Không push trực tiếp vào `main`.
- Mỗi task một branch riêng, Pull Request nhỏ và tập trung.
- Ít nhất một thành viên khác review trước khi merge.
- Không commit `.env`, mật khẩu, secret hay **ảnh khuôn mặt** (dữ liệu sinh trắc học).
- `main` phải luôn ở trạng thái chạy và demo được.
- **Không chạy `npm install` trên Windows.** npm trên Windows bỏ sót dependency lồng của các gói `wasm32-wasi`, làm `package-lock.json` không nhất quán và `npm ci` trong Docker sẽ hỏng. Cài local thì dùng `npm ci`. Cần thêm/gỡ package thì sinh lại lock trong Linux:

```bash
docker run --rm -v "$PWD/apps/backend:/app" -w /app node:20-slim \
  npm install <package> --package-lock-only --no-audit --no-fund
```

---

## 10. Dừng hệ thống

```bash
docker compose down       # giu du lieu
docker compose down -v    # XOA SACH database
```

Sau `down -v`, lần khởi động tiếp theo tự migrate + seed + bootstrap board lại từ đầu. Đây cũng là cách kiểm tra hệ thống có thật sự chạy được trên máy sạch hay không.

---

## 11. Hiệu chỉnh ngưỡng AI

Ba ngưỡng dưới đây **phải đo trên dữ liệu thật**, không kế thừa giá trị mặc định — chúng phụ thuộc vào model, phiên bản thư viện và điều kiện chụp.

| Ngưỡng | Giá trị | Căn cứ |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | **1.24** | 3 người / 20 ảnh / 190 cặp. Cùng người 0.411–1.195, khác người 1.281–1.462. Hai cụm tách rời, chọn điểm giữa. Sai số 0/190 |
| `VOICE_INTENT_THRESHOLD` | **0.73** | 22 câu, fastembed 0.8.0. Lệnh thật 0.785–1.000, ngoài miền 0.351–0.674 |
| `LIVENESS_THRESHOLD` | 0.70 | **chưa hiệu chỉnh** |

```bash
# Khuon mat: can >=2 nguoi, >=3 anh moi nguoi
# Dat trong apps/ai-service/app/faces/, ten file <ten-nguoi>_<so>.jpg
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_faces.py /app/app/faces

# Chong gia mao: thu muc anh that va anh chup lai man hinh
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_liveness.py /app/live /app/spoof

# Giong noi
docker compose exec -e PYTHONPATH=/app ai-service \
  python tools/measure_voice.py
```

Chụp ảnh hiệu chỉnh bằng **đúng webcam và đúng phòng sẽ dùng hôm demo**. Đổi phiên bản `fastembed` hoặc `insightface` thì phải đo lại — thay đổi cách gộp embedding làm dịch chuyển toàn bộ thang đo.

Nhóm phủ định trong `measure_voice.py` không dùng để chọn ngưỡng: nó là **bẫy** phát hiện lỗi mà ngưỡng không sửa được. Đo được `"khoan hãy tắt quạt"` ra `fan/turn_off` với confidence 0.92 — cao hơn nhiều lệnh hợp lệ. Phủ định vì thế được chặn bằng luật (regex) trước khi gọi model.

---

## 12. Xử lý sự cố

**`npm ci` báo `EUSAGE ... Missing: @emnapi/...`**
Lock bị `npm install` trên Windows ghi đè. `git checkout -- apps/*/package-lock.json`.

**`Bind for 0.0.0.0:8000 failed: port is already allocated`**
Có tiến trình khác giữ cổng, hoặc container cũ chưa dọn.
`docker compose down` → `netstat -ano | findstr :8000` → `taskkill /PID <pid> /F`. Vẫn kẹt thì đổi `FRONTEND_PORT` trong `.env`.

**`/docker-entrypoint.sh: exec: line 47: npm: not found`**
Đang chạy image nginx với command của chế độ dev. Đổi chế độ mà quên `--build`. Chạy lại kèm `--build`.

**`exec ./docker-entrypoint.sh: no such file or directory`**
Script bị CRLF. `git rm --cached -r . && git reset --hard`.

**ai-service khởi động lại liên tục**
`minifasnet.onnx` hỏng hoặc tải thiếu. `ls -lh apps/ai-service/model-seed/` — phải ~1.7 MB.

**Backend dừng ngay khi khởi động**
Thiếu biến trong `.env`. Log liệt kê đủ mọi biến thiếu cùng lúc.

**Kéo slider OhStem mà log backend im lặng**
Theo thứ tự: chưa bấm `▶` trên dashboard → `MQTT_USERNAME` lệch một ký tự → widget gán sai kênh. Log in ra tên kênh nên kéo từng slider là biết ngay.

**Lệnh điều khiển luôn `failed: Device is offline`**
Thiết bị chỉ `online` khi có telemetry trong vòng `DEVICE_OFFLINE_AFTER_SECONDS`. Không có board thì nhích một slider trước khi bấm lệnh.

**Nhận diện khuôn mặt luôn thất bại**
`FACE_MATCH_THRESHOLD` chưa hiệu chỉnh cho model đang dùng. Xem mục 11.

**Số trên web không đổi, phải F5 mới thấy**
SSE không chảy. DevTools → Network → `events/stream` phải ở trạng thái `pending`. Nếu đứt, kiểm `proxy_buffering off` trong `apps/frontend/nginx.conf`.

**Bấm bật/tắt thiết bị thỉnh thoảng báo lỗi**
`SIMULATOR_COMMAND_FAILURE_RATE` > 0. Đặt về `0`.

**Tiếng Việt hiển thị thành `Nh� ch�nh`**
Console Windows sai codepage. `chcp 65001` hoặc dùng Git Bash.

---
---

# YoloHome — Smart Home System (English)

Interdisciplinary project (DADN) — HCMUT, semester 253.

A smart home system with four components: a React web client, a Node/Express API, a Python AI service (face recognition + voice intent) and MySQL. Physical devices connect over MQTT. Everything runs from a single Docker Compose command.

| Service | Stack | Port | In Compose |
|---|---|---|---|
| `frontend` | React 19, Vite, Tailwind | 8000 | yes |
| `backend` | Node 20, Express 5, Prisma, MQTT | 3000 | yes |
| `ai-service` | Python 3.11, Flask, ONNX Runtime | 5000 | yes |
| `mysql` | MySQL 8.0 | internal | yes |

```
Yolo:Bit ──MQTT──▶ mqtt.ohstem.vn ──MQTT──▶ backend ──▶ MySQL
                                               │
                                               ├──SSE───▶ frontend
                                               └──HTTP──▶ ai-service
```

---

## 1. Getting the source code

```bash
git clone https://github.com/karmavt123/Smarthome.git
cd Smarthome
code .
```

Any directory works — demo mode does not bind-mount the source; code is `COPY`'d into the image at build time.

On Windows, prefer **Git Bash** over PowerShell: PS 5.1 has no `&&`, `curl` is an alias for `Invoke-WebRequest`, and the default console is not UTF-8, so Vietnamese strings passed on the command line get mangled.

---

## 2. Directory layout

```text
Smarthome/
├── docker-compose.yml              # base - demo mode
├── docker-compose.override.yml     # dev - Docker layers this on automatically
├── .env.example                    # config template, copy to .env
├── .gitattributes                  # forces LF, marks .onnx as binary
└── apps/
    ├── backend/
    │   ├── Dockerfile
    │   ├── docker-entrypoint.sh    # migrate -> seed -> bootstrap board -> start
    │   ├── prisma/
    │   │   ├── seed.js             # two sample homes, static data
    │   │   └── bootstrap-board.js  # home + 4 device rows for the real board
    │   └── src/
    │       ├── controllers/  routes/  services/
    │       ├── middlewares/  config/  utils/
    │       ├── mqtt/               # OhStem connection
    │       │   ├── channel-map.js  # V1-V6 <-> device mapping
    │       │   ├── client.js       # subscribe, ingest telemetry
    │       │   └── commands.js     # publish control commands
    │       └── simulator/          # virtual devices
    ├── frontend/
    │   ├── Dockerfile              # multi-stage: node build -> nginx
    │   ├── nginx.conf              # SPA fallback + /api proxy + SSE
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

`ai-service` is pure AI — images in, embeddings out; text in, intent out. All business logic (ownership, 3-strike lockout, PIN fallback, access logging) lives in `backend`. If `ai-service` goes down, only Face ID and voice control stop working; everything else keeps running.

---

## 3. Requirements

- Windows 10/11, macOS or Linux
- Docker Desktop
- Git, curl
- 6 GB free RAM, 10 GB free disk

No local Node or Python install needed — everything runs in containers.

```bash
docker version
docker compose version
git --version
```

If the `ai-service` build runs out of memory on Windows: Docker Desktop runs on a WSL2 backend that claims only part of the machine's RAM by default. Create `C:\Users\<user>\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
```

Then run `wsl --shutdown` in PowerShell to apply.

---

## 4. Starting the project

```bash
cp .env.example .env
```

Generate two JWT secrets (run **twice**, use two different strings in `.env`):

```bash
docker run --rm node:20-slim node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fill in `MQTT_USERNAME` (see section 7). Leaving it blank still works — you just get no physical devices.

### Two modes

```bash
# DEV - hot reload, vite dev server inside the container
docker compose up -d --build

# DEMO - prebuilt bundle served by nginx
docker compose -f docker-compose.yml up -d --build
```

Docker reads `docker-compose.override.yml` **automatically** unless you pass `-f`. That is the entire difference between the two commands.

> ⚠️ **Switching modes requires `--build`.** The two modes produce different images (`smarthome-frontend-dev` from the node stage, `smarthome-frontend` from the nginx stage). Without `--build` you run the stale image and get `npm: not found` or a blank page.

The first build takes **10–20 minutes**: `insightface` compiles from source and ~750 MB of model weights are baked into the image. Later builds take about 30 seconds.

```bash
docker compose ps
```

Wait until `smarthome-mysql` and `smarthome-ai-service` both report `(healthy)`, then open **http://localhost:8000**

---

## 5. Health checks

```bash
curl http://localhost:3000/health                  # OK
curl http://localhost:5000/api/health
curl http://localhost:5000/api/face-id/health      # modelsLoaded must be true
curl http://localhost:5000/api/voice/health
curl http://localhost:8000/api/health              # through the nginx proxy
```

Voice intent:

```bash
curl -X POST http://localhost:5000/api/voice/intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-local-face-id-key" \
  -d '{"text":"bật đèn phòng khách"}'
```

Swagger UI: http://localhost:3000/api-docs

---

## 6. Seed data and test account

```text
admin@admin.com / password
```

The backend entrypoint runs three idempotent steps on every boot:

| Step | Toggle | Result |
|---|---|---|
| `prisma migrate deploy` | always | schema up to date |
| `prisma/seed.js` | `SEED_ON_BOOT` | homes **Seed: Nhà chính**, **Seed: Nhà villa** |
| `prisma/bootstrap-board.js` | `BOOTSTRAP_BOARD_ON_BOOT` | home **Nha that (Yolo:Bit)** + 4 devices |

The seeded homes are **static**; their devices stay `offline`. For **live** data without hardware, start the simulator:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"password"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -X POST http://localhost:3000/api/simulator/bootstrap \
  -H "Authorization: Bearer $TOKEN"
```

This creates a **Simulation Home** with 4 `sim-*` devices, 3 sensors emitting a reading every 5 seconds, and 3 alert rules.

Pick the right home in the web app. `seed-*` devices stay `offline` forever — by design, not a bug.

---

## 7. Physical devices over MQTT

The Yolo:Bit board talks to the backend through OhStem's MQTT broker. There is no intermediate gateway.

### Channel map

| Channel | Direction | Payload | Device row |
|---|---|---|---|
| `V1` | board → server | temperature | `yolobit-sensor` |
| `V2` | board → server | humidity | `yolobit-sensor` |
| `V3` | board → server | light | `yolobit-sensor` |
| `V4` | server → board | light on/off | `yolobit-light` |
| `V5` | server → board | fan on/off | `yolobit-fan` |
| `V6` | server → board | door open/close | `yolobit-door` |

MQTT topic: `<MQTT_USERNAME>/feeds/<channel>`. Downstream payload is `"1"` / `"0"`.

The board is **one** physical device but **four** `devices` rows, because `device_type` holds a single value. The `yolobit-` prefix is what ties them together; incoming telemetry marks all four `online`.

### Configuration

Create an account at https://app.ohstem.vn → **Bảng điều khiển IoT** → new panel. The `Username` field in the top right is the value to use:

```
MQTT_USERNAME=<your username>
```

> Pick a **distinctive** username (e.g. `smarthome-dadn253`). On a shared broker the username is the only thing separating your topics — `smarthome` will collide with other teams.

### Testing without a board

On the OhStem dashboard, drop widgets onto the panel and bind channels:

- 3 **sliders** → `V1` (0–60), `V2` (0–100), `V3` (0–1000)
- 3 **switches** → `V4`, `V5`, `V6`

Press `▶` to enter run mode. Drag a slider → the backend logs `[mqtt] V1 = 28 °C` and the number updates in the web app without a refresh. Turn on the light from the web app → the `V4` switch flips on the dashboard.

> A slider's range must sit inside the sensor's `min_value`/`max_value` (declared in `bootstrap-board.js`). Out-of-range values make `validateReading()` throw and **the whole message is dropped**.

### Board program

```
1. Connect WiFi (2.4GHz - Yolo:Bit cannot join 5GHz)
2. Connect IoT with the Username set above
3. Every 5 seconds:
     read DHT20        -> publish temperature to V1, humidity to V2
     read light sensor -> publish to V3
4. On V4: "1" LED on,   "0" LED off
   On V5: "1" fan on,   "0" fan off
   On V6: "1" servo open, "0" servo close
```

The 5-second cadence matches `DEVICE_OFFLINE_AFTER_SECONDS=60` — twelve consecutive misses before the device is considered disconnected.

### Known limitation

Yolo:Bit's block library has no return path, so control commands use an **optimistic** model: once published, the command is marked executed. The system confirms *the command was sent*, not *the actuator moved*.

`connection_status` compensates: it is driven by real telemetry (V1–V3), so unplugging the board stops telemetry, the device flips to `offline` within 60 seconds, and subsequent commands fail with `failure_reason: "Device is offline"`.

---

## 8. Git workflow

Never work directly on `main`.

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

## 9. Team rules

- Never push directly to `main`.
- One branch per task; keep Pull Requests small and focused.
- At least one other member reviews before merging.
- Never commit `.env`, passwords, secrets, or **face photos** (biometric data).
- `main` must always be runnable and demoable.
- **Never run `npm install` on Windows.** npm on Windows omits the nested dependencies of `wasm32-wasi` packages, leaving `package-lock.json` inconsistent and breaking `npm ci` inside Docker. Use `npm ci` for local installs. To add or remove a package, regenerate the lock inside Linux:

```bash
docker run --rm -v "$PWD/apps/backend:/app" -w /app node:20-slim \
  npm install <package> --package-lock-only --no-audit --no-fund
```

---

## 10. Stopping the system

```bash
docker compose down       # keep data
docker compose down -v    # WIPE the database
```

After `down -v`, the next start migrates, seeds and bootstraps the board from scratch. This is also how you verify the system really runs on a clean machine.

---

## 11. AI threshold calibration

The three thresholds below **must be measured against real data** rather than inherited from defaults — they depend on the model, the library version and the capture conditions.

| Threshold | Value | Basis |
|---|---|---|
| `FACE_MATCH_THRESHOLD` | **1.24** | 3 people / 20 photos / 190 pairs. Same person 0.411–1.195, different people 1.281–1.462. Clusters fully separated, midpoint chosen. 0/190 errors |
| `VOICE_INTENT_THRESHOLD` | **0.73** | 22 phrases, fastembed 0.8.0. Real commands 0.785–1.000, out-of-domain 0.351–0.674 |
| `LIVENESS_THRESHOLD` | 0.70 | **not yet calibrated** |

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

Capture calibration photos with **the same webcam and the same room used for the demo**. Changing the `fastembed` or `insightface` version invalidates the measurement — a different pooling strategy shifts the whole similarity scale.

The negation group in `measure_voice.py` is not used to pick a threshold: it is a **trap** for failures no threshold can fix. `"khoan hãy tắt quạt"` ("hold on, turn the fan off" — meaning *don't*) classified as `fan/turn_off` at 0.92 confidence, higher than many valid commands. Negation is therefore filtered by rule before the model runs.

---

## 12. Troubleshooting

**`npm ci` fails with `EUSAGE ... Missing: @emnapi/...`**
The lock was overwritten by `npm install` on Windows. `git checkout -- apps/*/package-lock.json`.

**`Bind for 0.0.0.0:8000 failed: port is already allocated`**
Another process holds the port, or a stale container was not cleaned up.
`docker compose down` → `netstat -ano | findstr :8000` → `taskkill /PID <pid> /F`. Still stuck? Change `FRONTEND_PORT` in `.env`.

**`/docker-entrypoint.sh: exec: line 47: npm: not found`**
Running the nginx image with the dev-mode command — you switched modes without `--build`. Re-run with `--build`.

**`exec ./docker-entrypoint.sh: no such file or directory`**
The script has CRLF endings. `git rm --cached -r . && git reset --hard`.

**ai-service restarts in a loop**
`minifasnet.onnx` is corrupt or truncated. `ls -lh apps/ai-service/model-seed/` — it should be ~1.7 MB.

**Backend exits immediately on start**
Missing variables in `.env`. The log lists every missing variable at once.

**Dragging an OhStem slider produces no backend log**
In order: run mode (`▶`) not enabled → `MQTT_USERNAME` off by a character → widget bound to the wrong channel. The log prints the channel name, so dragging one slider at a time identifies it.

**Commands always fail with `Device is offline`**
A device is only `online` while telemetry arrived within `DEVICE_OFFLINE_AFTER_SECONDS`. Without a board, nudge a slider before issuing a command.

**Face recognition always fails**
`FACE_MATCH_THRESHOLD` is not calibrated for the model in use. See section 11.

**Numbers only update after a refresh**
SSE is not streaming. DevTools → Network → `events/stream` should stay `pending`. If it drops, check `proxy_buffering off` in `apps/frontend/nginx.conf`.

**Device on/off occasionally errors out**
`SIMULATOR_COMMAND_FAILURE_RATE` is above 0. Set it to `0`.

**Vietnamese text renders as `Nh� ch�nh`**
Wrong Windows console codepage. `chcp 65001` or use Git Bash.
