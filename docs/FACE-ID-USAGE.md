# Face ID — hướng dẫn sử dụng

Backend đã build xong phần API mô tả trong `docs/FACE-ID-PLAN-FRONTEND.md`. Tài liệu này nói cách chạy và gọi các API đó. Đọc `FACE-ID-PLAN-FRONTEND.md` trước nếu cần hiểu lý do thiết kế (vì sao gộp verify+mở cửa, vì sao không trả embedding, v.v.).

## 1. Setup lần đầu

### macOS (dev machine)

`canvas` (dùng để decode ảnh) cần vài thư viện native qua Homebrew:

```bash
brew install pango librsvg   # cairo, jpeg-turbo, giflib thường đã có sẵn
```

Sau đó:

```bash
nvm use              # Node >= 20, bắt buộc (đã pin .nvmrc)
npm install          # cài xong sẽ tự chạy postinstall tải model weights (~12.5MB, cần mạng)
```

Nếu `postinstall` tải model lỗi (mất mạng giữa chừng), chạy lại thủ công:

```bash
node scripts/download-face-models.js
```

Model weights nằm ở `weights/face-api/` (gitignored, mỗi máy tự tải). Không cần GPU, không cần Python.

### Biến môi trường mới

Thêm vào `.env` (đã có sẵn trong `.env.example`):

```
FACE_MATCH_THRESHOLD=0.6
```

Khoảng cách Euclidean tối đa giữa 2 embedding để coi là cùng 1 người — số càng nhỏ càng khắt khe. `0.6` là mặc định phổ biến của face-api.js, **chưa tune với ảnh thật của project này** — xem mục "Tune threshold" bên dưới.

### Lưu trữ ảnh

Ảnh enrollment lưu ở `uploads/faces/` (gitignored, local disk trên server chạy backend — đủ dùng vì đây là single-instance deploy). Ảnh được serve tĩnh tại `/uploads/faces/<file>`.

## 2. Các API

Tất cả route đều cần header `Authorization: Bearer <accessToken>` (JWT access token từ `/api/auth/sign-in`), giống các route khác trong hệ thống. Body multipart (vì có upload ảnh).

### 2.1. Đăng ký khuôn mặt — `POST /api/face-profiles`

```bash
curl -X POST http://localhost:3000/api/face-profiles \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "homeId=1" \
  -F "name=Nguyễn Văn A" \
  -F "image=@/path/to/photo.jpg"
```

Response `201`:
```json
{
  "id": 5,
  "homeId": 1,
  "userId": 3,
  "name": "Nguyễn Văn A",
  "imageUrl": "http://localhost:3000/uploads/faces/9f2c...-uuid.jpg",
  "isActive": true,
  "createdAt": "2026-07-27T03:00:00.000Z",
  "updatedAt": "2026-07-27T03:00:00.000Z"
}
```

Không có field `faceEmbedding` trong response (bị strip trước khi trả về).

Lỗi:
- `422` — ảnh không có khuôn mặt nào, hoặc có từ 2 khuôn mặt trở lên (message tiếng Việt, FE hiển thị trực tiếp được).
- `422` — ảnh không phải jpeg/png, hoặc lớn hơn 5MB.
- `400` — thiếu `homeId`/`name`/`image`.
- `404` — `homeId` không thuộc về user đang đăng nhập.

### 2.2. Danh sách hồ sơ — `GET /api/face-profiles?homeId=1`

```bash
curl http://localhost:3000/api/face-profiles?homeId=1 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Trả về mảng object giống response tạo ở trên (không có `faceEmbedding`).

### 2.3. Xoá hồ sơ — `DELETE /api/face-profiles/:id`

```bash
curl -X DELETE http://localhost:3000/api/face-profiles/5 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

`204 No Content`. File ảnh trên disk cũng bị xoá theo (best-effort, không throw nếu file đã mất).

### 2.4. Xác thực mở cửa — `POST /api/door-access/verify-face`

```bash
curl -X POST http://localhost:3000/api/door-access/verify-face \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "doorDeviceId=10" \
  -F "image=@/path/to/capture.jpg"
```

Response thành công (`200`):
```json
{
  "result": "success",
  "confidenceScore": 0.42,
  "faceProfileId": 5,
  "doorAccessLogId": 101,
  "deviceCommandId": "b3f1b6b0-....-uuid"
}
```
`confidenceScore` ở đây là khoảng cách Euclidean thật (càng thấp càng khớp), không phải % — giữ nguyên đơn vị so với cột `door_access_logs.confidence_score`.

Response thất bại (vẫn `200`, đây là kết quả nghiệp vụ hợp lệ chứ không phải lỗi hệ thống):
```json
{
  "result": "failed",
  "confidenceScore": null,
  "doorAccessLogId": 102
}
```

Khi `success`: backend đã tự ghi `door_access_logs` **và** tạo `device_commands` (action `open`) trong cùng request — **FE không được gọi thêm `/devices/:id/commands`** sau khi nhận `success`, chỉ cần hiển thị "Đã mở cửa" và để dashboard tự refresh qua polling sẵn có (đúng như thiết kế trong plan doc, mục 4-5).

Lỗi:
- `400` — thiếu `doorDeviceId`/`image`, hoặc device không phải loại `door`.
- `422` — ảnh không có khuôn mặt, hoặc có nhiều hơn 1 khuôn mặt (FE nên đã lọc qua liveness check trước khi gửi, nhưng BE vẫn validate lại).
- `404` — `doorDeviceId` không thuộc về user đang đăng nhập.
- `423 Locked` — Face ID đang bị khoá cho cửa này do sai quá nhiều lần (xem mục 2.6). Body lỗi có `details.lockedUntil`.

Nếu home chưa có face profile nào active, hoặc không ảnh nào khớp trong ngưỡng `FACE_MATCH_THRESHOLD` → `result: "failed"`.

### 2.5. Cảnh báo khi bị dò mặt nhiều lần

Sai **3 lần trong 2 phút** cho cùng 1 cửa → backend tự tạo:
- 1 dòng trong `alerts` (`alertType: unauthorized_access`, `severity: critical`).
- 1 dòng trong `notifications` cho chủ nhà (`channel: in_app`) — lấy qua `GET /api/alerts` / route notification sẵn có, không có API riêng cho tính năng này.

Chỉ tạo **1 alert đang active** cho mỗi cửa — nếu vẫn còn sai tiếp sau khi đã có alert (chưa `resolved`), không tạo thêm alert mới (tránh spam thông báo). Muốn nhận cảnh báo lại cho lần sau, phải đánh dấu alert cũ `resolved` qua `PATCH /api/alerts/:id` trước.

Ngưỡng (3 lần / 2 phút) đang hard-code trong `alert-evaluation.service.js` (`DOOR_FAILURE_THRESHOLD`, `DOOR_FAILURE_WINDOW_MS`), chưa có API để chỉnh qua config/`.env` — muốn đổi phải sửa code.

### 2.6. Khoá Face ID + mở bằng PIN

Sai **3 lần trong 2 phút** cho cùng 1 cửa → Face ID bị khoá **5 phút** cho cửa đó, phải dùng PIN.

**Kiểm tra trạng thái khoá** — `GET /api/door-access/face-lock-status?doorDeviceId=10`:
```bash
curl "http://localhost:3000/api/door-access/face-lock-status?doorDeviceId=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
```json
{ "doorDeviceId": 10, "locked": true, "lockedUntil": "2026-07-27T03:10:00.000Z" }
```
FE nên gọi cái này trước khi hiển thị nút Face ID (vd lúc mở màn hình unlock, hoặc sau mỗi lần verify-face thất bại) để tự disable nút + hiện message "Face ID đang bị khoá tới `lockedUntil`" thay vì để user bấm rồi mới nhận lỗi `423`.

Trong lúc bị khoá, gọi `POST /api/door-access/verify-face` sẽ trả `423` ngay (không chạy detect ảnh, không tốn ~9s) kèm `details.lockedUntil` — dùng lại giá trị này để hiển thị đếm ngược nếu muốn.

**Đặt/đổi PIN cho cửa** — `PUT /api/door-access/:doorDeviceId/pin` (thường làm 1 lần lúc setup cửa, hoặc khi chủ nhà muốn đổi PIN):
```bash
curl -X PUT http://localhost:3000/api/door-access/10/pin \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "4321"}'
```
`pin` phải là chuỗi 4-8 chữ số. Đặt PIN mới sẽ tự vô hiệu hoá PIN cũ (không cần xoá tay). Response `200`, không có field hash.

**Mở cửa bằng PIN** — `POST /api/door-access/verify-pin`:
```bash
curl -X POST http://localhost:3000/api/door-access/verify-pin \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doorDeviceId": 10, "pin": "4321"}'
```
Response thành công (`200`):
```json
{ "result": "success", "doorAccessLogId": 103, "deviceCommandId": "uuid" }
```
Response sai PIN (vẫn `200`, kết quả nghiệp vụ):
```json
{ "result": "failed", "doorAccessLogId": 104 }
```
Giống `verify-face`: `success` đã tự tạo `device_commands` mở cửa trong cùng request, FE không gọi thêm `/devices/:id/commands`.

Lỗi: `400` nếu cửa chưa có PIN nào được cấu hình (`verify-pin` trước khi gọi `verify-pin` lần nào cũng vậy cho tới khi chủ nhà set qua route ở trên).

**Lưu ý quan trọng**: mở cửa bằng PIN thành công **không** tự mở khoá lại Face ID sớm — Face ID vẫn bị khoá đủ 5 phút kể từ lần sai thứ 3, bất kể cửa có được mở bằng cách khác trong lúc đó hay không. Đây là quyết định thiết kế có chủ đích (khoá Face ID độc lập với việc cửa có mở được hay không), không phải bug.

## 3. Xem thử qua Swagger UI

```bash
npm run dev
```
Mở `http://localhost:3000/api-docs` — tất cả route (face-profiles CRUD, verify-face, face-lock-status, set-pin, verify-pin) đều có block `@openapi`, có thể "Try it out" trực tiếp kể cả upload file (Swagger UI hỗ trợ `multipart/form-data`).

## 4. Chạy test

```bash
npm test
```

Chạy toàn bộ suite, gồm `tests/face-profiles.test.js` và `tests/door-access-verify-face.test.js` (dùng ảnh fixture thật trong `tests/fixtures/`, cần DB dev đang chạy — xem `CLAUDE.md`).

Lưu ý: **lần đầu tiên trong 1 process** gọi detect ảnh sẽ chậm hơn (load model từ disk + chạy trên CPU backend thuần JS, không phải native — xem lý do trong `CLAUDE.md` mục Face ID, phần `@tensorflow/tfjs-node` không dùng được). Ước lượng ~8-10 giây/ảnh khi chạy test lần đầu trong process, các request tiếp theo trong cùng process nhanh hơn không đáng kể vì bottleneck là chính bước detect, không phải load model. Trong production, cứ mỗi lần restart server sẽ có độ trễ tương tự cho request đầu tiên.

## 5. Tune threshold trước khi FE dùng thật

Plan doc đã note rõ: `0.6` chỉ là số tham khảo. Trước khi launch:

1. Enroll vài người thật qua `/api/face-profiles`.
2. Thử verify với ảnh đúng người (nhiều điều kiện ánh sáng khác nhau) và ảnh người khác.
3. Xem `confidenceScore` trả về ở mỗi case, chỉnh `FACE_MATCH_THRESHOLD` trong `.env` sao cho tách được 2 nhóm (đúng người luôn thấp hơn threshold, người khác luôn cao hơn).
4. Restart server sau khi đổi `.env`.

## 6. Việc chưa làm (nằm ngoài scope lần build này)

- Anti-spoofing mạnh hơn blink detection phía FE (video replay, mặt nạ) — plan doc đã note để sau, chưa build. Đánh giá thêm: model đề xuất (Silent-Face-Anti-Spoofing) là PyTorch/ONNX, không có bản face-api.js/TFJS tương thích tốt — tốn nhiều công hơn các mục còn lại, cân nhắc kỹ trước khi đầu tư.
- Object storage cho ảnh enrollment (hiện lưu local disk) — chỉ cần nếu scale ra nhiều instance.
