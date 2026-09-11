# P1 — Checklist fix nhỏ

Những thứ rẻ, làm nhanh, nhưng bỏ qua thì hoặc mất điểm khi chấm, hoặc gây tai nạn đúng hôm demo. Xếp theo **giá trị / công sức**, cao nhất trước.

Mỗi mục có: vấn đề → tại sao quan trọng → cách sửa cụ thể → ước lượng.

---

## 1. 🔴 Xoá `console.log` đang in access token ra terminal

**Ước lượng: 1 phút.** Làm ngay khi đọc xong dòng này.

`src/middlewares/auth.middleware.js:5`:

```js
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  console.log("header", header);   // ← in nguyên bearer token của mọi request
```

**Tại sao quan trọng:** mọi JWT của mọi user bị in ra log, mỗi request một dòng. Nếu quay màn hình khi demo hoặc nộp log kèm báo cáo là lộ token. Ngoài ra `morgan('dev')` đã log request rồi, dòng này không thêm thông tin gì.

**Sửa:** xoá dòng đó. Xong.

Tiện thể grep luôn cả repo xem còn `console.log` debug nào sót:

```bash
grep -rn "console\.log" src/ | grep -v "server.js"
```

---

## 2. 🔴 Fail-fast khi thiếu biến môi trường

**Ước lượng: 20 phút.**

**Vấn đề:** server khởi động bình thường với `JWT_ACCESS_SECRET` rỗng. `jwt.sign(payload, undefined)` ném lỗi lúc **runtime**, ở request đầu tiên — tức là lỗi xuất hiện giữa buổi demo chứ không phải lúc boot. Tệ hơn: `.env.example` để trống sẵn cả `JWT_ACCESS_SECRET` lẫn `JWT_REFRESH_SECRET`, nên thành viên mới copy về là dính ngay.

**Sửa:** file mới `src/config/env.js`, gọi ở đầu `src/server.js` (trước cả `require('./app')`):

```js
const REQUIRED = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

// Optional nhưng nếu thiếu thì tính năng chết âm thầm — cảnh báo, không chặn boot
const RECOMMENDED = ['AI_SERVICE_URL', 'AI_SERVICE_API_KEY'];

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n✖ Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
    console.error('  Copy .env.example sang .env và điền đầy đủ.\n');
    process.exit(1);
  }

  const weak = RECOMMENDED.filter((k) => !process.env[k]);
  if (weak.length) {
    console.warn(`⚠ Thiếu ${weak.join(', ')} — Face ID và voice command sẽ trả 503.`);
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error('✖ JWT_ACCESS_SECRET và JWT_REFRESH_SECRET không được trùng nhau.');
    process.exit(1);
  }
}

module.exports = { validateEnv };
```

**Bonus ăn điểm:** cái warning về `AI_SERVICE_*` giải thích thẳng hậu quả ("sẽ trả 503") — đúng tinh thần error message tốt, và cứu được cả buổi debug khi Face ID im lặng không chạy.

---

## 3. 🟠 Tách DB test khỏi DB dev

**Ước lượng: 30 phút.**

**Vấn đề:** `CLAUDE.md` tự thừa nhận — *"No test DB isolation yet, so don't point `DATABASE_URL` at a DB with data you can't afford to touch."* Test là integration thật, tạo và xoá row trên **chính DB dev**. Chạy nhầm `npm test` trước buổi demo = mất sạch nhà/thiết bị/lịch sử vừa dựng.

Rủi ro kép: `UNSTAGED_CHANGES.md` cũng ghi nhận simulator interval chạy song song khi server dev đang bật → race điều kiện với test trên cùng DB.

**Sửa:**

1. Thêm `DATABASE_URL_TEST` vào `.env.example`, trỏ vào DB riêng (`smart_home_test`)
2. File mới `tests/setup.js`:
   ```js
   process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
   process.env.SIMULATOR_ENABLED = 'false';   // test không cần interval nền
   ```
3. `jest.config.js`: thêm `setupFiles: ['<rootDir>/tests/setup.js']`
4. Thêm script: `"test:setup-db": "DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy"`

**Guard rail nên có thêm:** trong `tests/setup.js`, nếu tên DB **không** kết thúc bằng `_test` thì `throw` luôn. Ngăn cứng việc chạy test vào DB thật kể cả khi ai đó cấu hình nhầm.

---

## 4. 🟠 Thêm `helmet` + `express-rate-limit`

**Ước lượng: 30 phút.** Đây là mục ăn điểm rõ nhất trong danh sách.

**Tại sao:** kế hoạch môn học tuần 3 yêu cầu *"các yêu cầu phi chức năng (**đo được**)"*. Hiện tại chưa có NFR nào cụ thể trong repo. Rate limit là NFR đo được đúng nghĩa — viết vào báo cáo được ngay: *"Chống brute-force: tối đa 5 lần đăng nhập sai / 15 phút / IP"*.

```bash
npm i helmet express-rate-limit
```

Trong `src/app.js`:

```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());

// Đăng nhập / đăng ký — chống dò mật khẩu
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { message: 'Quá nhiều lần thử, vui lòng đợi 15 phút' },
}));

// Mở cửa — chống dò PIN. Chặt hơn cả login.
app.use('/api/door-access/verify-pin', rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
}));

// Trần chung
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));
```

**Lưu ý:** `helmet()` mặc định bật `contentSecurityPolicy` có thể chặn Swagger UI ở `/api-docs`. Nếu vỡ thì mount `helmet` **sau** dòng Swagger, hoặc `helmet({ contentSecurityPolicy: false })`.

**Lưu ý 2:** trần chung 300 req/phút phải đủ chỗ cho device polling ở [DEVICE-API-PLAN.md](./DEVICE-API-PLAN.md) — 4 thiết bị × poll 2s = 120 req/phút. Nếu làm device API thì cho `/api/device/*` một limiter riêng rộng hơn, đừng để chung.

**Bonus:** viết luôn một bảng NFR nhỏ trong báo cáo (thời gian phản hồi API < 200ms, rate limit như trên, TTL command 30s, lockout Face ID 5 phút) — mấy con số này **đã tồn tại trong code sẵn rồi**, chỉ là chưa ai viết ra thành tài liệu.

---

## 5. 🟠 Thêm cột `alerts.device_id`

**Ước lượng: 45 phút.**

**Vấn đề:** hiện không có cách liên kết một alert với thiết bị gây ra nó. `alert-evaluation.service.js` phải **nhét chuỗi `[door:<id>]` vào giữa `message` text** rồi dùng `contains` để dedup. `CLAUDE.md` ghi rõ lý do: *"there's no `device_id` column on `alerts`, so the door is tagged inline in the message text instead of a schema change"*.

**Tại sao đáng sửa:**

- Dedup bằng substring search trên cột `Text` → không dùng được index, và sẽ hỏng nếu ai đó đổi format message
- Không query được "cho tôi mọi alert của cái cửa này" — một câu hỏi hoàn toàn bình thường
- **GV chấm phần thiết kế CSDL sẽ soi cái này.** Nhét khoá ngoại vào text là lỗi thiết kế kinh điển, và nó nằm ngay trong bảng trung tâm của Module 2.

**Sửa:**

```prisma
model alerts {
  // ...
  device_id  Int?      @db.UnsignedInt
  devices    devices?  @relation(fields: [device_id], references: [id], onDelete: SetNull, map: "fk_alerts_device")

  @@index([device_id, status], map: "idx_alerts_device_status")
}
```

```bash
npx prisma migrate dev --name add_device_id_to_alerts
```

Rồi sửa `evaluateDoorAccessFailures`: bỏ tag `[door:<id>]` trong message, dedup bằng `where: { device_id, alert_type: 'unauthorized_access', status: { in: ['unread','read'] } }`.

**Migration cho data cũ:** parse `[door:(\d+)]` từ message các row cũ để backfill — hoặc bỏ qua, vì data alert cũ toàn là data test. Chọn bỏ qua thì ghi rõ vào migration comment.

**Bonus miễn phí:** alert sensor (`evaluateReading`) cũng set được `device_id` luôn → frontend hiển thị được "Cảnh báo ở Phòng khách" thay vì chỉ có text chung chung.

---

## 6. 🟡 Dọn git

**Ước lượng: 30 phút.**

`git status` đang có **20+ file `M` chưa commit**, gồm cả `CLAUDE.md`, `README.md`, toàn bộ `docs/`, `package-lock.json`, `db/schema.sql`.

**Tại sao quan trọng:** khi nộp bài GV clone repo về, những gì chưa commit thì **không tồn tại**. Nếu trong đống đó có fix thật (mà theo `docs/backend-requests.md` thì có — 2 bug đã fix) thì repo nộp lên là bản chưa fix.

**Sửa:**

```bash
git add -A && git status        # xem lại lần cuối cho chắc
git commit -m "docs: sync backend docs, fix command expiry + date-range query"
```

Tiện thể:

- **`UNSTAGED_CHANGES.md` nên xoá hoặc đổi tên.** Tên file mô tả một trạng thái git tạm thời, nhưng nội dung là tài liệu kiến trúc rất tốt. Đổi thành `docs/IOT-PROTOCOL.md` và chuyển vào `docs/`.
- Check `.gitignore` đã có `uploads/faces/`, `.env`, `node_modules/` chưa. Ảnh khuôn mặt lọt lên git là vấn đề quyền riêng tư thật, không phải chuyện nhỏ.

---

## 7. 🟡 Ghi rõ `device_actions` vs `device_commands`

**Ước lượng: 20 phút, chỉ viết docs.**

**Vấn đề:** hai bảng nhìn như ghi cùng một việc. Thực tế chúng khác nhau và cách chia là đúng — nhưng **không chỗ nào nói ra**:

| | `device_commands` | `device_actions` |
|---|---|---|
| Là gì | Ý định — hàng đợi lệnh đang bay | Sự thật — lịch sử điều khiển đã xong |
| Vòng đời | `pending → delivered → executed/failed/expired` | Chỉ tạo một lần, không đổi |
| Ai ghi | `createDeviceCommand` | `finalizeCommand` (mỗi command đóng lại sinh đúng 1 row) |
| Khoá chính | UUID (client sinh được → idempotency) | Auto-increment |
| Dùng để | Thiết bị poll, retry, timeout | Module 4 "Ghi nhận hoạt động", audit |

**Tại sao đáng làm:** khi bảo vệ, câu "sao có 2 bảng làm cùng một việc?" gần như chắc chắn được hỏi. Có bảng này thì trả lời trong 30 giây và ghi điểm; không có thì lúng túng.

Thêm bảng trên vào `docs/DATABASE.md` là xong. Zero code.

---

## 8. 🟡 Tách simulator ra khỏi process server

**Ước lượng: 1h.** *(Bỏ qua nếu làm [DEVICE-API-PLAN.md](./DEVICE-API-PLAN.md) §4 — refactor đó bao trùm luôn mục này.)*

**Vấn đề:** `simulatorRuntime.start()` chạy trong cùng process với HTTP server. `UNSTAGED_CHANGES.md` đã ghi nhận hệ quả: *"vẫn chạy song song mọi lúc server chạy dev/test, có thể gây race nếu chạy `npm test` cùng lúc server dev đang bật (cùng DB)"*.

Ngoài race, còn một vấn đề khái niệm: **code sinh dữ liệu giả đang chạy trong đường production.** Deploy lên mà quên `SIMULATOR_ENABLED=false` là DB đầy nhiệt độ ngẫu nhiên.

**Sửa (bản rẻ):** thêm `npm run simulator` → `node src/simulator/standalone.js`, gỡ `simulatorRuntime.start()` khỏi `server.js`. Demo thì mở 2 terminal.

**Sửa (bản đúng):** làm §4 của DEVICE-API-PLAN — simulator thành HTTP client, tự nhiên tách hẳn process và đồng thời test luôn được đường thiết bị thật.

---

## 9. 🟢 `docker-compose.yml`

**Ước lượng: 2h.**

**Vấn đề:** hệ thống đang có 5 thành phần (MySQL, Node, React, ai-service Python, sắp tới thêm Gateway) và **không có một file Docker nào**. Mỗi thành viên tự dựng tay, mỗi máy một kiểu, và buổi demo là một chuỗi terminal.

**Tại sao đáng làm dù môn không bắt buộc:**

- GV chấm mà `docker compose up` là chạy được cả hệ thống → ấn tượng rõ rệt
- Bảo vệ khỏi tai nạn "máy tao chạy được mà máy mày không"
- MySQL trong container = DB test bẩn cũng không sao, `docker compose down -v` là sạch

**Cẩn thận:** `ai-service` đang nằm ở repo Python riêng ngoài repo này. Compose file cần `build: ../ai-service` hoặc dùng git submodule. **Đây là rủi ro độc lập đáng lo** — thiếu `ai-service` là chết cả Face ID lẫn voice command, tức là mất luôn cả hai tính năng đặc trưng của đồ án. Nên gộp về một monorepo:

```
DADN/
├── backend/       (smarthome-backend)
├── frontend/      (smarthome-frontend)
├── ai-service/    (Python)
├── gateway/       (Python, sắp có)
└── docker-compose.yml
```

---

## 10. 🟢 Bổ sung tài liệu deliverable còn thiếu

**Ước lượng: 1 ngày, không phải việc code.**

Docs kỹ thuật của nhóm rất tốt, nhưng đối chiếu kế hoạch môn học thì **thiếu đúng những thứ đi thẳng vào báo cáo cuối kỳ**:

| Tuần | Deliverable | Trạng thái |
|---|---|---|
| 2 | User requirement (yêu cầu tổng quan) | ⚠️ không thấy trong repo |
| 3 | **Đặc tả use-case** (chi tiết từng interaction) | ❌ thiếu |
| 3 | **NFR đo được** | ❌ thiếu — nhưng xem mục 4, số liệu có sẵn trong code rồi |
| 4 | **Thiết kế UI/UX** (màn hình) | ❌ có `DESIGN.md` nhưng chưa phải screen design |
| 5 | **Thiết kế CSDL** (ERD) | 🟡 `docs/DATABASE.md` có, thiếu sơ đồ ERD trực quan |

**Điểm mấu chốt:** phần lớn nội dung này **đã tồn tại trong code**, chỉ chưa ai viết ra thành tài liệu. 15 route slice = danh sách use-case gần như xong. `prisma/schema.prisma` = ERD, chỉ cần render (dùng `prisma-erd-generator`, một lệnh ra sơ đồ). Các hằng số `DOOR_FAILURE_THRESHOLD`, `FACE_LOCKOUT_DURATION_MS`, `DEVICE_COMMAND_TTL_SECONDS` = NFR đo được, chỉ cần lập bảng.

Đây là công sức thấp nhất trên mỗi điểm số trong toàn bộ danh sách này.

---

## Tổng kết

| # | Việc | Thời gian | Ưu tiên |
|---|---|---|---|
| 1 | Xoá `console.log` token | 1 phút | 🔴 ngay |
| 2 | Validate env fail-fast | 20 phút | 🔴 |
| 3 | Tách DB test | 30 phút | 🔴 trước demo |
| 4 | helmet + rate-limit | 30 phút | 🟠 ăn điểm NFR |
| 5 | `alerts.device_id` | 45 phút | 🟠 ăn điểm DB design |
| 6 | Dọn git | 30 phút | 🟡 trước khi nộp |
| 7 | Docs 2 bảng command | 20 phút | 🟡 ăn điểm bảo vệ |
| 8 | Tách simulator | 1h | 🟡 hoặc gộp vào device API |
| 9 | docker-compose + gộp monorepo | 2h | 🟢 |
| 10 | Tài liệu deliverable | 1 ngày | 🟢 nhưng đừng để cuối kỳ |

**Mục 1–5 cộng lại chưa tới 2 tiếng** và xử lý xong: một lỗ bảo mật, hai tai nạn tiềm tàng, và hai chỗ ăn điểm chấm. Làm trong một buổi.
