# AI Service (Flask/Python) — Face ID — spec để implement

Đọc trước: `docs/AI-SERVICE-FACE-ID-PLAN.md` (bối cảnh, lý do đổi từ face-api.js sang service riêng). File này là bản **chốt quyết định**, dùng để code thẳng, không phải để bàn thêm — 5 câu hỏi mở ở cuối file PLAN đã trả lời ở mục "Quyết định" bên dưới.

Repo này (Node) **không gọi service này chưa** — code hiện tại vẫn dùng `face-api.js` trong `src/services/face-recognition.service.js`. Khi `ai-service` build xong và verify ổn, Node mới wire qua (xem mục "Node cần đổi gì" cuối file PLAN).

## Trách nhiệm

Service Python **thuần AI, không state, không DB, không biết business logic**:
- Nhận ảnh, trả embedding / kết quả so khớp / kết quả liveness.
- Không tự quyết định mở cửa, không biết `door_access_logs`/`device_commands`/user/home là gì.
- Node giữ toàn bộ business logic (ownership, lockout, PIN fallback, alert, mở cửa).

## Quyết định (trả lời 5 câu hỏi mở trong PLAN)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Threshold tính ở đâu | **Python.** Node gửi kèm `threshold` (float) trong request `/api/face-id/verify`, lấy từ `.env` `FACE_MATCH_THRESHOLD` phía Node — Node vẫn là nơi cấu hình, Python chỉ dùng giá trị được truyền, không có threshold mặc định hard-code riêng. |
| 2 | 1 ảnh hay nhiều frame | **Nhiều frame, list.** `images` luôn là mảng (1–5 phần tử). Node gửi 1 ảnh thì mảng có 1 phần tử — API không cần 2 field khác nhau cho 2 case. |
| 3 | Auth Node ↔ Python | **API key tĩnh**, header `X-API-Key`, so sánh với biến môi trường `AI_SERVICE_API_KEY` (Python) / `AI_SERVICE_API_KEY` (Node `.env`, cùng giá trị). Request thiếu hoặc sai key → `401`. |
| 4 | Batch re-enroll | **Không làm.** Ngoài scope service này. User tự enroll lại thủ công từng người sau khi cắt sang model mới (embedding cũ không convert được — xem mục Migration trong PLAN). |
| 5 | Fallback khi service down | **Chặn hẳn Face ID, bắt dùng PIN.** Không giữ face-api.js chạy song song vĩnh viễn (mất hết lý do migrate). Node: request tới `ai-service` timeout/lỗi kết nối → coi như Face ID không khả dụng, trả lỗi để FE tự chuyển qua PIN (không phải `failed` match — là lỗi hệ thống, không tính vào đếm lockout 3 lần sai). |

## Endpoints

Base path: `/api/face-id` — mỗi chức năng AI của service này nằm dưới namespace riêng theo tên chức năng (`/api/face-id/...`, sau này thêm chức năng khác thì `/api/<feature>/...`), tránh đụng route khi service phình ra nhiều AI feature. Face ID: `POST /api/face-id/enroll`, `POST /api/face-id/verify`, `GET /api/face-id/health`.

Mọi request (trừ `/api/face-id/health`) bắt buộc header:
```
X-API-Key: <AI_SERVICE_API_KEY>
```

### `GET /api/face-id/health`

Không cần auth. Dùng cho readiness probe / Node kiểm tra trước khi gọi thật.

Response `200`:
```json
{ "status": "ok", "modelsLoaded": true }
```

### `POST /api/face-id/enroll`

Content-Type: `multipart/form-data`.

Request:
```
image: file (jpeg/png, field name "image")
```

Xử lý:
1. Detect mặt trong ảnh.
2. 0 mặt hoặc ≥2 mặt → lỗi (xem bảng lỗi).
3. Tính embedding (ArcFace/InsightFace, xem mục Model).

Response `200`:
```json
{ "embedding": [0.0123, -0.0456, "... đủ 512 số float"] }
```

### `POST /api/face-id/verify`

Content-Type: `multipart/form-data`.

Request:
```
images: file[]      # 1–5 ảnh/frame, field name "images" lặp lại
threshold: float     # bắt buộc, Node gửi từ FACE_MATCH_THRESHOLD
candidates: string   # JSON string, vì multipart không có kiểu list-of-object gọn: [{"id":5,"embedding":[...]}, {"id":7,"embedding":[...]}]
```

Xử lý theo thứ tự (fail sớm để đỡ tốn tài nguyên — inference embedding tốn nhất):
1. **Liveness check trước** trên chuỗi frame. Không sống → trả `isLive: false` ngay, **không** chạy detect/embedding tiếp, `matched: null`.
2. Detect mặt trên frame cuối (hoặc frame rõ nhất — tự chọn heuristic, ví dụ variance-of-Laplacian để chọn frame ít mờ nhất). 0 hoặc ≥2 mặt → lỗi giống `/api/face-id/enroll`.
3. Tính embedding.
4. So khoảng cách Euclidean với từng `candidates[].embedding`, lấy nhỏ nhất.
5. `distance <= threshold` → `matched` là candidate đó; ngược lại `matched: null`.

Response `200`:
```json
{
  "isLive": true,
  "livenessScore": 0.94,
  "matched": { "id": 5, "distance": 0.31 },
  "distance": 0.31
}
```
`candidates` rỗng → vẫn chạy liveness + detect, `matched: null`, `distance: null` (không lỗi — đây là case hợp lệ, home chưa enroll ai).

### Bảng lỗi (áp dụng cả `/api/face-id/enroll` và `/api/face-id/verify`)

Envelope lỗi, đồng nhất với Node (`error.middleware.js`):
```json
{ "message": "...", "details": { "...": "..." } }
```

| status | Khi nào | `message` |
|---|---|---|
| `400` | Thiếu `image`/`images`, sai định dạng file, `candidates` không parse được JSON, thiếu `threshold` | mô tả cụ thể |
| `401` | Thiếu/sai `X-API-Key` | `"Unauthorized"` |
| `422` | 0 mặt phát hiện được | `"No face detected"` |
| `422` | ≥2 mặt phát hiện được | `"Multiple faces detected"` |
| `500` | Lỗi model/inference không lường trước | `"Internal server error"` (không leak stack trace ra response) |

## Model

- **Recognition**: InsightFace (ArcFace embedding, 512 chiều) qua `insightface` package, hoặc export ONNX chạy bằng `onnxruntime` — ưu tiên ONNX nếu deploy không có GPU (cold-start nhanh hơn, không kéo theo full PyTorch).
- **Liveness/anti-spoof**: MiniFASNet (`Silent-Face-Anti-Spoofing`, Minivision AI), bản ONNX.
- Cả hai model load 1 lần lúc process khởi động (giống cách Node memoize `loadModels()` trong `face-recognition.service.js`), không load lại mỗi request.

## Chống video replay (multi-frame)

Với `images` là 3–5 frame:
- MiniFASNet chạy trên từng frame, lấy trung bình hoặc frame thấp nhất làm `livenessScore` (an toàn hơn — 1 frame giả cũng đủ nghi).
- (tuỳ chọn, làm sau nếu cần chặt hơn) check moiré pattern qua FFT, check độ nhất quán chuyển động vi mô giữa các frame — xem chi tiết trong PLAN, không bắt buộc ở bản đầu.

## Cấu trúc Flask đề xuất

```
ai-service/
  app.py                 # tạo Flask app, đăng ký blueprint, load model lúc startup
  config.py              # đọc AI_SERVICE_API_KEY, PORT, MODEL_DIR từ env
  routes/
    face_id.py           # blueprint, url_prefix="/api/face-id": /enroll, /verify, /health
  services/
    face_recognition.py  # detect + embedding (ArcFace)
    liveness.py           # MiniFASNet
  middleware/
    auth.py               # kiểm tra X-API-Key, chạy trước mọi route trừ /api/face-id/health
  models/                 # weight files (gitignore, tải lúc build/deploy giống scripts/download-face-models.js bên Node)
  requirements.txt
  tests/
    test_enroll.py
    test_verify.py
```

- Dùng `Flask` + `flask-cors` (nếu Node gọi qua browser proxy — thường không cần, Node gọi server-to-server thì bỏ CORS được) + `onnxruntime` + `opencv-python` (decode ảnh) + `numpy`.
- Trả JSON luôn qua `jsonify`, không trả HTML lỗi mặc định của Flask (`app.errorhandler` bắt hết exception, ép về envelope `{ message, details }` ở trên).

## Env vars (Python)

```
AI_SERVICE_API_KEY=      # cùng giá trị với Node .env
PORT=8000
MODEL_DIR=./models
```

## Performance

- Mục tiêu: `/api/face-id/verify` (bao gồm liveness + detect + embedding + so khớp N candidates) dưới ~2-3 giây trên CPU cho 1 request — nhanh hơn hẳn ~8-10s hiện tại của face-api.js (lý do chính để migrate, xem PLAN).
- Nếu chậm hơn mục tiêu: ưu tiên ONNX Runtime thay vì PyTorch trước khi tính tới GPU.

## Testing

- Test integration tương tự Node (`tests/door-access-verify-face.test.js`): dùng ảnh fixture thật (không mock model), test case: 0 mặt, nhiều mặt, match đúng, không match, liveness fail (dùng ảnh in lại / ảnh chụp màn hình làm fixture giả).
- `/api/face-id/health` phải trả `200` chỉ khi model đã load xong — dùng cho readiness probe khi deploy, tránh Node gọi vào lúc service chưa sẵn sàng.
