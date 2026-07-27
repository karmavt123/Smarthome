# Face ID — Plan cho backend

Tài liệu này mô tả FE cần gì từ backend để làm tính năng mở cửa bằng khuôn mặt (`access_method: face`), dựa trên trao đổi giữa FE và backend về kiến trúc. Đây là **đề xuất**, chưa phải API đã chốt — cần backend review, điều chỉnh, rồi confirm lại trước khi FE code theo (liên quan `BACKEND-REQUESTS.md` mục 3 và mục 5).

## Tóm tắt kiến trúc

- Model nhận diện chạy **ở backend**, không phải trình duyệt hay Yolobit. FE chỉ chụp ảnh qua camera (webcam phone/laptop hoặc camera gắn cửa) và gửi lên.
- Đề xuất dùng `face-api.js` (chạy trong Node, TensorFlow.js) — không cần Python, không cần GPU, đủ dùng cho quy mô project này:
  - Face detector: SSD MobileNet hoặc Tiny Face Detector.
  - Face recognition net: xuất embedding 128 chiều (kiểu FaceNet).
  - Face landmark 68 điểm: dùng thêm cho liveness (xem dưới).
  - So khớp: Euclidean distance giữa 2 embedding, ngưỡng ~0.6 (cần backend tự tune theo test thật).
- Embedding lưu vào `face_profiles.face_embedding` (cột đã có sẵn trong schema, kiểu LongText) — **không bao giờ trả embedding thô về FE** (đã note trong `DATABASE.md`).

## Liveness detection (chống giả mạo bằng ảnh tĩnh/ảnh in)

Chia 2 lớp, không cần thêm model riêng cho anti-spoofing (dùng luôn face landmark đã có):

1. **Lớp FE (nhẹ, lọc sớm)** — chụp liên tục vài frame trong ~2-3 giây, tính Eye Aspect Ratio (EAR) từ landmark quanh mắt để phát hiện chớp mắt. Không thấy chớp mắt trong khoảng đó → báo lỗi ngay tại FE, **không gửi ảnh lên server** (đỡ tốn round-trip cho case rõ ràng là ảnh tĩnh).
2. **Lớp BE (quyết định thật)** — nhận ảnh đã qua lớp 1, tính embedding, so khớp, ghi log. Đây là nơi quyết định mở cửa hay không, FE không tự quyết dựa trên kết quả client-side.

Nếu cần chống giả mạo mạnh hơn (video replay, mặt nạ) thì cần model anti-spoofing riêng (vd Silent-Face-Anti-Spoofing) — không nằm trong scope đề xuất này, để sau nếu cần.

## API cần backend build

### 1. `POST /api/face-profiles` — đăng ký hồ sơ khuôn mặt

Request (multipart/form-data, vì có file ảnh):
```
homeId: number
name: string
image: file (jpeg/png, 1 ảnh duy nhất — FE đã tự chọn frame tốt nhất sau khi qua liveness check)
```

Backend: chạy detector + recognition net trên `image` → tính embedding → lưu `face_profiles` (homeId, userId lấy từ token, name, face_embedding, is_active mặc định true).

Response (`201`):
```json
{
  "id": 5,
  "homeId": 39,
  "userId": 1,
  "name": "Nguyễn Văn A",
  "imageUrl": "https://.../face-5.jpg",
  "isActive": true,
  "createdAt": "..."
}
```
Không trả `faceEmbedding`. `imageUrl` là ảnh đại diện để hiển thị trong `FaceProfilesCard` (không phải ảnh dùng để so khớp).

Lỗi cần xử lý: ảnh không phát hiện được khuôn mặt nào → `422` với message rõ ràng ("Không phát hiện khuôn mặt trong ảnh, chụp lại"). Ảnh có nhiều hơn 1 khuôn mặt → tương tự, yêu cầu chụp lại.

### 2. `GET /api/face-profiles?home_id=` — danh sách hồ sơ

Response: mảng object giống response tạo ở trên (không có `faceEmbedding`).

### 3. `DELETE /api/face-profiles/:id` — xoá hồ sơ

`204 No Content`, giống pattern các route xoá khác trong hệ thống.

### 4. `POST /api/door-access/verify-face` — xác thực mở cửa bằng face (route mới, quan trọng nhất)

Request (multipart/form-data):
```
doorDeviceId: number
image: file
```

Backend:
1. Tính embedding ảnh vừa nhận.
2. Lấy toàn bộ `face_profiles` đang `is_active` của home chứa `doorDeviceId` đó.
3. So khớp Euclidean distance với từng embedding, lấy khoảng cách nhỏ nhất — dưới ngưỡng thì `success`, ngược lại `failed`.
4. **Tự ghi `door_access_logs`** (access_method: face, result, confidence_score, face_profile_id nếu match, door_device_id) — FE không tự gọi `POST /door-access/events` cho case này (tránh client tự ý ghi log/giả mạo kết quả).
5. Nếu `success`: **tự tạo `device_commands`** (action: open) cho door đó trong cùng lượt xử lý — không để FE tự gọi `/devices/:id/commands` riêng sau khi nhận `success`, vì FE không nên là nơi quyết định "verify pass thì mở cửa" (tách rời 2 bước tạo khoảng hở để giả mạo).

Response thành công (`200`):
```json
{
  "result": "success",
  "confidenceScore": 0.42,
  "faceProfileId": 5,
  "doorAccessLogId": 101,
  "deviceCommandId": "uuid-của-command-mở-cửa"
}
```
Response thất bại (`200`, không phải lỗi HTTP — đây là kết quả nghiệp vụ hợp lệ, không phải lỗi hệ thống):
```json
{
  "result": "failed",
  "confidenceScore": null,
  "doorAccessLogId": 102
}
```

FE sau khi nhận `success` chỉ cần hiển thị "Đã mở cửa" và để dashboard/device list tự refresh theo cơ chế polling sẵn có (không cần tự gọi thêm API mở cửa).

## Việc backend cần quyết định trước khi build (câu hỏi mở)

1. **Format ảnh gửi lên** — multipart file hay base64 trong JSON? Đề xuất multipart (nhẹ hơn cho ảnh), nhưng tuỳ cách backend đã setup middleware upload sẵn có (có dùng multer chưa?).
2. **Giới hạn kích thước/định dạng ảnh** — cần response lỗi rõ ràng nếu ảnh quá lớn hoặc sai định dạng.
3. **Ngưỡng threshold khoảng cách embedding** — 0.6 chỉ là con số tham khảo phổ biến của face-api.js, cần backend tự test với data thật (nhiều ảnh cùng 1 người, khác điều kiện ánh sáng) để tune lại.
4. **Gộp verify + mở cửa trong 1 API hay tách riêng?** — đề xuất gộp (mục 4 ở trên) vì lý do bảo mật đã nêu, nhưng cần backend xác nhận đồng ý với hướng này trước khi FE code `UnlockFaceId.js` theo đúng 1 API call.
5. **Rate limit / chống brute-force** — có giới hạn số lần thử `verify-face` liên tiếp cho 1 door trong khoảng thời gian ngắn không (tránh spam ảnh để dò khớp)?

## Việc FE tự làm, không cần backend

- Chụp ảnh qua `getUserMedia`, chạy liveness check (blink detection) cục bộ bằng `face-api.js` chạy client-side (chỉ dùng landmark model, nhẹ, không cần recognition net phía client) trước khi cho phép gửi ảnh lên server.
- UI enrollment (`AddFaceProfileForm.js`), UI unlock (`UnlockFaceId.js`), hiển thị `FaceProfilesCard.js` từ response BE.
