# AI Service — Face ID (Python) — kế hoạch tương lai

**Trạng thái: chưa build, chỉ là kế hoạch để tham khảo khi bắt tay vào làm.** Không có code nào trong repo Node hiện tại phụ thuộc vào tài liệu này — `src/services/face-recognition.service.js` (face-api.js) vẫn đang chạy thật, xem `docs/FACE-ID-USAGE.md` cho tính năng đang hoạt động.

## Vì sao đổi

Face ID hiện tại (`face-api.js`, chạy trong Node) có các giới hạn:
- **Repo bị bỏ bê** — face-api.js không cập nhật từ ~2020, kẹt cứng ở `@tensorflow/tfjs-core@1.7.0`. Từng thử thêm `@tensorflow/tfjs-node` (4.x) để tăng tốc, bị crash (`forwardFunc_1 is not a function`) do xung đột version kernel — đã gỡ, xem note trong `CLAUDE.md` mục Face ID.
- **Chậm** — chạy CPU thuần JS, ~8-10 giây/lần detect, không có đường nâng cấp lên GPU/native backend nào khả thi với bản face-api.js gốc.
- **Không chống được video replay** — chỉ có blink-detection phía FE (nhẹ, dễ qua mặt bằng video quay sẵn có người chớp mắt thật). Không có anti-spoofing thật ở BE.
- **Model cũ** — embedding 128 chiều kiểu FaceNet đời đầu, độ chính xác thấp hơn nhiều so với model hiện đại như ArcFace.

**Quyết định**: xây 1 service AI riêng bằng Python (`ai-service` — repo khác, tên đề xuất), dời **toàn bộ** phần nhận diện + so khớp + liveness qua đó. Không chỉ thêm anti-spoofing riêng lẻ — gộp luôn cả face recognition, vì Python có hệ sinh thái tốt hơn hẳn (InsightFace/ArcFace, GPU support thật, activelly maintained) và tránh phải maintain 2 hệ thống AI riêng biệt (Node cho recognition, Python chỉ cho liveness).

## Kiến trúc — ai giữ việc gì

**Python (`ai-service`) — thuần AI, không state, không DB:**
- Nhận ảnh, trả kết quả AI thô (embedding, có khớp không, có sống không).
- Không tự quyết định mở cửa hay không — không biết gì về `door_access_logs`, `device_commands`, user/home.

**Node (repo này) — giữ nguyên toàn bộ business logic, không đổi:**
- Auth, ownership check (home/device thuộc user nào).
- Lưu `face_profiles` (bao gồm `face_embedding` — giờ là output từ Python, không phải tự tính).
- Lockout 5 phút sau 3 lần sai (`door-access.service.js`'s `faceLockStatus`), PIN fallback, alert `unauthorized_access`, tạo `device_commands` mở cửa.
- **Quyết định "mở cửa hay không" luôn nằm ở Node** — giữ đúng nguyên tắc bảo mật gốc của `docs/FACE-ID-PLAN-FRONTEND.md` (BE quyết định, tách rời AI-judgment và business-decision).

## API contract đề xuất

### `POST /face-id/enroll`

Input (multipart hoặc base64 JSON):
```
image: file
```

Xử lý:
1. Detect mặt — 0 hoặc >1 mặt → lỗi `422` (cùng ngữ nghĩa với `computeFaceDescriptor` hiện tại).
2. (tuỳ chọn) check chất lượng ảnh (độ mờ, kích thước tối thiểu) — báo lỗi rõ ràng nếu ảnh xấu, đỡ enroll nhầm ảnh chất lượng thấp.
3. Tính embedding qua model (ArcFace/InsightFace).

Output (`200`):
```json
{ "embedding": [0.12, -0.03, "... 512 số"] }
```

Lỗi: `422` không phát hiện mặt / nhiều hơn 1 mặt. `400` thiếu ảnh / sai định dạng.

### `POST /face-id/verify`

Input (multipart hoặc JSON, `candidates` là danh sách embedding Node lấy từ `face_profiles` của home đó):
```json
{
  "image": "<file/base64>",
  "candidates": [
    { "id": 5, "embedding": [...] },
    { "id": 7, "embedding": [...] }
  ]
}
```

Xử lý:
1. **Liveness check trước tiên** (xem mục dưới) — ảnh/video giả thì trả `isLive: false` ngay, không cần detect/embedding tiếp (đỡ phí tài nguyên).
2. Detect mặt — 0 hoặc >1 mặt → lỗi `422`, giống enroll.
3. Tính embedding ảnh vừa nhận.
4. So khoảng cách (Euclidean hoặc cosine, tuỳ model) với từng `candidates[].embedding`, lấy khoảng cách nhỏ nhất.

Output (`200`):
```json
{
  "isLive": true,
  "livenessScore": 0.94,
  "matched": { "id": 5, "distance": 0.31 }
}
```
`matched: null` nếu không ai đủ gần trong ngưỡng. Ngưỡng (threshold) — quyết định sau: để Python tự so (Node gửi kèm `threshold` trong request) hay Node tự so sau khi nhận `distance` thô (giống cách `FACE_MATCH_THRESHOLD` đang hoạt động hiện tại) — cả 2 đều hợp lý, cần chốt trước khi build.

## Model đề xuất

- **Recognition**: InsightFace (ArcFace embedding) — pretrained, không cần tự train. Cân nhắc export sang ONNX + chạy qua `onnxruntime` thay vì full PyTorch (nhẹ hơn, cold-start nhanh hơn, không cần GPU bắt buộc).
- **Liveness/anti-spoof**: MiniFASNet (từ repo `Silent-Face-Anti-Spoofing`, Minivision AI) — nhẹ, nhanh, có bản ONNX.

## Chống video replay — mạnh hơn 1 ảnh tĩnh

1 ảnh tĩnh qua MiniFASNet chưa chắc bắt được video phát lại qua màn hình điện thoại/máy tính. Cân nhắc thêm:
- Nhận **chuỗi vài frame** (3-5 frame trong ~1 giây) thay vì 1 ảnh cho `verify`.
- Check **moiré pattern** — ảnh chụp lại từ màn hình có pattern lưới đặc trưng do tần số quét màn hình, detect qua FFT (rẻ, không cần model riêng).
- Check tính nhất quán chuyển động vi mô giữa các frame (video quay lại vẫn "phẳng" 2D, thiếu độ sâu thật của mặt người).

## Việc cần làm bên Node khi tích hợp

1. `src/services/face-id-client.service.js` — gọi HTTP sang `ai-service` (base URL + API key qua `.env`, giống pattern `OHSTEM_API_BASE_URL`/`OHSTEM_API_KEY` đã reserve sẵn).
2. Thay lời gọi trong `face-profiles.service.js`'s `createFaceProfile` — thay vì gọi `faceRecognitionService.computeFaceDescriptor` (face-api.js), gọi `face-id-client.service.js` sang Python.
3. Thay lời gọi trong `door-access.service.js`'s `verifyFace` — tương tự, gọi Python `/face-id/verify` thay vì tự tính embedding + tự so khoảng cách (`faceRecognitionService.findBestMatch`/`euclideanDistance` không cần nữa nếu Python trả `matched` sẵn).
4. Sau khi xác nhận chạy ổn: gỡ `face-api.js`, `canvas`, `weights/face-api/`, `scripts/download-face-models.js` khỏi Node — dọn theo native dependency (`pango`/`librsvg` brew) không cần nữa.

## Migration — cái phải đánh đổi

- **Embedding cũ không convert được.** face-api.js ra vector 128 chiều, ArcFace ra vector khác (thường 512 chiều, không gian embedding khác hẳn). Mọi `face_profiles` đã enroll trước đó **phải enroll lại** — không có đường migrate tự động.
- Thêm network hop (Node gọi Python) — thêm latency, thêm điểm fail (Python service down → face-id không hoạt động, cần xử lý timeout/fallback rõ ràng, có thể fallback về PIN).
- Thêm 1 service phải deploy/monitor/CI riêng.

**Cách làm an toàn**: build `ai-service` xong, có contract ổn định → wire Node gọi sang qua service wrapper mới, **chạy song song** với face-api.js cũ (feature flag hoặc route riêng để test) → xác nhận chất lượng/độ trễ ổn → mới cắt hẳn, gỡ code cũ. Đừng gỡ code đang chạy trước khi cái mới verify xong.

## Câu hỏi cần chốt trước khi build

1. Ngưỡng match tính ở Node hay Python? (ảnh hưởng ai đọc `.env` `FACE_MATCH_THRESHOLD`)
2. `verify` nhận 1 ảnh hay nhiều frame? (đánh đổi độ chống-giả-mạo vs độ phức tạp FE phải gửi multi-frame)
3. Auth giữa Node ↔ Python: API key tĩnh, hay JWT ký chung secret? (API key đơn giản hơn, đề xuất dùng trước)
4. Có cần enroll lại hàng loạt (batch re-enroll script) hay để user tự enroll lại thủ công từng người?
5. Fallback khi `ai-service` down: chặn hẳn Face ID (bắt dùng PIN), hay giữ face-api.js cũ làm backup dự phòng song song vĩnh viễn?
