# Gọi ai-service từ Node/Express

Đọc trước: `docs/AI-SERVICE-FACE-ID-SPEC.md` (đầy đủ quyết định thiết kế, bảng lỗi, response shape). File này chỉ tập trung phần **Node cần code gì** để wire qua service Face ID vừa build.

Service Python **thuần AI, không business logic**: không biết ownership, lockout, PIN fallback, mở cửa — tất cả nằm ở Node. Service chỉ trả embedding / kết quả match / kết quả liveness.

## 1. Config

Node `.env`:
```
AI_SERVICE_URL=http://localhost:5001      # PORT thật của ai-service, xem .env bên đó (5000 hay bị AirPlay macOS chiếm)
AI_SERVICE_API_KEY=dev-local-face-id-key  # phải trùng AI_SERVICE_API_KEY bên ai-service .env
```

## 2. Readiness check (dùng lúc app khởi động hoặc trước khi bật tính năng Face ID)

```js
async function isFaceIdReady() {
  try {
    const res = await axios.get(`${process.env.AI_SERVICE_URL}/api/face-id/health`, { timeout: 3000 });
    return res.data.status === 'ok' && res.data.modelsLoaded === true;
  } catch {
    return false;
  }
}
```

`modelsLoaded: false` → thiếu weight MiniFASNet bên ai-service (`models/minifasnet.onnx`), báo cho ops chứ không phải lỗi Node.

## 3. Enroll — lưu embedding lúc user đăng ký khuôn mặt

```js
const FormData = require('form-data');
const axios = require('axios');

async function enrollFace(imageBuffer, filename = 'face.jpg') {
  const form = new FormData();
  form.append('image', imageBuffer, { filename, contentType: 'image/jpeg' });

  const res = await axios.post(
    `${process.env.AI_SERVICE_URL}/api/face-id/enroll`,
    form,
    {
      headers: { ...form.getHeaders(), 'X-API-Key': process.env.AI_SERVICE_API_KEY },
      timeout: 5000,
    },
  );

  return res.data.embedding; // float[512] — lưu vào cột user.face_embedding (jsonb/array)
}
```

## 4. Verify — dùng lúc mở cửa bằng Face ID

`candidates` = danh sách user đã enroll thuộc home đó (Node tự lọc theo ownership trước khi gửi — service Python không biết home/user là gì).

```js
async function verifyFace(frameBuffers, candidates, threshold) {
  const form = new FormData();
  frameBuffers.forEach((buf, i) =>
    form.append('images', buf, { filename: `frame${i}.jpg`, contentType: 'image/jpeg' }),
  );
  form.append('threshold', String(threshold)); // process.env.FACE_MATCH_THRESHOLD
  form.append('candidates', JSON.stringify(candidates)); // [{id, embedding}]

  const res = await axios.post(
    `${process.env.AI_SERVICE_URL}/api/face-id/verify`,
    form,
    {
      headers: { ...form.getHeaders(), 'X-API-Key': process.env.AI_SERVICE_API_KEY },
      timeout: 8000,
    },
  );

  return res.data; // { isLive, livenessScore, matched: {id, distance} | null, distance }
}
```

`frameBuffers`: 1-5 frame liên tiếp từ camera (không phải 1 ảnh tĩnh) — chống video replay đơn giản nhất là chính việc gửi nhiều frame.

## 5. Xử lý kết quả — logic nghiệp vụ nằm hết ở đây, không ở Python

```js
async function handleFaceIdAttempt(frameBuffers, home) {
  const candidates = await getEnrolledUsersForHome(home.id); // Node tự query DB

  let result;
  try {
    result = await verifyFace(frameBuffers, candidates, process.env.FACE_MATCH_THRESHOLD);
  } catch (err) {
    // service down / timeout / lỗi kết nối -> Face ID không khả dụng, KHÔNG tính lockout
    // (quyết định #5 trong spec: bắt FE tự chuyển qua PIN)
    return { faceIdUnavailable: true, reason: 'ai_service_unreachable' };
  }

  if (!result.isLive) {
    // giả mạo / ảnh tĩnh -> không tính lockout, log riêng để cảnh báo an ninh nếu cần
    return { faceIdUnavailable: false, matched: false, reason: 'liveness_failed', livenessScore: result.livenessScore };
  }

  if (!result.matched) {
    // chạy được, không khớp ai -> TÍNH vào đếm lockout 3 lần sai như PIN
    await incrementFailedAttempt(home.id);
    return { faceIdUnavailable: false, matched: false, reason: 'no_match' };
  }

  // matched.id -> user thật, Node tự mở cửa, ghi door_access_logs, v.v.
  return { faceIdUnavailable: false, matched: true, userId: result.matched.id, distance: result.matched.distance };
}
```

## 6. Bảng lỗi HTTP từ ai-service — map sang xử lý Node

| status | Khi nào | Node nên làm gì |
|---|---|---|
| `401` | Sai/thiếu `X-API-Key` | Bug config — key hai bên không khớp, không phải lỗi runtime bình thường |
| `400` | Node gửi thiếu field / sai format | Bug ở code Node gửi request, sửa code gọi, không phải lỗi người dùng |
| `422 No face detected` | 0 mặt trong ảnh | Trả FE "không thấy mặt, thử lại", không tính lockout |
| `422 Multiple faces detected` | ≥2 mặt trong ảnh | Trả FE "nhiều người trong khung hình", không tính lockout |
| `500` / timeout / connection refused | Service lỗi hoặc down | Coi như Face ID không khả dụng, ép dùng PIN (mục 5 ở trên), không tính lockout |

Envelope lỗi luôn `{ message, details }` — parse giống style `error.middleware.js` hiện tại của Node.

## 7. Trước khi bật thật

- Đảm bảo `AI_SERVICE_API_KEY` hai bên set đúng, không để rỗng (rỗng ở ai-service = mọi request bị 401).
- Confirm `curl $AI_SERVICE_URL/api/face-id/health` trả `modelsLoaded:true` trước khi cho phép user dùng Face ID — nếu `false`, ai-service thiếu `models/minifasnet.onnx` (xem README bên ai-service để tải).
- `timeout` nên set thấp (khuyến nghị enroll ~5s, verify ~8s) để không treo request Node lâu khi ai-service down — timeout tự nhiên rơi vào case mục 5.
