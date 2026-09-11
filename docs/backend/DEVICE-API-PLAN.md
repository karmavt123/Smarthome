# Device API — Kế hoạch hiện thực tầng thiết bị

**Trạng thái: đề xuất, chưa build.**

Mục tiêu: mở một mặt API riêng cho **thiết bị/gateway** (không phải người dùng), để board Yolo:Bit thật gửi được telemetry lên và nhận được lệnh xuống. Đây là mảnh còn thiếu duy nhất giữa backend hiện tại và một hệ thống IoT chạy thật.

Nguyên tắc xuyên suốt: **không đụng vào code hiện có**. Toàn bộ business logic (telemetry ingest, alert evaluation, command lifecycle) đã đúng rồi — việc ở đây chỉ là mở thêm một cửa vào với cơ chế xác thực khác.

---

## 1. Bối cảnh: tại sao cần

### Vấn đề hiện tại

| Thứ đang có | Vấn đề |
|---|---|
| `POST /api/telemetry/readings` | Gắn `requireAuth` → cần JWT **của user**. Gateway không có tài khoản người dùng. |
| `POST /api/devices/:id/commands` | Cũng `requireAuth`. Đây là cửa để *user* ra lệnh, không phải cửa để *thiết bị* nhận lệnh. |
| `devices.api_key_hash` (`Char(64)`) | Có trong schema từ migration `20260723090000_add_iot_device_protocol`, **chưa có dòng code nào dùng**. |
| `device_commands.status = 'delivered'` | Không có đường nào để set. Chỉ `pending → executed/failed/expired` qua simulator. |
| `device_commands.delivery_attempts` | Luôn bằng 0. |
| Index `idx_device_commands_poll` | Đặt tên là "poll" nhưng không có endpoint poll nào tồn tại. |

Nói cách khác: **schema đã thiết kế đúng cho thiết bị thật, chỉ là chưa ai nối dây vào.**

### Kiến trúc mục tiêu

```
┌──────────────┐   MQTT    ┌─────────────┐   MQTT    ┌──────────────────┐
│  Yolo:Bit    │ ────────► │  Adafruit   │ ────────► │  Gateway Python  │
│  (ESP32)     │ ◄──────── │     IO      │ ◄──────── │  (laptop / Pi)   │
└──────────────┘           └─────────────┘           └────────┬─────────┘
                                                              │
                                            HTTP + X-Device-Key
                                                              │
                                                     ┌────────▼─────────┐
                                                     │  Node backend    │
                                                     │  /api/device/*   │
                                                     └──────────────────┘
```

Gateway giữ **một** device key duy nhất (nó đại diện cho cả cụm phần cứng), hoặc nhiều key nếu muốn tách từng thiết bị. Xem §6 để chọn.

---

## 2. Xác thực thiết bị — `deviceAuth` middleware

### Cơ chế

Dùng lại đúng pattern của `refresh_tokens` đang có: **lưu hash, không lưu plaintext**.

- Key sinh ngẫu nhiên 32 byte → hex 64 ký tự → đây là plaintext, trả về **đúng một lần** lúc tạo.
- Lưu `sha256(plaintext)` vào `devices.api_key_hash` (`Char(64)` — vừa khít SHA-256 hex).
- Thiết bị gửi kèm header `X-Device-Key: <plaintext>` mỗi request.

Dùng SHA-256 chứ không bcrypt (khác với `door_passwords`) vì:

- Key là 256-bit ngẫu nhiên, không phải mật khẩu người chọn → không có gì để brute-force
- Middleware này chạy trên **mọi** request telemetry (5s/lần/thiết bị) — bcrypt cost 10 tốn ~100ms/lần, quá đắt
- Đây đúng là lý do `refresh_tokens` cũng dùng SHA-256

### File mới: `src/middlewares/device-auth.middleware.js`

```js
const crypto = require('crypto');
const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');

function hashDeviceKey(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

async function requireDeviceAuth(req, res, next) {
  try {
    const key = req.headers['x-device-key'];
    if (!key) throw new HttpError(401, 'Missing device key');

    const device = await prisma.devices.findFirst({
      where: { api_key_hash: hashDeviceKey(key) },
      include: { homes: true },
    });
    if (!device) throw new HttpError(401, 'Invalid device key');

    req.device = device;      // song song với req.user của requireAuth
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireDeviceAuth, hashDeviceKey };
```

**Lưu ý thiết kế:**

- `req.device` chứ không phải `req.user` — hai loại principal khác nhau, không được lẫn. Service nào nhận `req.device` thì **không** gọi `ownership.service.js` (device đã tự chứng minh danh tính của chính nó, không cần check nó thuộc về ai).
- Ném `HttpError` để `error.middleware.js` xử lý — nhất quán với phần còn lại của codebase, không `res.status().json()` trực tiếp như `auth.middleware.js` đang làm.
- `include: { homes: true }` để có sẵn `home_id` cho các service phía sau, khỏi query lại.

### Quản lý key (route cho user, không phải cho device)

Thêm vào `devices.routes.js`:

```
POST /api/devices/:id/rotate-key    (requireAuth)
```

- Sinh key mới, ghi đè `api_key_hash`, trả `{ deviceKey: "<plaintext>" }`
- Response có comment/field cảnh báo rõ: đây là lần duy nhất thấy được key này
- Gọi lại = key cũ chết ngay (rotation, cùng ý tưởng với `door_passwords` và `refresh_tokens`)
- Cần `requireDevice(userId, id)` để check ownership trước

---

## 3. Bốn endpoint mới

Tất cả mount dưới prefix `/api/device` (số ít — phân biệt rõ với `/api/devices` là CRUD cho user). File mới: `src/routes/device-gateway.routes.js`.

### 3.1 `POST /api/device/telemetry`

Thiết bị gửi số đo lên.

**Request** (`X-Device-Key` bắt buộc):
```json
{
  "messageId": "a3f2-0091",
  "capturedAt": "2026-08-09T10:23:11Z",
  "readings": { "temperature": 28.5, "humidity": 71, "light": 340 }
}
```

**Xử lý:** gọi thẳng `telemetry.service.js`'s `ingestReadings`, truyền `req.device.id` thay vì resolve từ `deviceCode`. Toàn bộ logic sau đó **giữ nguyên**: validate min/max theo `sensors`, chống trùng qua `uq_telemetry_device_message`, update `last_seen_at` + `connection_status`, chạy `evaluateReading` cho alert rules.

> **Việc cần làm:** tách `ingestReadings` hiện tại thành 2 lớp — một hàm lõi nhận `deviceId` đã xác định, và lớp ngoài (cho user route) lo resolve `deviceCode` + ownership. Device route gọi thẳng lõi. Không copy-paste logic.

**Response:** `201 { telemetryMessageId, readingsAccepted, alertsRaised }`

- `alertsRaised` là bonus hữu ích: gateway có thể tự đẩy lên LCD của board dòng "CANH BAO: 32°C" mà không cần query lại.

**Mã lỗi:** `401` key sai · `409` `messageId` trùng (idempotent, không phải lỗi thật — trả về row cũ) · `422` giá trị ngoài `min_value`/`max_value` của sensor

---

### 3.2 `GET /api/device/commands/pending`

Thiết bị hỏi "có lệnh gì cho tôi không".

**Response:**
```json
{
  "commands": [
    { "id": "uuid", "action": "turn_on", "value": null, "expiresAt": "..." },
    { "id": "uuid", "action": "set_speed", "value": 60, "expiresAt": "..." }
  ]
}
```

**Xử lý:**
1. Query `device_commands` where `device_id = req.device.id`, `status = 'pending'`, `expires_at > now()`, order by `created_at` — chính là index `idx_device_commands_poll` đang có sẵn.
2. Với mỗi command trả về: set `status = 'delivered'`, `delivered_at = now()`, `delivery_attempts += 1`. **Đây là chỗ duy nhất `delivered` từng được set** — trạng thái đó cuối cùng cũng có ý nghĩa.
3. Đồng thời update `last_seen_at` — poll cũng tính là heartbeat, khỏi cần gọi 2 request.

**Vì sao poll chứ không push:** board ESP32 giữ HTTP long-poll/WebSocket không ổn định. Poll 2–3s/lần đơn giản, chịu được mất mạng, và `expires_at` (30s) đã bảo vệ khỏi lệnh cũ chạy muộn. Nếu sau này dùng MQTT hai chiều thì Gateway poll thay board, độ trễ vẫn nằm ở Gateway↔Node (LAN, ~ms).

**Điểm cần chú ý:** `delivered` **không** có nghĩa là đã thực thi. Nếu board nhận lệnh rồi mất điện, command nằm ở `delivered` cho tới khi `expirePendingCommands` quét — job đó đã lọc `status: { in: ['pending','delivered'] }` nên xử lý đúng sẵn rồi, không cần sửa.

---

### 3.3 `POST /api/device/commands/:id/ack`

Thiết bị báo đã làm xong (hoặc thất bại).

**Request:** `{ "status": "executed" }` hoặc `{ "status": "failed", "failureReason": "servo jammed" }`

**Xử lý:** gọi thẳng `finalizeCommand(id, status, failureReason)` trong `device-command.service.js` — hàm này **đã làm đúng hết mọi thứ** rồi:

- Guard chống ack hai lần (`if (!command || [...].includes(command.status)) return`)
- Transaction: update command → update `devices.status` qua `deviceStatusAfter()` → ghi `device_actions`
- Publish SSE `device_status` sau khi commit → **frontend tự cập nhật realtime, không phải sửa một dòng FE nào**

Chỉ cần thêm **một** check trước khi gọi: `command.device_id === req.device.id` (chống thiết bị A ack lệnh của thiết bị B) → `403` nếu lệch.

Đây là endpoint có tỉ lệ giá trị/công sức cao nhất trong cả kế hoạch: ~20 dòng code, và nó làm cho toàn bộ chuỗi *user bấm nút → SSE báo về → UI đổi trạng thái* chạy với phần cứng thật.

---

### 3.4 `POST /api/device/heartbeat`

`{ "firmwareVersion": "1.2.0" }` (optional) → update `last_seen_at`, `connection_status = 'online'`, `firmware_version`.

Chỉ cần khi thiết bị im lặng lâu (ví dụ cửa không có sensor nào, cả tiếng không có telemetry). `markStaleDevicesOffline` (`DEVICE_OFFLINE_AFTER_SECONDS`, mặc định 15s) sẽ đánh nó offline oan nếu không có cái này.

> **Cân nhắc ngưỡng:** 15s là hợp cho simulator sinh reading mỗi 5s. Với phần cứng thật qua Adafruit (rate limit ~30 điểm/phút) thì nên nới lên **60s** và giãn nhịp gửi telemetry ra 15–20s. Đây là biến env, đổi một dòng.

---

## 4. Refactor simulator — quan trọng hơn vẻ ngoài

**Vấn đề hiện tại:** `src/simulator/runtime.js` gọi thẳng các hàm service, ghi trực tiếp vào DB. Nghĩa là **đường đi của thiết bị thật chưa từng được chạy thử lần nào.** Cắm board vào là ngày đầu tiên đường đó được dùng — thường là ngày demo.

**Đề xuất:** biến simulator thành một *client giả* của chính device API.

```
Trước:  runtime.js ──► telemetry.service.js ──► DB
Sau:    runtime.js ──► HTTP POST /api/device/telemetry ──► DB
```

Cụ thể:

1. `simulator.service.js`'s `bootstrap` sinh sẵn device key cho 4 thiết bị `sim-*`, giữ trong memory của runtime (chỉ simulator mới được biết plaintext).
2. `runtime.js` dùng `axios` gọi `http://localhost:${PORT}/api/device/*` thay vì import service.
3. Vòng lặp command đổi từ `scheduleSimulatedCommand` (setTimeout nội bộ) sang: poll `GET /commands/pending` → chờ `SIMULATOR_COMMAND_DELAY_MS` → `POST /ack` với `status` random theo `SIMULATOR_COMMAND_FAILURE_RATE`. Hành vi bên ngoài **giống hệt** hiện tại, nhưng đi qua đúng đường thật.

**Được gì:**

- Mọi test đang pass = bằng chứng đường thiết bị thật hoạt động
- Rút simulator ra, cắm Gateway vào → không cần đổi gì ở Node
- Bỏ được `isDevicePaused()` in-memory hack — "mất kết nối" chỉ là simulator ngừng gọi API, y như board thật rút điện. Chân thật hơn nhiều.
- Gỡ được cái mùi khó chịu: simulator hiện đang là code production import code test

**Chi phí:** ~150 dòng đổi trong `src/simulator/`, không đụng gì ngoài thư mục đó.

**Rủi ro:** runtime gọi HTTP vào chính process của mình → phải đảm bảo `server.js` `listen()` xong mới `simulatorRuntime.start()`. Hiện tại start ngay, cần đổi thứ tự (đưa vào callback của `listen`).

---

## 5. Firmware & Gateway — hợp đồng giao tiếp

### Topic MQTT (chốt với team firmware trước khi ai code)

| Chiều | Topic | Payload |
|---|---|---|
| Board → Gateway | `<user>/feeds/yolohome-telemetry` | `{"t":28.5,"h":71,"l":340}` |
| Gateway → Board | `<user>/feeds/yolohome-command` | `{"id":"<uuid8>","a":"turn_on","d":"light"}` |
| Board → Gateway | `<user>/feeds/yolohome-ack` | `{"id":"<uuid8>","ok":true}` |

Key viết tắt vì Adafruit giới hạn độ dài payload và ESP32 parse JSON tốn RAM. Gateway dịch sang tên đầy đủ khi gọi Node.

`<uuid8>` = 8 ký tự đầu của command UUID. Gateway giữ map `uuid8 → uuid đầy đủ` trong dict, board không phải nhớ chuỗi 36 ký tự.

### Gateway Python — khung file

```
gateway/
├── config.py           # đọc .env: ADAFRUIT_*, BACKEND_URL, DEVICE_KEY, TRANSPORT
├── adapters/
│   ├── base.py         # interface: read_telemetry(), send_command(), on_ack()
│   ├── mqtt_adapter.py # paho-mqtt, dùng thường ngày
│   └── serial_adapter.py  # pyserial, dự phòng khi WiFi hỏng
├── backend.py          # requests wrapper, gắn X-Device-Key, retry có backoff
├── main.py             # vòng lặp: poll commands (2s) + forward telemetry + forward ack
└── requirements.txt
```

Hai adapter cùng interface, chọn bằng `GATEWAY_TRANSPORT=mqtt|serial`. Thêm khoảng 50 dòng, đổi lại là **bảo hiểm cho buổi demo** — WiFi trường sập thì cắm cáp USB, đổi một biến env, chạy tiếp.

**Throttle:** Adafruit free tier ~30 data point/phút. Với 3 sensor thì tối đa 10 lần gửi/phút → **6s/lần là trần**, nên đặt 15s cho an toàn. Gateway phải tự gom (debounce), không để board spam.

---

## 6. Quyết định cần chốt trước khi code

| # | Câu hỏi | Đề xuất | Lý do |
|---|---|---|---|
| 1 | Một device key cho cả cụm, hay mỗi thiết bị một key? | **Mỗi thiết bị một key** | Schema đã đặt `api_key_hash` trên `devices` chứ không phải bảng gateway riêng — đi theo schema. Gateway giữ 4 key trong `.env`, không phiền gì. |
| 2 | Gateway có tự đăng ký thiết bị không? | **Không** — user tạo device trên web rồi copy key vào Gateway | Auto-provisioning là lỗ hổng bảo mật và không cần cho đồ án. |
| 3 | Poll interval? | **2s** cho command, **15s** cho telemetry | Command cần nhạy (bấm nút phải thấy đèn sáng), telemetry bị chặn bởi rate limit Adafruit. |
| 4 | `DEVICE_OFFLINE_AFTER_SECONDS` | Nâng **15 → 60** | Nhịp telemetry thật chậm hơn simulator nhiều. |
| 5 | Có giữ user route `POST /api/telemetry/readings` không? | **Có, giữ** | Tiện cho test tay qua Swagger và Postman. Không hại gì. |

---

## 7. Thứ tự làm & ước lượng

| # | Việc | Ước lượng | Chặn ai |
|---|---|---|---|
| 1 | `device-auth.middleware.js` + `rotate-key` | 2h | — |
| 2 | `POST /api/device/telemetry` (tách lõi `ingestReadings`) | 3h | #1 |
| 3 | `GET /commands/pending` + `POST /:id/ack` | 3h | #1 |
| 4 | Swagger `@openapi` cho 4 route mới | 1h | #2, #3 |
| 5 | Test: `tests/device-api.test.js` | 3h | #2, #3 |
| 6 | Refactor simulator đi qua HTTP | 4h | #2, #3 |
| 7 | Gateway Python (mqtt adapter) | 1 ngày | #2, #3 — **làm song song được** |
| 8 | Firmware Yolo:Bit pub/sub | 1 ngày | chốt topic ở §5 — **song song được** |
| 9 | Serial adapter dự phòng | 3h | #7 |

**Tổng phía Node: ~2 ngày công.** Việc #7 và #8 chạy song song ngay khi hợp đồng ở §5 được chốt — không cần chờ Node xong.

Đường tới hết-cần-lo-lắng: xong #1→#3 là board thật gửi được dữ liệu lên và nhận được lệnh. Đó là **Module 1 + Module 3 với phần cứng thật**, tức là qua được yêu cầu demo giữa kỳ.

---

## 8. Test cần viết (`tests/device-api.test.js`)

Theo đúng khuôn các file test hiện có (Supertest + DB thật, tự dọn trong `afterAll`):

- Key sai / thiếu header → `401`
- Telemetry hợp lệ → tạo `telemetry_messages` + `sensor_readings`, `last_seen_at` được cập nhật
- Cùng `messageId` gửi 2 lần → không tạo row trùng
- Telemetry vượt ngưỡng `alert_rules` → có `alerts` row (chứng minh alert engine chạy qua đường thiết bị)
- `pending` → command đổi sang `delivered`, `delivery_attempts` tăng
- Device A ack command của device B → `403`
- Ack 2 lần → lần 2 không đổi gì (idempotent)
- Ack `executed` → `devices.status` đổi đúng theo `deviceStatusAfter()`
