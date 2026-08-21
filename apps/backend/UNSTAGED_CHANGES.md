# Unstaged Changes — Review Notes

Ghi lại toàn bộ thay đổi chưa commit trên branch `main` tính đến 2026-07-26, để hiểu người khác đã làm gì và cách test.

## Tóm tắt 1 dòng

Thêm cả 1 tầng "IoT device protocol" mới lên trên slice `devices` sẵn có: device commands (điều khiển thiết bị có hàng đợi + timeout), telemetry (ingest chỉ số cảm biến theo batch, chống trùng lặp), alert rules/alerts, door access log, voice command parser (tiếng Việt/Anh), dashboard tổng hợp, và 1 simulator chạy nền để test toàn bộ flow không cần phần cứng Yolobit thật.

## 1. Ownership — devices giờ gắn với user

`src/services/devices.service.js`, `src/controllers/devices.controller.js`:
- `listDevices`, `getDeviceById`, `createDevice` giờ nhận `userId` (`req.user.sub`) đầu tiên, lọc theo `homes.user_id` — trước đây không lọc, ai gọi cũng thấy hết devices.
- `createDevice` verify `home_id` (và `room_id` nếu có) thuộc user đó, trả `null` -> controller trả 404 nếu không khớp.
- Pattern ownership check này được rút thành `src/services/ownership.service.js` (`requireHome`, `requireDevice`, `requireSensor`) — mọi service mới đều dùng lại.
- `tests/devices.test.js`: sửa `beforeAll` để tạo `home` gắn với `user_id` của user vừa sign-up (trước đó home không có chủ).

## 2. Schema mới (`prisma/schema.prisma` + migration `20260723090000_add_iot_device_protocol`)

- `devices` thêm cột: `api_key_hash`, `firmware_version`, `last_seen_at`.
- `device_commands` (bảng mới) — hàng đợi lệnh điều khiển: `status` (pending/delivered/executed/failed/expired), `expires_at`, `value` (JSON, cho set_speed/set_color).
- `telemetry_messages` (bảng mới) — envelope cho mỗi batch gửi lên, unique theo `(device_id, message_id)` để chống gửi trùng (idempotency).
- `sensor_readings` thêm `telemetry_message_id` (FK bắt buộc) + `captured_at` (thời điểm đo, khác `created_at` là lúc lưu vào DB).
- `device_actions.action` enum thêm `set_speed`, `set_color`.
- Migration tự backfill: mỗi `sensor_readings` cũ được gán 1 `telemetry_messages` giả `legacy-<id>`.

**Phải chạy** `npx prisma migrate deploy` (hoặc `migrate dev`) trước khi test, không thì code mới lỗi ngay do thiếu bảng/cột.

## 3. Device commands (`src/services/device-command.service.js`)

Điều khiển thiết bị = tạo command async, không phải update trực tiếp `devices.status`:
- `POST /api/devices/:id/commands` — validate action theo `device_type` (light: turn_on/turn_off/set_color, fan: turn_on/turn_off/set_speed, door: open/close), validate `value` (set_speed 0-100, set_color hex `#rrggbb`).
- Hỗ trợ idempotency key `commandId` (UUID) — gọi lại với cùng id + cùng payload trả về command cũ (`duplicate: true`); khác payload thì 409.
- Nếu thiết bị là simulated (`device_code` bắt đầu `sim-`), tự lên lịch xử lý sau `SIMULATOR_COMMAND_DELAY_MS` (mặc định 800ms), có tỉ lệ fail giả lập `SIMULATOR_COMMAND_FAILURE_RATE` (mặc định 8%).
- Command hết hạn sau `DEVICE_COMMAND_TTL_SECONDS` (mặc định 30s) nếu không ai xác nhận — được dọn bởi `expirePendingCommands`, chạy định kỳ trong simulator runtime.
- `GET /api/device-actions`, `GET /api/device-actions/:id` — xem lịch sử/trạng thái lệnh.

## 4. Telemetry (`src/services/telemetry.service.js`)

- `POST /api/telemetry/readings` — nhận `deviceId` hoặc `deviceCode`, `readings: {sensor_type: value}`, `messageId` (optional, để chống gửi trùng), `timestamp`. Validate value theo min/max của sensor, timestamp không được ở tương lai >5' hoặc quá khứ >30 ngày.
- Lưu transaction: tạo `telemetry_messages` + từng `sensor_readings`, cập nhật `devices.last_seen_at`/`connection_status = online`, rồi evaluate alert rules cho từng reading.
- `GET /api/sensors/:id/readings` — lịch sử theo `from`/`to`/`limit` (tối đa 500).
- `POST /api/devices/:id/heartbeat` — chỉ cập nhật last_seen mà không kèm reading.
- `markStaleDevicesOffline` — chạy định kỳ, set `connection_status = offline` nếu quá `DEVICE_OFFLINE_AFTER_SECONDS` (mặc định 15s) không thấy heartbeat/reading.

## 5. Alert rules & alerts (`src/services/alert-evaluation.service.js`, `alert-management.service.js`)

- `alert-evaluation.service.js`: mỗi reading mới được so với `alert_rules` đang active của sensor đó; nếu vượt ngưỡng và chưa có alert active thì tạo `alerts` + `notifications`; nếu hết vượt ngưỡng mà đang có alert active thì resolve nó.
- `alert-management.service.js`: CRUD alert rules (`GET/POST /api/alert-rules`, `PATCH /api/alert-rules/:id`) và xem/update trạng thái alerts (`GET/PATCH /api/alerts`) — có ownership check qua home.

## 6. Door access log (`src/services/door-access.service.js`)

- `POST /api/door-access/events` — ghi nhận sự kiện mở cửa (face/password/app/voice/manual), **chặn cứng** nếu payload có field `pin`/`password` (không cho log plaintext). Cần `faceProfileId` nếu access_method = face. Nếu `result: success` thì update `devices.status = open`.
- `GET /api/door-access/events` — danh sách log, filter theo device/result/method.

## 7. Voice command (`src/services/voice-command.service.js`)

- `POST /api/voice-commands` — parse câu tiếng Việt không dấu hoặc tiếng Anh (vd: "bat den phong khach", "turn on fan"), nhận diện device_type (đèn/quạt/cửa) + action, rồi match tên device gần nhất trong nhà user (chấm điểm theo số từ trùng tên phòng/thiết bị). Nếu nhận diện được thì gọi `createDeviceCommand` (control_method = voice); nếu không thì lưu `voice_commands` với `execution_status: unknown_command`.

## 8. Dashboard (`src/services/dashboard.service.js`)

- `GET /api/dashboard?home_id=` — trả snapshot: thông tin nhà, phòng, mọi sensor kèm giá trị mới nhất + 12 điểm lịch sử, danh sách devices (kèm cờ `is_simulated`/`simulation_paused`), alerts gần nhất, và `environment_status` tổng hợp (safe/warning/critical dựa theo severity của alert đang active).

## 9. Simulator (`src/simulator/`, `src/controllers/simulator.controller.js`)

Mô phỏng 1 nhà ảo để test không cần board thật:
- `POST /api/simulator/bootstrap` — tạo (idempotent, dùng upsert) 1 "Simulation Home" với 1 phòng, 4 thiết bị (`sim-<userId>-environment/light/fan/door`), 3 sensor (temperature/humidity/light) + alert rules mẫu + demo face profile + door access log mẫu.
- `PATCH /api/simulator/devices/:id/connectivity` — pause/resume 1 thiết bị mô phỏng (giả lập mất kết nối).
- `src/simulator/runtime.js` — khởi động cùng `server.js` (`simulatorRuntime.start()`), chạy các interval nền: gửi heartbeat cho device sim (mỗi `DEVICE_HEARTBEAT_SECONDS`, mặc định 5s), sinh reading ngẫu nhiên cho sensor sim (mỗi `SIMULATOR_READING_SECONDS`, mặc định 5s, dùng random-walk trong `sensor-values.js`), quét device offline, quét command hết hạn. Dừng sạch khi `SIGINT`/`SIGTERM` (`simulatorRuntime.stop()`).
- Tắt hoàn toàn bằng `SIMULATOR_ENABLED=false`.

## 10. Hạ tầng nhỏ khác

- `src/middlewares/error.middleware.js` — error handler tập trung, mount cuối `app.js`. Mọi service mới ném `HttpError` (`src/utils/http-error.js`, có `status`/`details`) thay vì tự try/catch trong controller.
- `src/utils/serialize.js` — convert `BigInt` → `Number`, Prisma `Decimal` → `Number` trước khi `res.json` (JSON.stringify không tự serialize được BigInt).
- `src/server.js` — tách `shutdown()`, lắng nghe `SIGINT`/`SIGTERM` để dừng simulator runtime sạch sẽ khi tắt server.
- `package.json` — thêm script `test:simulator` chạy riêng nhóm test simulator/alert/voice.

## Cách test

### 0. Chuẩn bị
```bash
nvm use
npm install
npx prisma migrate deploy   # bắt buộc — có bảng/cột mới
npm run dev                 # hoặc npm start
```
Kiểm tra `.env` đã có `DATABASE_URL` trỏ vào DB MySQL dev có thể xóa/ghi tự do (test không cô lập DB).

### 1. Chạy test tự động
```bash
npm test                # toàn bộ, gồm auth + devices (đã sửa để tạo home có chủ)
npm run test:simulator  # riêng: simulator-values, alert-evaluation, voice-parser, simulator.integration
```
Đây là integration test thật (Supertest + DB thật qua Prisma), không mock — xem có Jest nào fail do thiếu migration hoặc DB chưa chạy không.

### 2. Test tay qua flow simulator (nhanh nhất để thấy toàn bộ tính năng chạy)
1. Sign-up/sign-in lấy `accessToken` (`POST /api/auth/sign-up` hoặc `/sign-in`).
2. `POST /api/simulator/bootstrap` (Bearer token) — tạo nhà ảo + 4 thiết bị + sensor.
3. `GET /api/dashboard` — xem environment/devices/alerts vừa tạo.
4. Đợi vài giây (server đang chạy, interval nền tự sinh reading) rồi gọi lại `/api/dashboard` — thấy `history` sensor tăng dần, nếu random đi ra ngoài ngưỡng (vd temperature > 30) thì `alerts` xuất hiện.
5. `POST /api/devices/:lightId/commands` với `{"action":"turn_on"}` — nhận `status: pending`, đợi ~800ms rồi `GET /api/device-actions/:commandId` — thấy chuyển `executed` (hoặc `failed` ~8% do giả lập lỗi ngẫu nhiên), `devices.status` đổi thành `on`.
6. `POST /api/voice-commands` với `{"recognizedText":"bat den phong khach"}` — kiểm tra parse đúng, queue command cho đèn.
7. `PATCH /api/simulator/devices/:doorId/connectivity` `{"paused": true}` rồi thử gửi command cho door — phải fail vì "Device is offline".
8. `POST /api/door-access/events` thử gửi kèm field `pin` — phải bị chặn 400.
9. Test lại `GET /api/devices` với 2 user khác nhau — xác nhận user A không thấy device của user B (đây là thay đổi ownership quan trọng nhất, dễ regression).

### Điểm cần chú ý khi review/test
- Ownership check dựa vào `req.user.sub` — nếu JWT payload đổi field này thì toàn bộ ownership.service.js hỏng, nên test kỹ auth trước.
- `device_commands`/`telemetry_messages` có FK `ON DELETE CASCADE` từ `devices` — xóa device sẽ mất luôn lịch sử lệnh/telemetry, cân nhắc có phải hành vi mong muốn không.
- Simulator interval dùng `timer.unref()` nên không giữ process sống — nhưng vẫn chạy song song mọi lúc server chạy dev/test, có thể gây race nếu chạy `npm test` cùng lúc server dev đang bật (cùng DB).
