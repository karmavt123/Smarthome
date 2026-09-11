# Rà soát vòng 2 — 10/09/2026

Vòng 1 (`RA-SOAT-VA-SUA-LOI-10-09-2026.md`) soi `routes/` và `services/` của backend, cùng ba điểm bảo mật của ai-service. Vòng 2 soi **những vùng vòng 1 chưa chạm tới** — `mqtt/`, `simulator/`, `middlewares/`, `config/`, schema/index, và toàn bộ nội thất của ai-service — đồng thời **review lại chính những gì vòng 1 vừa sửa**.

**Kết quả: 23 lỗi, trong đó 3 lỗi do chính đợt sửa vòng 1 gây ra.**

---

# A. Hồi quy do vòng 1 gây ra

Phần đáng ngại nhất của báo cáo này. Cả ba đều lọt qua `node --check` vì đó chỉ là kiểm tra cú pháp.

## A1. Backend không khởi động được — `parseHistoryDate` bị xoá nhưng vẫn còn trong `module.exports`

**Trước (sau vòng 1):** vòng 1 gộp hàm parse ngày của `telemetry.service.js` vào `utils/date-range.js` và xoá bản cũ, nhưng quên dòng khai báo export:

```js
module.exports = {
  MAX_HISTORY_LIMIT,
  parseTimestamp,
  parseMessageId,
  parseHistoryDate,   // <- ham nay khong con ton tai
  validateReading,
```

**Hệ quả:** `ReferenceError: parseHistoryDate is not defined` **ngay lúc nạp module**. `telemetry.service` được `app.js` kéo vào từ đầu, nên backend chết lúc khởi động — không phải lỗi runtime ở một endpoint hiếm, mà là hệ thống không lên được.

**Sau:** bỏ dòng export (đã grep xác nhận không nơi nào import nó).

**Tại sao lọt qua vòng 1:** `node --check` chỉ phân tích cú pháp, không phân giải tham chiếu. Một `module.exports` trỏ tới định danh không tồn tại là **cú pháp hoàn toàn hợp lệ**.

**Cách chặn từ nay:** viết một bộ kiểm tra nạp module thật (`/tmp/load_check.js`) — nó thay mọi package không resolve được bằng một Proxy rỗng, rồi `require()` lần lượt **71 file** trong `src/`, và chỉ báo những lỗi phát sinh từ chính source (ReferenceError, "is not a function"). Chạy sau mỗi lượt sửa. Chính bộ này xác nhận sau khi vá thì 71/71 file nạp sạch.

## A2. `signOut` mới đi vòng qua lớp che lỗi 5xx

**Trước:** vòng 1 thêm `try/catch` để chặn lỗi 500 khi thiếu refresh token:

```js
} catch (error) {
  res.status(error.status || 500).json({ message: error.message });
}
```

**Hệ quả:** Express 5 vốn tự chuyển promise bị reject sang `error.middleware.js`, nơi **cố ý** nuốt message của mọi lỗi ≥500 (`status >= 500 ? 'Internal server error' : error.message`). Bắt lỗi tại chỗ rồi in `error.message` là đi vòng qua đúng lớp bảo vệ đó — một lỗi Prisma mất kết nối sẽ trả nguyên host/port/tên database ra client. Trớ trêu: đây đúng là loại rò rỉ mà vòng 1 vừa bịt ở `/api/health`.

**Sau:** bỏ `try/catch`, giữ lại đúng phần cần thiết là guard `if (!refresh_token) return res.status(204).send();`.

**Tại sao chọn cách này:** guard mới là thứ sửa được lỗi gốc (hash `undefined` ném TypeError). `try/catch` là phần thừa tôi thêm theo quán tính "hàm nào cũng nên có", và nó phá vỡ một quy ước đã được thiết kế có chủ đích ở tầng trên.

## A3. `decodeURIComponent` trong middleware ký URL ném lỗi → 500 mỗi lần bị quét

**Trước:**
```js
const relativePath = decodeURIComponent(req.path).replace(/^\/+/, "");
```

**Hệ quả:** một đường dẫn có escape hỏng (`/uploads/%E0%A4%A?...`) làm `decodeURIComponent` ném `URIError` → 500 + một dòng `console.error` cho **mỗi** request. Bất kỳ scanner nào cũng bơm đầy log được.

**Sau:** bọc `try/catch`, trả 401 như mọi chữ ký không hợp lệ khác.

**Tại sao 401 chứ không phải 400:** một đường dẫn không giải mã nổi thì theo định nghĩa không phải đường dẫn hệ thống đã ký. Trả cùng một câu trả lời cho mọi trường hợp "chữ ký không hợp lệ" cũng tránh việc client dò được sự khác biệt giữa các kiểu sai.

---

# B. Backend — vùng chưa soi ở vòng 1

## B1. Lockout PIN bị vô hiệu hoá hoàn toàn bởi hai đường vòng

Đây là lỗi nặng nhất vòng 2: **cơ chế khoá PIN mà vòng 1 vừa thêm gần như không bảo vệ được gì.**

**Đường vòng thứ nhất — client tự ghi một lần "thành công".**
`accessLockStatus` chỉ đếm các lần thất bại có `id` lớn hơn lần thành công gần nhất. Mà `POST /api/door-access/events` nhận thẳng `accessMethod` và `result` từ body:

```js
const accessLog = await tx.door_access_logs.create({
  data: { ..., access_method, result, ... },   // lay tu req.body
```

Kẻ tấn công có session (điện thoại bị mượn — **đúng kịch bản lockout sinh ra để chống**) chỉ cần gọi endpoint này với `{accessMethod:"password", result:"success"}` sau mỗi 3 lần đoán sai. Bộ đếm về 0, dò cạn PIN 4 số không giới hạn.

**Đường vòng thứ hai — đổi PIN không cần biết PIN cũ.**
`PUT /door-access/:id/pin` không hề yêu cầu mã hiện tại. Cùng kịch bản đó, kẻ tấn công thậm chí không cần dò: đặt PIN mới rồi mở cửa.

**Sau:**

```js
// createDoorAccessEvent
if (result === "success" && (access_method === "password" || access_method === "face")) {
  throw new HttpError(400, "A successful password/face access can only be recorded by verify-pin or verify-face");
}
```

```js
// setDoorPin — khi da co PIN
if (existingPassword) {
  const lockStatus = await accessLockStatus(device.id, "password");
  if (lockStatus.locked) throw new HttpError(423, ...);
  if (!currentPin) throw new HttpError(400, "currentPin is required to change an existing PIN");
  if (!(await bcrypt.compare(String(currentPin), existingPassword.password_hash))) {
    // ghi nhan that bai de doan PIN cu cung dinh dung lockout
    await prisma.door_access_logs.create({ ... result: "failed", failure_reason: "Incorrect current PIN on change" });
    await alertEvaluationService.evaluateDoorAccessFailures(device, "password");
    throw new HttpError(401, "Mã PIN hiện tại không đúng");
  }
}
```

**Tại sao chỉ chặn `success` mà vẫn cho ghi `failed`:** ghi thêm một lần thất bại chỉ có thể **tự khoá mình**, không thể mở đường vào. Chặn cả hai sẽ làm mất khả năng ghi nhật ký các lần thử từ nguồn khác mà không đổi lại thêm an toàn nào.

**Tại sao ghi log thất bại khi sai PIN cũ:** nếu không, endpoint đổi PIN trở thành một kênh dò PIN thứ hai không bị đếm — vá một cửa mà mở một cửa khác.

**Ảnh hưởng giao diện:** `ChangePasscodeForm` nhận thêm prop `requireCurrentPin`, hiện ô "Mã PIN hiện tại" khi đã có PIN. Test `simulator.integration.test.js` cũng được cập nhật — khẳng định cũ của nó chính là hành vi vừa bị chặn.

## B2. Guard chọn thiết bị bằng giọng nói vẫn lọt đúng ca nó mô tả

**Trước (sau vòng 1):** guard chỉ chạy khi điểm cao nhất bằng 0.

```js
if (best.score === 0 && devices.length > 1) { ... }
```

**Hệ quả:** trong tiếng Việt gần như mọi tên thiết bị đều chứa chữ "phòng". Câu *"bật đèn phòng bếp"* (không có đèn phòng bếp) khớp chữ "phong" với **cả hai** đèn → điểm 1-1, không phải 0 → guard không chạy → `sort` ổn định giữ thứ tự `id` → **bật đèn phòng khách**, báo `success`. Đúng nguyên vẹn cái bug mà comment ngay phía trên tuyên bố đã sửa.

Bộ test vòng 1 dùng `[{name:'Den phong khach'},{name:'Den RGB'}]` — tập tên mà "phòng" là duy nhất, nên test xanh trong khi lỗi vẫn còn.

**Sau:** tách hàm thuần `selectDevice(devices, normalizedText)` với điều kiện mới:

```js
const tiedAtTop = ranked.filter((entry) => entry.score === best.score).length;
if (tiedAtTop > 1 && unmatchedQualifiers(normalizedText, devices).length > 0) return null;
```

Từ chối khi **cả hai** cùng đúng: (1) câu nói có tên một nơi chốn không khớp thiết bị nào, và (2) không thiết bị nào thắng dứt khoát.

**Tại sao không đơn giản là "có từ lạ thì từ chối":** câu *"bật đèn phòng khách ngay bây giờ"* có "bay"/"gio" lạ, nhưng "phòng khách" cho điểm 2 vs 1 — thắng rõ ràng, phải cho qua. Điều kiện hoà điểm chính là thứ phân biệt "người dùng nói rõ mà mình tìm không ra" với "người dùng nói rõ và mình tìm ra rồi".

**Tại sao tách `selectDevice` ra hàm riêng:** để test được **quyết định chọn thiết bị** mà không cần DB. Trước đó chỉ test được `unmatchedQualifiers` — một mảnh của logic — nên bộ test không thể phát hiện lỗi nằm ở chỗ ghép các mảnh lại. Bộ test mới chạy 24 câu qua đúng hàm production dùng.

## B3. `sensor_readings` không có index nào cho `captured_at`

**Trước:** ba index hiện có đều theo `created_at`, trong khi **100% truy vấn nóng** lọc/sắp xếp theo `captured_at`: dashboard, environment, lịch sử, hàm gộp theo ngày mới thêm, và truy vấn "giá trị gần nhất" của simulator chạy **mỗi 5 giây cho mỗi cảm biến**.

**Hệ quả:** MySQL chỉ dùng được tiền tố `sensor_id` rồi filesort phần còn lại. Với 1 bản ghi/5 giây là ~17.000 dòng/ngày/cảm biến; 7 ngày ≈ 121k dòng phải quét cho mỗi lần vẽ biểu đồ. Và simulator tự bóp cổ chính nó: càng chạy lâu, mỗi tick càng chậm — đúng lúc demo kéo dài thì hệ thống ì nhất.

**Sau:** migration `20260910120000_add_hot_path_indexes` thêm hai index:

```sql
CREATE INDEX idx_sensor_readings_sensor_captured ON sensor_readings (sensor_id, captured_at);
CREATE INDEX idx_door_access_logs_lockout ON door_access_logs (door_device_id, access_method, result, id);
```

Index thứ hai là do code **mới** sinh ra: `accessLockStatus` chạy 2 truy vấn dạng `WHERE door_device_id=? AND access_method=? AND result=? ORDER BY id DESC` mỗi lần thử PIN — và từ khi `pin-status` báo thêm trạng thái khoá thì nó chạy theo nhịp poll 5 giây của trang An ninh. Không index cũ nào phủ được `access_method`.

**Tại sao thêm index thay vì đổi `orderBy` sang `created_at`:** `captured_at` là thời điểm cảm biến **đo**, `created_at` là thời điểm server **ghi**. Hai mốc này lệch nhau khi board gửi bù sau lúc mất mạng. Sắp xếp theo `created_at` sẽ vẽ biểu đồ theo thứ tự dữ liệu về tới server chứ không phải thứ tự sự việc xảy ra — rẻ hơn nhưng sai.

## B4. "Ngày" tính theo UTC — lệch 7 tiếng so với người đọc

**Trước:** `GROUP BY DATE_FORMAT(captured_at, ...)` gom theo ngày UTC, và `date-range.js` đẩy `to` về `setUTCHours(23,59,59,999)`. Ranh giới ngày rơi vào **07:00 sáng giờ Việt Nam**.

Comment tôi viết ở vòng 1 còn khẳng định sai: *"removes the timezone question entirely"* — thực ra nó chỉ **dời** câu hỏi sang chỗ khác.

**Hệ quả:** mọi số liệu từ 0h đến 7h sáng bị đẩy sang cột ngày hôm trước. Chọn "hôm nay" thực ra lấy từ 7h sáng hôm nay đến 6h59 sáng hôm sau.

**Sau:** thêm `REPORT_TZ_OFFSET` (mặc định `+07:00`):

```js
// date-range.js — moc ngay tho neo theo mui gio bao cao
const parsed = new Date(`${raw}T${time}${reportOffset()}`);
```
```sql
GROUP BY DATE_FORMAT(CONVERT_TZ(captured_at, '+00:00', ?), '%Y-%m-%d')
```

Frontend cũng đổi: lịch sử lệnh vốn gom theo `isoDate.slice(0,10)` (= ngày UTC) nay dùng `localDayKey()` lấy ngày theo lịch của trình duyệt, để hai biểu đồ cạnh nhau không nói hai chuyện khác nhau.

**Tại sao dùng chuỗi offset chứ không phải tên vùng `Asia/Ho_Chi_Minh`:** `CONVERT_TZ` với tên vùng cần các bảng `mysql.time_zone_*` được nạp sẵn, mà ảnh `mysql:8.0` tiêu chuẩn **không** nạp — truy vấn sẽ trả `NULL` một cách im lặng. Với chuỗi offset thì không cần bảng nào. `reportOffset()` cũng từ chối mọi giá trị không đúng định dạng `+HH:MM` và quay về mặc định, thay vì đẩy chuỗi lạ xuống SQL.

## B5. Simulator: một thiết bị lỗi giết cả vòng lặp

**Trước:** vòng `for` không có `try/catch`; `storeReadings` → `validateReading` ném `HttpError(400)` khi giá trị nằm ngoài `min_value/max_value` của cảm biến.

**Hệ quả:** hiện tại dải seed rộng hơn dải simulator sinh ra nên chưa nổ. Nhưng chỉ cần ai đó siết `max_value` của nhiệt độ xuống 30 là tick đó chết ngay tại thiết bị đầu tiên, và **mọi thiết bị mô phỏng còn lại mất bản ghi — im lặng, mọi tick, vĩnh viễn**.

**Sau:** `try/catch` bọc từng thiết bị, ghi `console.warn` kèm `device_code`.

**Tại sao cô lập theo thiết bị chứ không bọc cả vòng:** bọc cả vòng thì vẫn mất toàn bộ tick. Cô lập từng thiết bị giữ được đúng phần chạy được — một cảm biến cấu hình sai không kéo theo cả nhà.

## B6. `mqtt/client.js`: kênh phân biệt hoa thường và `messageId` trùng

**Trước:**
```js
function channelFromTopic(topic) { return topic.split('/').pop(); }   // "v1" != "V1"
...
`mqtt:${channel}:${Date.now()}`
```

**Hệ quả:** `INBOUND` khai kênh chữ hoa (`V1`). Chính `mqtt.service.js` đã ghi rõ broker chuẩn hoá feed key về chữ thường — nếu OhStem cũng vậy thì `INBOUND['v1']` là `undefined` và **toàn bộ telemetry rơi mà không có một dòng log nào**. Còn `Date.now()` làm hai bản tin cùng kênh trong cùng mili-giây đụng unique `(device_id, message_id)` → bản thứ hai bị coi là trùng lặp và bỏ im lặng.

**Sau:** `.toUpperCase()` khi tách kênh; `crypto.randomUUID()` cho messageId — đúng cách mà `mqtt.service.js` đã dùng.

**Ghi chú:** nhánh này hiện đang tắt (`.env` không đặt `MQTT_ENABLED`), nên đây là vá phòng trước, không phải lỗi đang sống.

## B7. Hai mục nhỏ ở tầng cấu hình

- **`config/env.js` không bắt buộc `AI_SERVICE_URL` / `AI_SERVICE_API_KEY`.** Thiếu chúng thì Face ID **và** giọng nói đều chết với 503 lúc chạy — đúng kiểu "boot ngon, vỡ ở request đầu tiên" mà chính comment đầu file nói là muốn tránh. Đã thêm vào danh sách bắt buộc (đã kiểm `.env` hiện tại có đủ, không làm hỏng setup đang chạy).
- **Không có 404 handler cho `/api`.** Gọi một đường dẫn sai trả về trang HTML mặc định của Express giữa một API toàn JSON — client chỉ biết parse JSON sẽ báo lỗi cú pháp khó hiểu thay vì thấy 404. Đã thêm handler trả JSON.

---

# C. ai-service — toàn bộ nội thất

## C1. `.env.example` biến câu comment thành API key thật

**Lỗi nặng nhất của ai-service.**

**Trước:**
```
AI_SERVICE_API_KEY=       # same value as Node .env AI_SERVICE_API_KEY
```

**Tại sao là lỗi:** `python-dotenv` chỉ cắt inline comment khi **có giá trị trước dấu `#`**. Với khoá để trống, toàn bộ đoạn `# same value as...` **trở thành giá trị**. Đã chạy thử với đúng dòng đó:

```
parsed key repr: '# same value as Node .env AI_SERVICE_API_KEY'
empty?  False        <- nen `if not expected` KHONG fail-closed
compare_digest match: True
```

**Hệ quả:** `README.md` của ai-service hướng dẫn `cp .env.example .env`. Ai làm theo sẽ có API key là **một chuỗi nằm sẵn trong repo**. Bất kỳ ai đọc mã nguồn đều gọi được `/api/face-id/enroll`, `/verify`, `/voice/intent`. (Đường chạy qua Docker Compose không dính vì compose set biến thật; chỉ luồng chạy local theo README mới dính.)

**Sau:** mọi comment chuyển xuống **dòng riêng**, không bao giờ nằm cùng dòng với một khoá để trống. Kèm chú thích ngay đầu file giải thích chính cái bẫy này, để lần sau không ai vô tình lặp lại.

Cùng file, `FLASK_DEBUG=true` đổi thành `false`: `run.py` bind `0.0.0.0`, nên bật debug là mở Werkzeug console ra toàn mạng LAN — cộng với API key công khai ở trên thì máy dev thành mục tiêu thật.

## C2. `/verify` không bao giờ báo "không thấy mặt" — toàn báo nhầm thành giả mạo

**Trước:** `_score_frame` trả `None` cho cả hai trường hợp 0 mặt và ≥2 mặt, rồi `compute_liveness` gộp thành `0.0`:

```python
scores = [s for s in (_score_frame(f) for f in frames) if s is not None]
if not scores:
    return 0.0          # <- "khong do duoc" tra ve nhu mot DIEM DO DUOC
```

`0.0 < LIVENESS_THRESHOLD` → route trả `isLive: false`. Mà `get_embedding()` — nơi duy nhất ném `NoFaceDetectedError`/`MultipleFacesDetectedError` — nằm **sau** cửa liveness, nên hai lỗi 422 đó là **code chết trên `/verify`**, không đường nào tới được.

**Hệ quả thật:**
- Người dùng đứng lệch khung, thiếu sáng, hoặc xa camera → nhận `liveness_failed`, tức **bị hệ thống tố là đang giả mạo**, thay vì "không thấy mặt, lại gần hơn".
- Backend `return` sớm ở nhánh liveness thất bại nên **không ghi `door_access_logs`, không lưu ảnh chụp** → lần thất bại đó biến mất khỏi lịch sử, không debug được.
- `livenessScore: 0.0` được trả ra API và ghi log như một số đo thật, trong khi model **chưa hề chạy**.

**Sau:** tách `_score_frame_detailed()` trả `(score, reason)`, thêm `evaluate_liveness()` trả `(score|None, reason|None)`; route phân biệt rõ:

```python
liveness_score, liveness_error = evaluate_liveness(frames)
if liveness_error == NO_FACE:        raise NoFaceDetectedError()
if liveness_error == MULTIPLE_FACES: raise MultipleFacesDetectedError()
```

**Tại sao giữ lại `compute_liveness()`:** `tools/measure_liveness.py` và các chỗ chỉ cần điểm số vẫn gọi được; nó thành lớp vỏ mỏng gọi `evaluate_liveness`. Không phải sửa công cụ hiệu chuẩn đã dùng để chốt ngưỡng 0.90.

**Quy tắc chọn lý do khi các khung hình khác nhau:** chỉ báo "nhiều mặt" khi **mọi** khung đều nhiều mặt; còn lại báo "không thấy mặt" — vì đó là điều hữu ích hơn để nói với người đang đứng trước camera.

## C3. `threshold` nhận `inf` → mở cửa cho người lạ

**Trước:** `float(raw)` nhận cả `"inf"`, `"nan"`, `"1e400"`, số âm — không ném `ValueError`.

**Hệ quả:** `best_distance <= inf` luôn đúng → **candidate gần nhất luôn được coi là khớp**, bất kể là ai. Với `nan` thì mọi so sánh sai → không ai khớp được. Đây là endpoint quyết định mở cửa mà nhận ngưỡng từ client không kiểm.

**Sau:** `if not math.isfinite(value) or value <= 0: raise AppError(400, ...)`.

**Tại sao chặn cả số ≤ 0:** khoảng cách Euclid luôn ≥ 0, nên ngưỡng ≤ 0 hoặc là lỗi gõ hoặc là cố tình — cả hai đều không nên đi tiếp im lặng.

## C4. Face ID chết vĩnh viễn khi nhà có từ 43 hồ sơ khuôn mặt

**Trước:** `candidates` là một field multipart **không phải file**, chứa mảng JSON toàn bộ hồ sơ đang hoạt động của nhà (~11,8 KB mỗi embedding 512 số thực). Flask 3.1 giới hạn tổng field non-file ở **500 KB** qua `MAX_FORM_MEMORY_SIZE`, mà `config.py` chỉ đặt `MAX_CONTENT_LENGTH` (10 MB).

Đo bằng đúng cặp version đang pin: `n=40 → 200`, `n=44 → 413`. Ngưỡng gãy ≈ **43 hồ sơ**.

**Hệ quả:** mọi `/verify` trả 413 **trước khi vào route**, backend dịch thành 503 "Face ID hiện không khả dụng". Face ID tắt hẳn cho nhà đó, log không chỉ ra nguyên nhân, và `MAX_CONTENT_LENGTH=10MB` trong `.env` khiến người debug tin giới hạn là 10 MB.

**Sau:** `MAX_FORM_MEMORY_SIZE` mặc định bằng `MAX_CONTENT_LENGTH` — bỏ cái trần thứ hai vô hình đi.

## C5. Một hàng dữ liệu bẩn làm sập Face ID của cả nhà

**Trước:** `_parse_candidates` chỉ kiểm `isinstance(embedding, list)` và độ dài 512, không kiểm kiểu từng phần tử. numpy ném `TypeError` với mảng chuỗi hoặc `None` → 500 → backend dịch thành 503.

**Sau:** kiểm mọi phần tử là số (loại trừ `bool`), lỗi 400 kèm `id` của candidate hỏng.

**Tại sao trả `id`:** để người vận hành tìm đúng hàng `face_profiles` cần sửa. Một lỗi 400 nói "có candidate hỏng" mà không nói cái nào thì cũng bế tắc như 500.

## C6. Whitelist định dạng ảnh vô hiệu, và không giới hạn số điểm ảnh

**Trước:**
```python
if file.content_type not in ALLOWED_CONTENT_TYPES: ...
```

`content_type` do client tự khai, mà backend Node **hard-code** `contentType: 'image/jpeg'` cho mọi khung hình bất kể bytes thật là gì. Whitelist chỉ đang kiểm một hằng số Node bịa ra. Cổng thật duy nhất là `cv2.imdecode`, vốn nhận cả BMP/TIFF/WEBP.

Nghiêm trọng hơn: **không có giới hạn số điểm ảnh**. `MAX_CONTENT_LENGTH` chỉ chặn bytes **nén** — một PNG 10 MB toàn một màu giải nén ra vài GB. gunicorn chạy `--workers 1` nên OOM giết luôn worker duy nhất; `start_period: 120s` giữ Face ID tối thêm vài phút nữa.

**Sau:** viết lại `decode_image_file` — đọc **magic bytes** để nhận dạng thật (PNG/JPEG), rồi đọc kích thước **từ header** và từ chối nếu vượt 25 MP, **trước khi** gọi `cv2.imdecode`.

**Tại sao đọc header thủ công thay vì dùng Pillow:** kiểm tra phải xảy ra **trước** khi cấp phát bộ nhớ, mà `cv2.imdecode` cấp phát ngay khi được gọi — kiểm tra sau khi decode thì đã muộn. Pillow lại không nằm trong `requirements.txt` (chỉ là phụ thuộc gián tiếp của insightface), nên tự đọc IHDR của PNG và quét marker SOF của JPEG là ~60 dòng, không thêm phụ thuộc, và tiện thể giải quyết luôn vấn đề content-type giả. Đã test 10 trường hợp: PNG/JPEG các biến thể (có/không EXIF, progressive), GIF giả danh jpeg, file rỗng, và bom 20000×20000 — tất cả xử lý đúng.

## C7. `/api/voice/intent` sập 500 với body JSON không phải object

**Trước:** `request.get_json(silent=True) or {}` — `get_json` parse **mọi** JSON hợp lệ, không riêng object. Body là `[1,2]`, `"hello"` hay `5` → `.get` ném `AttributeError` → 500 + stack trace vào log.

**Sau:** `if not isinstance(body, dict): raise AppError(400, "request body must be a JSON object")`.

## C8. Entrypoint kiểm file nguồn nhưng nạp file đích

**Trước:** vòng 1 thêm kiểm kích thước cho `model-seed/minifasnet.onnx`, nhưng vẫn copy bằng `cp -n` (không ghi đè). Nếu `$MODEL_DIR/minifasnet.onnx` đã tồn tại và **hỏng** — rất dễ xảy ra khi mount volume cho `models/` để khỏi tải lại buffalo_l — thì file hỏng được giữ nguyên, mà log vẫn in "san sang" kèm **kích thước của file nguồn**. Người vận hành thấy log xanh trong khi `/verify` trả 500.

**Sau:** viết lại — kiểm cả nguồn lẫn đích, ghi đè khi đích thiếu **hoặc** hỏng, và câu log cuối cùng luôn báo theo **file sẽ thực sự được nạp**. Thêm mặc định `MODEL_DIR="${MODEL_DIR:-/app/models}"` vì `mkdir -p ""` cộng `set -e` giết container trước khi kịp log gì.

Đã test 5 kịch bản: nguồn tốt/đích chưa có, nguồn tốt/đích hỏng, nguồn hỏng/đích chưa có, nguồn hỏng/đích tốt, không có gì cả — cả 5 báo đúng.

## C9. Ảnh sinh trắc học bị nướng vào Docker image

`.dockerignore` không loại `app/faces/` và `spoof/`, trong khi `Dockerfile` dùng `COPY . .` → **~20 MB ảnh khuôn mặt** nằm trong image production. Chính `app/faces/README.md` đã ghi *"biometric data must not be committed"* — git ignore đúng, docker context thì không. Đã thêm vào `.dockerignore` cùng với `tests/` và `tools/`.

## C10. Ba bài test xanh một cách vô nghĩa

- **`conftest.py` đọc API key từ môi trường.** Không có `.env` → key rỗng → `require_api_key` từ chối mọi thứ → các test "sai key phải 401" **pass vì lý do sai** (thay `compare_digest` bằng `return True` chúng vẫn xanh), còn các test validate thì fail với 401 thay vì 400 mong đợi. Đã ghim `TEST_API_KEY` cố định.
- **`assert 0.0 <= body["confidence"] <= 1.0`** — route chỉ trả 200 khi confidence ≥ ngưỡng, và cosine luôn ≤ 1, nên khẳng định này không thể sai. Đổi thành `>= 0.72`.
- **`assert modelsLoaded is True`** — nếu model nạp hỏng thì `create_app()` đã ném và test *error* chứ không fail. Giữ nguyên nhưng bổ sung các test có ý nghĩa thật: body không phải object → 400, threshold `inf`/`nan`/số âm → 400, embedding toàn chuỗi → 400, upload không phải ảnh → 400, và ba câu phủ định → 422.

---

# D. Sai lệch tài liệu

`README.md` (cả bản Việt lẫn Anh) vẫn ghi `LIVENESS_THRESHOLD | 0.70 | chưa hiệu chỉnh`, trong khi `.env` thật đã là `0.90` sau đợt đo 20 ảnh thật / 18 ảnh giả. Đã cập nhật cả hai bảng.

---

# E. Kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Nạp thật 71 file backend (bắt lỗi tham chiếu) | **0 lỗi** |
| `node --check` mọi file `.js` đã sửa | pass |
| `eslint src --max-warnings=0` toàn frontend | **0 lỗi, 0 cảnh báo** |
| `ast.parse` mọi file `.py` của ai-service | pass |
| `sh -n` entrypoint, `yaml.safe_load` compose | pass |
| Biến `${...}` trong compose có đủ trong `.env` | đủ |
| `selectDevice` — 26 câu (20 phải nhận, 6 phải từ chối) | **26/26** |
| `buildDateRange` + `reportOffset` | đúng cả UTC+7 lẫn khi đổi offset |
| Đọc kích thước ảnh từ header — 10 trường hợp | **10/10** |
| Entrypoint ai-service — 5 kịch bản file model | **5/5** |
| Middleware chữ ký URL (agent chạy Express thật) | 200 khi hợp lệ, 401 khi sửa path |

Chưa chạy được ở môi trường này (thiếu Docker, `node_modules` cài trên Windows): `npm test` và `pytest`. Chạy trên máy có Docker:

```powershell
docker compose up -d --build backend ai-service frontend
docker compose exec backend npx prisma migrate deploy   # 2 index moi
docker compose exec backend npm test
docker compose exec ai-service pytest -v
```

---

# F. Việc còn lại

1. **Đặt `SEED_ADMIN_PASSWORD`** — vẫn là lỗ hổng duy nhất chưa bịt hẳn (giữ mặc định `password` để không phá quy trình demo đã ghi trong tài liệu). Với B1 đã vá, đây là đường vòng cuối cùng còn lại vào cửa.
2. **Đổi mật khẩu WiFi** — chuỗi `68686868` vẫn nằm trong lịch sử git.
3. **Xoá 3 thư mục rỗng** `apps/*/docs` — shell của phiên làm việc không có quyền xoá thư mục. Git không theo dõi thư mục rỗng nên chúng sẽ tự biến mất sau commit; xoá tay cho gọn cũng được.
4. **Chuẩn hoá đầu vào model chống giả mạo** — upstream Silent-Face-Anti-Spoofing dùng `ToTensor()` (chia 255), còn code hiện tại đưa pixel thô `[0,255]`. Đồ thị ONNX không có phép chia nào để tự bù. Thực nghiệm vẫn tách được hai lớp ở ngưỡng 0.90 nên **không** xếp vào danh sách lỗi, nhưng nếu có lúc nghi ngờ độ chính xác thì đây là chỗ đo lại đầu tiên: chạy `tools/measure_liveness.py` có và không có `/255.0` rồi so biên tách.
