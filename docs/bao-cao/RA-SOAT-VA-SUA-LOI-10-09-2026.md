# Rà soát & sửa lỗi toàn hệ thống — 10/09/2026

**Phạm vi:** toàn bộ monorepo `smarthome` (backend Node/Express/Prisma, frontend React/Vite, ai-service Python/Flask, docker-compose).
**Cách làm:** đọc từng file trong `apps/*/src`, đối chiếu frontend ↔ backend theo từng endpoint, đối chiếu code ↔ schema Prisma. Chỉ sửa lỗi có thật, có dẫn chứng dòng code — không sửa theo cảm tính hay "cho đẹp".

**Tổng cộng: 25 thay đổi trên 28 file.**

| # | Vấn đề | File chính | Mức |
|---|---|---|---|
| 1 | PIN không bị khoá sau nhiều lần sai (Face ID thì có) | `door-access.service.js` | 🔴 |
| 2 | Ảnh khuôn mặt truy cập được không cần đăng nhập | `app.js`, `signed-upload.middleware.js` | 🔴 |
| 3 | Access token bị ghi thẳng vào log server | `app.js` | 🔴 |
| 4 | Mật khẩu admin cứng trong mã nguồn | `prisma/seed.js` | 🔴 |
| 5 | Refresh token race → tự đăng xuất mỗi ~15 phút | `apiClient.js` | 🔴 |
| 6 | SSE chết vĩnh viễn sau khi token hết hạn | `useEventsStream.js` | 🔴 |
| 7 | Nút "Thêm thiết bị" luôn lỗi 500 | `AddDeviceForm.js` | 🔴 |
| 8 | Modal kết nối thiết bị: mật khẩu WiFi cứng trong code | `PairDeviceModal.js` | 🔴 |
| 9 | Lệnh giọng nói bật nhầm thiết bị khác phòng | `voice-command.service.js` | 🟠 |
| 10 | Trang Thông báo hiển thị 100% dữ liệu bịa | `NotificationsPage.js` | 🟠 |
| 11 | Trạng thái nút bấm kẹt sai vĩnh viễn khi đổi trang | `useDeviceCommand.js` | 🟠 |
| 12 | Ghi log mở cửa làm board tắt điện trông như đang online | `door-access.service.js` | 🟠 |
| 13 | ai-service mở CORS cho toàn Internet | `app/__init__.py` | 🟠 |
| 14 | ai-service so sánh API key không hằng thời gian | `middleware/auth.py` | 🟠 |
| 15 | ai-service phơi cổng 5000 ra host | `docker-compose.yml` | 🟠 |
| 16 | `/api/health` rò thông tin kết nối DB | `health.routes.js` | 🟠 |
| 17 | Đăng xuất trả 500 khi thiếu refresh token | `auth.controller.js` | 🟡 |
| 18 | Tạo thiết bị lỗi 500 khi id gửi lên là chuỗi | `devices.service.js` | 🟡 |
| 19 | Trang Quên mật khẩu giả vờ đã gửi mail | `ForgotPasswordPage.js` | 🟡 |
| 20 | Log MQTT ngập rác mỗi vài giây | `mqtt.service.js` | 🟡 |
| 21 | `console.log` debug trong VoiceSearchModal | `VoiceSearchModal.js` | 🟡 |
| 22 | `setTimeout` không dọn khi rời trang | `SecurityPage.js` | 🟡 |
| 23 | Modal lồng nhau trùng DOM id | `Modal.js` | 🟡 |
| 24 | Swagger mô tả sai response `/api/dashboard` | `dashboard.routes.js` | ⚪ |
| 25 | Thêm test hồi quy cho lỗi #9 | `tests/voice-parser.test.js` | ➕ |

---

# A. Nhóm bảo mật

## 1. PIN cửa không có cơ chế khoá sau nhiều lần sai

**Trước:** `verifyFace()` có kiểm tra khoá — sai 3 lần trong 2 phút thì khoá 5 phút, và thông báo lỗi 423 ghi rõ *"dùng mã PIN để mở cửa"*. Nhưng `verifyPin()` thì đi thẳng từ `requireDevice` sang `bcrypt.compare`, không có lớp khoá nào. Nhánh sai PIN cũng `return` thẳng, không gọi `alertEvaluationService.evaluateDoorAccessFailures` (nhánh Face ID có gọi).

```js
// verifyPin — trước
const activePassword = await prisma.door_passwords.findFirst({ ... });
if (!activePassword) throw new HttpError(400, "No PIN configured for this door");
const matches = await bcrypt.compare(String(pin), activePassword.password_hash);
...
if (!matches) {
  return { result: "failed", doorAccessLogId: accessLog.id };
}
```

**Sau:** tách `faceLockStatus(doorDeviceId)` thành `accessLockStatus(doorDeviceId, accessMethod)` dùng chung cho cả hai phương thức, đổi hằng số `FACE_LOCKOUT_*` thành `LOCKOUT_*`, giữ `faceLockStatus()` làm wrapper mỏng để không phải sửa các chỗ đang gọi.

```js
// verifyPin — sau
const lockStatus = await accessLockStatus(device.id, "password");
if (lockStatus.locked) {
  throw new HttpError(423, `Mã PIN đang bị khoá do sai quá ${LOCKOUT_THRESHOLD} lần liên tiếp, thử lại sau`,
    { lockedUntil: lockStatus.lockedUntil });
}
...
if (!matches) {
  await alertEvaluationService.evaluateDoorAccessFailures(device, "password");
  return { result: "failed", doorAccessLogId: accessLog.id };
}
```

**Tại sao phải sửa:** PIN 4 chữ số chỉ có 10.000 khả năng. Không khoá, không delay thì dò cạn bằng script mất khoảng 10-20 phút (bcrypt cost 10 ≈ 50-100ms/lần). Nghiêm trọng hơn về mặt thiết kế: **PIN chính là đường dự phòng khi Face ID bị khoá** — chính thông báo 423 bảo người dùng chuyển sang PIN. Kẻ tấn công bị chặn ở Face ID chỉ cần đổi sang bàn phím PIN là thoát hoàn toàn khỏi lớp bảo vệ. Ngoài ra chủ nhà được cảnh báo khi có người dò Face ID nhưng **không** được cảnh báo khi có người dò PIN — bất đối xứng vô lý. `README.md:79` cũng ghi "khoá 3 lần sai" là yêu cầu nghiệp vụ.

**Tại sao chọn cách này:** hàm `evaluateDoorAccessFailures(device, accessMethod)` đã nhận sẵn tham số `accessMethod` — tác giả gốc rõ ràng đã thiết kế để dùng chung, chỉ là chưa có ai gọi cho nhánh `password`. Tương tự, logic khoá trong `faceLockStatus` vốn chỉ khác nhau ở giá trị `access_method` trong câu query. Nên cách rẻ và ít rủi ro nhất là **tham số hoá cái đã có** thay vì viết một cơ chế khoá thứ hai song song — hai cơ chế khoá riêng biệt sẽ lệch nhau ngay lần đầu ai đó chỉnh ngưỡng. Dùng chung một bộ hằng số cũng đảm bảo không thể "né lớp khoá này bằng cách chuyển sang lớp kia".

## 2. Ảnh khuôn mặt (dữ liệu sinh trắc học) phục vụ công khai

**Trước:**
```js
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
```
Không có middleware xác thực. Thư mục này chứa ảnh đăng ký khuôn mặt **và ảnh chụp mọi lần thử mở cửa, kể cả thất bại**. URL được trả ra trong response API dạng `http://host/uploads/faces/<uuid>.jpg`.

**Sau:** thêm `src/middlewares/signed-upload.middleware.js`. API phát ra URL kèm chữ ký HMAC-SHA256 và hạn dùng; `/uploads` từ chối mọi request không có chữ ký hợp lệ.

```js
app.use("/uploads", requireSignedUpload, express.static(...));
// faceImageUrl() giờ trả: /uploads/faces/<uuid>.jpg?exp=<ts>&sig=<hmac>
```

**Tại sao phải sửa:** `.gitignore` của chính repo ghi *"Anh khuon mat ... KHONG commit (du lieu sinh trac hoc)"* — nhóm đã coi đây là dữ liệu nhạy cảm ở một chỗ, nhưng lại phục vụ nó công khai ở chỗ khác. Tên file là UUID nên khó đoán, nhưng "URL khó đoán" **không phải** là kiểm soát truy cập: URL rò ra qua log proxy, lịch sử trình duyệt, header `Referer`, hoặc lúc chia sẻ màn hình là ai cũng xem được mặt người.

**Tại sao chọn URL ký thay vì bắt buộc Bearer token:** ảnh được render bằng thẻ `<img src="...">`, mà thẻ `<img>` **không thể** gắn header `Authorization`. Còn nhét access token vào query string thì tệ hơn hẳn: token đó mở được toàn bộ API (kể cả mở cửa), sống 15 phút, và sẽ lọt vào log/history. Chữ ký theo từng file chỉ cấp đúng một quyền: "đọc riêng tấm ảnh này, đến thời điểm `exp`". Khoá ký lấy từ `JWT_ACCESS_SECRET` (đã được `validateEnv()` bảo đảm tồn tại và ≥32 ký tự) nên không phát sinh biến môi trường bắt buộc mới. So sánh chữ ký dùng `crypto.timingSafeEqual`, có kiểm tra độ dài trước vì hàm này ném lỗi khi hai buffer khác độ dài.

**Một chi tiết đã phải xử lý thêm:** ban đầu `exp` tính bằng `Date.now() + TTL` nên mỗi request sinh một URL khác nhau. Trang An ninh poll lại mỗi 5 giây → `<img src>` đổi liên tục → trình duyệt tải lại ảnh mỗi 5 giây, nhấp nháy và tốn băng thông. Đã sửa bằng cách làm tròn `exp` lên lưới 5 phút, nên trong cùng một khung 5 phút mọi request sinh **đúng cùng một URL** và cache trình duyệt hoạt động bình thường.

## 3. Access token bị ghi vào log server

**Trước:** `app.use(morgan("dev"))` in `req.originalUrl` nguyên văn. Frontend mở SSE bằng `GET /api/events/stream?token=<JWT>` (bắt buộc, vì `EventSource` không set được header). Kết quả: mỗi lần mở stream, `docker logs smarthome-backend` chứa một dòng có access token còn hạn.

**Sau:** ghi đè token `url` của morgan để che các tham số nhạy cảm:
```js
morgan.token("url", (req) => {
  const [pathname, query] = req.originalUrl.split("?");
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of ["token", "sig"]) { if (params.has(key)) params.set(key, "REDACTED"); }
  return `${pathname}?${params.toString()}`;
});
```

**Tại sao phải sửa:** ai đọc được log container (hoặc access log của reverse proxy đặt phía trước) là đăng nhập được với quyền chủ nhà và mở được cửa. Token sống 8 giờ theo `.env.example`.

**Tại sao chọn cách này:** vấn đề nằm ở chỗ **ghi log**, không phải ở chỗ chấp nhận token qua query — bỏ `?token=` thì SSE không chạy được nữa vì đó là giới hạn của chuẩn `EventSource`. Ghi đè token `url` của morgan là điểm can thiệp nhỏ nhất, che đúng chỗ rò, không đụng vào luồng xác thực. Đã che luôn `sig` cho URL ảnh ký ở mục 2.

## 4. Mật khẩu admin cứng trong mã nguồn

**Trước:** `prisma/seed.js` hash cứng chuỗi `'password'` cho `admin@admin.com`, và `.env` đang bật `SEED_ON_BOOT=true` nên tài khoản này được dựng lại mỗi lần khởi động. Chính tài khoản đó sở hữu cửa thật (`bootstrap-board.js` gắn board vào nó).

**Sau:**
```js
const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'password';
if (adminPassword === 'password') {
  console.warn('⚠  Seed admin is using the default password. Set SEED_ADMIN_PASSWORD in .env ...');
}
```
`bootstrap-board.js` cũng đọc `SEED_ADMIN_EMAIL` để tra đúng tài khoản đó.

**Tại sao phải sửa:** `POST /api/auth/sign-in` là route công khai, không rate-limit, mật khẩu là đúng chữ `password`. Bất kỳ ai chạm được cổng 3000 → đăng nhập → `POST /api/devices/{id}/commands {action:"open"}` → servo mở cửa thật. Đây là đường vòng qua **toàn bộ** lớp Face ID + PIN mà mục 1 vừa gia cố — vá lockout mà để nguyên lỗ này thì vá cũng như không.

**Tại sao giữ `'password'` làm mặc định thay vì đổi luôn:** đổi cứng mật khẩu sẽ làm hỏng ngay quy trình demo và mọi tài liệu đã viết (`kich-ban-demo-video-1` ghi rõ `admin@admin.com` / `password`). Cách này giữ nguyên hành vi hiện tại, chỉ mở đường để đặt mật khẩu thật bằng một dòng `.env` khi cần, kèm cảnh báo in ra mỗi lần seed để không ai quên. **Đây là mục duy nhất trong tài liệu này chưa được vá triệt để — cần m tự đặt `SEED_ADMIN_PASSWORD` trước khi mở backend ra ngoài localhost.**

## 5. ai-service mở CORS cho toàn Internet

**Trước:** `CORS(app)` — không giới hạn origin nào.
**Sau:** chỉ mở cho các origin liệt kê trong `AI_ALLOWED_ORIGINS`; để trống (mặc định) thì không mở cross-origin nào.

**Tại sao phải sửa:** với `CORS(app)`, một trang web bất kỳ mà nạn nhân mở có thể gọi thẳng vào ai-service từ trình duyệt của họ.

**Tại sao mặc định là đóng hẳn:** trong kiến trúc này **không có** luồng nào cần CORS — trình duyệt chỉ nói chuyện với backend Node, còn backend gọi ai-service theo kiểu server-to-server (`http://ai-service:5000`), mà server-to-server thì CORS không áp dụng. Nên đóng mặc định không làm hỏng bất cứ thứ gì đang chạy, và biến env cho phép mở lại nhanh khi cần gọi tay lúc debug.

## 6. ai-service so sánh API key bằng `!=`

**Trước:** `if (not expected or not provided or provided != expected)`.
**Sau:** `hmac.compare_digest(provided, expected)`, tách riêng khỏi các kiểm tra rỗng.

**Tại sao:** so sánh chuỗi thường thoát ra ngay khi gặp byte đầu tiên khác nhau, nên thời gian phản hồi rò rỉ thông tin về số ký tự đầu đã đoán đúng. `compare_digest` luôn duyệt hết cả hai buffer. Rủi ro thực tế trong mạng LAN là thấp, nhưng sửa mất đúng ba dòng và đây là chuẩn mực chung khi so sánh bí mật.

## 7. ai-service phơi cổng 5000 ra host

**Trước:** `ports: - "5000:5000"`.
**Sau:** comment lại, kèm giải thích và hướng dẫn bật lại khi cần debug.

**Tại sao:** chỉ `backend` gọi service này, qua mạng nội bộ của compose (`AI_SERVICE_URL=http://ai-service:5000`). Publish ra host nghĩa là đặt một service inference đang giữ embedding khuôn mặt lên toàn mạng LAN mà không đổi lại được lợi ích gì. Đã kiểm tra frontend: không có chỗ nào gọi trực tiếp ai-service.

## 8. `/api/health` rò chi tiết kết nối DB

**Trước:** `res.status(503).json({ ..., message: err.message })` — `err.message` của Prisma khi mất kết nối chứa host/port/tên database, đôi khi cả username.
**Sau:** log lỗi ở server, trả về client trạng thái chung chung.

**Tại sao:** route này công khai (không `requireAuth`). `error.middleware.js` vốn đã cẩn thận nuốt message của mọi lỗi ≥500, nhưng route này tự bắt lỗi nên đi vòng qua lớp bảo vệ đó.

---

# B. Nhóm lỗi làm tính năng không dùng được

## 9. Refresh token race — cứ ~15 phút là bị đá về trang đăng nhập

**Trước:** mỗi request nhận 401 tự gọi `/auth/refresh-token` riêng, không có hàng đợi:
```js
originalRequest._retry = true;
const refreshToken = this.getRefreshToken();
if (refreshToken) {
  try {
    const { data: tokens } = await axios.post(`.../auth/refresh-token`, { refreshToken });
    ...
  } catch { this.clearTokens(); if (this.onUnauthorized) this.onUnauthorized(); }
}
```

**Sau:** gom mọi lời gọi vào một promise dùng chung:
```js
refreshTokens() {
  if (this.refreshPromise) return this.refreshPromise;
  const refreshToken = this.getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('No refresh token'));
  this.refreshPromise = axios.post(..., { refreshToken })
    .then(({ data: tokens }) => { this.setTokens(tokens); return tokens; })
    .finally(() => { this.refreshPromise = null; });
  return this.refreshPromise;
}
```

**Tại sao phải sửa:** backend xoay vòng refresh token **dùng một lần** — `auth.service.js` gọi `prisma.refresh_tokens.delete()` ngay khi tiêu thụ. Access token sống 15 phút. Trang chủ và trang An ninh đều bắn 4 API song song bằng `Promise.all` (trang An ninh còn lặp mỗi 5 giây). Sau 15 phút, cả 4 cùng 401 → cùng POST **một** refresh token → 1 cái thành công, 3 cái còn lại nhận P2025 → 500 → rơi vào nhánh `catch` → `clearTokens()` + `onUnauthorized()` → **đá người dùng về `/dang-nhap` mặc dù refresh đã thành công**. Đây chính là triệu chứng "đang dùng tự nhiên bị văng ra login".

**Tại sao chọn promise singleton:** vấn đề gốc là "một tài nguyên dùng một lần bị nhiều bên tiêu thụ đồng thời", nên lời giải đúng là serialize việc tiêu thụ, chứ không phải nới lỏng phía backend (giữ token dùng-một-lần là đúng về bảo mật: nó cho phép phát hiện token bị đánh cắp). `.finally()` xoá promise ở cả hai nhánh — thành công thì lần hết hạn sau phải refresh mới, thất bại thì không được giữ mãi một promise đã reject.

## 10. SSE chết vĩnh viễn sau khi token hết hạn

**Trước:**
```js
source.onerror = (err) => {
  // EventSource tự reconnect (cùng URL/token) — không tự viết lại logic retry.
  console.warn('SSE lỗi, browser tự reconnect', err);
};
```
Token được đọc **một lần** lúc effect chạy, và dependency array không chứa token nên effect không bao giờ chạy lại.

**Sau:** phân biệt hai loại lỗi, và tự refresh + nối lại khi bị 401:
```js
source.onerror = () => {
  if (cancelled || source.readyState !== EventSource.CLOSED) return;
  scheduleReconnect(isCancelled, setTimer);   // backoff 1s,2s,4s... tối đa 30s
};
```
`scheduleReconnect` gọi `apiClient.refreshTokens()` rồi bump `reconnectKey` (state) để effect chạy lại và đọc token mới. `source.onopen` reset bộ đếm backoff.

**Tại sao phải sửa:** comment cũ **sai**. Theo chuẩn, `EventSource` chỉ tự reconnect khi kết nối đứt ở tầng mạng (`readyState` về `CONNECTING`). Còn khi server trả response khác 200 — đúng cái backend làm khi token hết hạn (`sse-auth.middleware.js` trả 401) — thì chuẩn quy định "fail the connection": `readyState = CLOSED` và **không bao giờ thử lại**. Hệ quả: sau 15 phút, chỉ cần một lần đứt (restart server, wifi chớp, laptop sleep/wake) là realtime chết hẳn tới cuối phiên. Trang chủ cố ý không có polling nên sẽ đứng hình hoàn toàn; log duy nhất là dòng `console.warn` trấn an sai sự thật.

**Tại sao chọn cách này:** không thể chỉ đưa `token` vào dependency array vì `apiClient` giữ token trong một field thường, React không "thấy" nó đổi. Dùng một state `reconnectKey` làm tín hiệu là cách tối thiểu để ép effect chạy lại và đọc token mới. Backend đã có sẵn `refreshTokens()` (mục 9) nên tái dùng luôn — đồng thời tránh được đúng cái race mà mục 9 vừa sửa. Có backoff luỹ thừa vì **mỗi lần thử tiêu tốn một refresh token dùng-một-lần**: nối lại liên tục sẽ đốt sạch phiên đăng nhập. Nếu refresh cũng thất bại thì im lặng — request API thường tiếp theo sẽ 401 và luồng đăng xuất ở `apiClient` lo phần còn lại, không cần hai chỗ cùng quyết định đăng xuất.

## 11. Nút "Thêm thiết bị" luôn lỗi 500

**Trước:** `AddDeviceForm` chỉ có 3 trường (tên, phòng, loại) và submit:
```js
onSubmit({ name: name.trim(), roomId: roomId ? Number(roomId) : undefined, deviceType });
```
Trong khi `schema.prisma` khai `device_code String @db.VarChar(100)` — **không nullable**, và controller đọc `device_code` từ body.

**Sau:** thêm ô nhập "Mã thiết bị" (bắt buộc, có gợi ý `VD: yolobit-light` và ghi chú "trùng với tên feed MQTT"), gửi kèm `deviceCode`, và disable nút submit khi để trống.

**Tại sao phải sửa:** body gửi lên không hề có `device_code` → Prisma nhận `undefined` → `PrismaClientValidationError` → `error.middleware.js` trả 500 → modal hiện "Internal server error". Tính năng thêm thiết bị **chưa bao giờ chạy được**.

**Tại sao thêm ô nhập thay vì tự sinh mã:** `device_code` không phải id nội bộ — nó là **định danh của thiết bị trên MQTT**, phải khớp với tên feed mà firmware publish lên (`yolobit-a82f-light-command`...). Tự sinh UUID sẽ tạo ra bản ghi không bao giờ nhận được dữ liệu từ board, tức là đổi một lỗi ồn ào (500) thành một lỗi câm (thiết bị vĩnh viễn offline) — tệ hơn nhiều.

## 12. Modal "Kết nối thiết bị": mật khẩu WiFi cứng trong mã nguồn

**Trước:** file có hai `useEffect`. Cái thứ nhất gọi `createPairingToken` nhưng **vứt luôn kết quả** (chỉ có `.catch`, không có `.then`) nên modal quay spinner vĩnh viễn. Cái thứ hai là code debug bỏ quên:
```js
const response = fetch('http://192.168.4.1/pair', {
  method: 'POST',
  body: JSON.stringify({
    pairingToken: 'test-token-123',
    ssid: 'Pink Home',
    password: '68686868',      // ← mật khẩu WiFi thật, nằm trong git history
  }),
})
```

**Sau:** viết lại toàn bộ. Bỏ hẳn effect gọi `192.168.4.1`, hiển thị mã pairing thật kèm nút sao chép và giờ hết hạn, có cờ `cancelled` để không set state sau khi modal đóng.

**Tại sao phải sửa:** ba lỗi chồng nhau. (a) Mật khẩu WiFi nhà thật nằm trong mã nguồn đã commit — cần **đổi mật khẩu WiFi đó**, vì xoá khỏi code không xoá khỏi lịch sử git. (b) Token pairing hard-code `'test-token-123'` nên board không bao giờ pair được. (c) Token thật bị vứt nên UI không bao giờ hiện gì.

**Tại sao bỏ hẳn luồng `192.168.4.1` thay vì sửa:** luồng provisioning WiFi qua AP của board đã được chốt bỏ khỏi phạm vi từ kế hoạch trước (board nhận WiFi từ chương trình MicroPython nạp sẵn, không cần AP provisioning). Giữ lại một lời gọi `fetch` tới một địa chỉ không tồn tại chỉ tạo lỗi câm và độ trễ. Modal giờ làm đúng một việc có ý nghĩa: cấp mã pairing để nạp vào board.

## 13. Trang Thông báo hiển thị 100% dữ liệu bịa

**Trước:** `NotificationsPage.js` có mảng `INITIAL_NOTIFICATIONS` với 6 thông báo bịa (ngày "02 Th10" cứng), file không import service nào, `markAsRead` chỉ `setState` local nên F5 là mất.

**Sau:** gọi `alertService.getAll(currentHomeId, { limit: 50 })`, map alert thật sang danh sách, `markAsRead` gọi `PATCH /api/alerts/:id` với cập nhật lạc quan + rollback khi lỗi, `markAllAsRead` dùng `Promise.allSettled` rồi refetch. `NotificationsList` đổi từ hiển thị "kênh gửi" sang hiển thị **mức độ nghiêm trọng** (info/warning/critical) và trạng thái thật (chưa đọc/đã đọc/đã xử lý).

**Tại sao phải sửa:** đây là module 4 của đề bài (ghi nhận hoạt động) và backend **đã có sẵn** `GET /api/alerts` + `PATCH /api/alerts/:id` — cả hai đang được trang chủ và trang An ninh dùng bình thường. Chỉ mỗi trang Thông báo là chưa nối. Demo mà giảng viên bấm vào trang này sẽ thấy dữ liệu không liên quan gì tới nhà đang chọn.

**Tại sao đổi "kênh" thành "mức độ":** bảng `alerts` không có khái niệm kênh gửi, và backend cũng chưa có luồng gửi email/telegram/push nào. Hiển thị icon "Telegram"/"Email" là hứa một tính năng không tồn tại. `severity` là trường có thật, luôn có giá trị, và hữu ích hơn với người dùng.

## 14. Trạng thái nút bấm kẹt sai vĩnh viễn khi đổi trang

**Trước:** cleanup lúc unmount chỉ xoá timer:
```js
return () => {
  Object.values(debounceTimers).forEach(clearTimeout);
  Object.values(pollTimers).forEach(clearTimeout);
};
```
Nhưng `optimisticActions` là **atom jotai toàn cục**, còn timer là ref cục bộ của từng component.

**Sau:** cleanup xử lý riêng hai loại timer — debounce chưa kịp chạy thì **gửi lệnh luôn**, poll đang dở thì **xoá trạng thái lạc quan** để giá trị thật của thiết bị thắng:
```js
Object.entries(debounceTimers).forEach(([deviceId, timer]) => {
  clearTimeout(timer);
  const pending = pendingDispatch[deviceId];
  if (pending && cleanup.dispatch) cleanup.dispatch(deviceId, pending.action, pending.generation);
});
Object.entries(pollTimers).forEach(([deviceId, timer]) => {
  clearTimeout(timer);
  cleanup.clearOptimistic?.(deviceId);
});
```

**Tại sao phải sửa:** kịch bản thật — bấm tắt đèn ở trang Tổng quan rồi bấm sang trang Thiết bị trong vòng 350ms (thời gian debounce). Trang cũ unmount → timer bị xoá → `dispatch` không bao giờ chạy → không ai gọi `clearOptimistic` → giá trị lạc quan nằm lại trong atom **vĩnh viễn**. `isDeviceOn()` ưu tiên giá trị lạc quan hơn `device.status`, nên trang mới hiển thị đèn đã tắt trong khi đèn vẫn đang sáng thật, và polling 5 giây cũng không sửa được vì lạc quan luôn thắng.

**Tại sao xử lý hai loại timer khác nhau:** chúng có ý nghĩa khác nhau. Debounce chưa chạy = **cú bấm người dùng đã thực hiện** → vứt đi là mất lệnh, nên gửi luôn (và chính lệnh đó sẽ tự settle rồi xoá trạng thái lạc quan). Poll đang dở = lệnh đã gửi nhưng không còn ai chờ kết quả → phải xoá lạc quan để UI quay về sự thật. Dùng `cleanupRef` (một object không bao giờ bị gán lại, chỉ sửa field) để cleanup `[]`-deps không bắt phải closure cũ, đồng thời không vi phạm rule của `react-hooks/exhaustive-deps`.

## 15. Trang Quên mật khẩu giả vờ đã gửi mail

**Trước:** `handleSubmit` chỉ có `e.preventDefault()`. Bấm "Gửi liên kết đặt lại" không làm gì, không báo lỗi, không báo thành công — người dùng tưởng mail đã gửi và ngồi chờ.
**Sau:** đổi lời dẫn thành "Tính năng đặt lại mật khẩu chưa được mở, vui lòng liên hệ quản trị viên", disable ô nhập và nút bấm, thêm `title` giải thích.

**Tại sao:** backend chưa có endpoint reset password. Nói thẳng là chưa có thì trung thực; im lặng nuốt submit là nói dối người dùng. Cách xử lý này khớp với `AccountInfoCard.js` — chỗ đó đã dùng đúng pattern nút `disabled` + `title` cho tính năng chưa làm.

---

# C. Nhóm lỗi logic backend

## 16. Lệnh giọng nói bật nhầm thiết bị ở phòng khác

**Trước:**
```js
const device = devices
  .map((candidate) => ({ candidate, score: scoreDeviceName(candidate.name, normalized) }))
  .sort((left, right) => right.score - left.score)[0]?.candidate;
if (!device) return recordUnknownCommand(userId, trimmedText, intent);
```
`.sort(...)[0]` **luôn** trả về phần tử đầu. Khi mọi candidate đều `score === 0`, sort giữ nguyên thứ tự và vẫn chọn một thiết bị. Nhánh `if (!device)` chỉ chạy khi nhà **không có thiết bị nào** thuộc loại đó.

**Sau:** thêm hàm `unmatchedQualifiers()` và chỉ từ chối khi người dùng thật sự đặt tên cho một chỗ không tồn tại:
```js
if (best.score === 0 && devices.length > 1) {
  const qualifiers = unmatchedQualifiers(normalized, devices);
  if (qualifiers.length > 0) return recordUnknownCommand(userId, trimmedText, intent);
}
```

**Tại sao phải sửa:** nhà có "Đèn phòng khách" và "Đèn phòng ngủ". Người dùng nói *"bật đèn nhà bếp"* (phòng không tồn tại) → `scoreDeviceName` trả 0 cho cả hai → chọn đại cái đầu tiên → **bật đèn phòng khách**, ghi `execution_status: 'success'` và trả 202. Người dùng ra lệnh cho một phòng, hệ thống bật đèn phòng khác, rồi báo thành công.

**Tại sao không đơn giản là "score = 0 thì từ chối":** vì như thế sẽ phá luôn các câu lệnh hợp lệ. `scoreDeviceName` cố ý bỏ qua các từ chỉ loại thiết bị (`den`, `quat`, `cua`), nên câu *"bật đèn"* cho score 0 với **mọi** đèn — mà đó là câu phổ biến nhất và đang nằm trong bộ test `measure_voice.py`. Nhà thật của m lại có 2 nhóm thiết bị trùng loại (`yolobit-*` và `YoloBit-A82F-*`), nên "score 0 thì từ chối" sẽ làm hỏng đúng câu demo.

Nên logic phân biệt là: *người dùng có nêu tên một chỗ cụ thể mà mình tìm không ra hay không*. Có ba lớp lọc — từ chỉ hành động/loại thiết bị (`GENERIC_WORDS`), từ đệm lịch sự và giới từ (`FILLER_WORDS`), và từ đã khớp tên thiết bị. Còn sót lại chữ nào thì đó mới là "tên chỗ không tồn tại". Thêm điều kiện `devices.length > 1` vì khi nhà chỉ có đúng một thiết bị loại đó thì không có gì để nhầm lẫn cả.

**Quá trình sửa có bắt lỗi của chính bản vá:** lần đầu viết xong, chạy thử thì câu *"tắt hết đèn trong nhà"* (có trong bộ test voice) bị chặn nhầm vì chữ "trong" chưa nằm trong `FILLER_WORDS`. Đã bổ sung nhóm giới từ chỉ nơi chốn (`trong/ngoai/tren/duoi/ben/phia/o/tai`) và nhóm từ chỉ phạm vi (`het/ca/moi`). Sau đó chạy lại toàn bộ 20 câu trong `LENH` của `measure_voice.py` + 4 câu bẫy: **24/24 đúng**.

## 17. Ghi log mở cửa làm board đã tắt điện trông như đang online

**Trước:**
```js
updatedDevice = await tx.devices.update({
  where: { id: device.id },
  data: { status: "open", last_seen_at: new Date(), connection_status: "online" },
});
```
**Sau:** chỉ cập nhật `status`, bỏ `last_seen_at` và `connection_status`.

**Tại sao phải sửa:** `POST /api/door-access/events` là endpoint **ghi nhật ký** một lần mở cửa đã xảy ra — nó không hề nói chuyện với board, không publish MQTT, không đi qua `device_commands`. Việc nó tự khẳng định thiết bị "online" là sai sự thật, và cái sai đó có hậu quả: `dispatch()` trong `mqtt/commands.js` tin rằng board online nên gửi lệnh vào hư không, thay vì fail sớm với "Device is offline". Trạng thái kết nối phải do tầng MQTT sở hữu (`markBoardOnline()` khi thật sự nhận được gói tin), không phải do một endpoint ghi log tự phong.

## 18. Đăng xuất trả 500 khi thiếu refresh token

**Trước:** `signOut` là hàm duy nhất trong `auth.controller.js` không có `try/catch`. Body rỗng → `crypto.createHash().update(undefined)` ném `TypeError` → Express 5 forward → 500 + stack trace trong log.
**Sau:** thiếu token thì trả 204 luôn (đăng xuất là thao tác idempotent), có `try/catch` như ba hàm còn lại.

**Tại sao chọn 204 thay vì 400:** client thường xoá token khỏi localStorage trước rồi mới gọi sign-out, hoặc gọi lúc token đã hết hạn — nghĩa là body rỗng là tình huống **bình thường**, không phải lỗi của client. Kết quả cuối cùng ("phiên này không còn hiệu lực") đã đạt được, nên 204 mô tả đúng thực tế hơn 400.

## 19. Tạo thiết bị lỗi 500 khi id gửi lên là chuỗi

**Trước:** `createDevice` ép `Number(userId)` nhưng để `home_id`/`room_id` đi thẳng từ `req.body` vào Prisma.
**Sau:** ép `Number()` cả hai, và xử lý `room_id` rỗng thành `null` tường minh.

**Tại sao:** cột khai `Int` trong schema, nên `"1"` (chuỗi, rất dễ phát sinh từ form hoặc query param) làm Prisma ném `PrismaClientValidationError` → 500 thay vì tạo thiết bị hoặc trả 400. Mọi service khác trong dự án đều đã ép kiểu (`ownership.service.js`, `rooms.service.js`, `door-access.service.js`) — đây là chỗ duy nhất bỏ sót, nên sửa cho đồng nhất chứ không phải thêm quy ước mới.

---

# D. Dọn dẹp & chất lượng

## 20. Log MQTT ngập rác

**Trước:** `handleSensorReading` in 5 dòng mỗi lần board gửi số đo (in cả object `devices` và `sensors` đầy đủ), `publishCommand` in thêm 4 dòng gồm cả `console.log("client", client.publish)` — in ra một function, vô nghĩa.
**Sau:** mỗi sự kiện một dòng gọn: `MQTT: reading yolobit-a82f-light/temperature = 28.4`, `MQTT: published ON -> karmavt123/feeds/...`. Hai nhánh "không tìm thấy thiết bị/sensor" đổi thành `console.warn` có nội dung rõ ràng thay vì âm thầm `return`.

**Tại sao không xoá sạch:** log MQTT có giá trị chẩn đoán thật, m đang dùng nó khi debug board. Vấn đề là tỉ lệ tín hiệu/nhiễu: với `SENSOR_READ_EVERY_LOOPS` thấp lúc quay demo, 5 dòng mỗi 5 giây làm trôi mất log quan trọng. Giữ một dòng có đủ thông tin (mã thiết bị, loại cảm biến, giá trị) là cân bằng tốt hơn cả xoá hết lẫn giữ nguyên.

## 21-23. Ba lỗi nhỏ ở frontend

- **`VoiceSearchModal.js`**: xoá `useEffect` in `console.log('[VoiceSearch] transcript:', ...)` — chạy nhiều lần mỗi giây khi đang nghe.
- **`SecurityPage.js`**: `setTimeout(..., 1500)` sau khi mở khoá không được lưu id, rời trang trong 1,5 giây vẫn bắn 5 request thừa vào component đã unmount. Đã đưa vào `useRef` + `clearTimeout` trong cleanup.
- **`Modal.js`**: `id="modal-title"` viết cứng, mà `VoiceSearchModal` mở modal lồng trong modal → hai phần tử trùng id → `aria-labelledby` của modal trong trỏ nhầm về tiêu đề modal ngoài, screen reader đọc sai. Đã đổi sang `useId()`.

## 24. Swagger mô tả sai response `/api/dashboard`

Doc ghi *"Return latest sensor values, histories, devices, and alerts"* nhưng service trả `{ server_time, home, rooms, environment_status }` — không có `devices`, không có `alerts`. Chỉ sửa dòng mô tả, **không sửa code**: frontend chỉ đọc `dashboard.rooms` và `dashboard.environmentStatus` nên hành vi hiện tại là đúng, cái sai nằm ở tài liệu.

## 25. Thêm test hồi quy cho lỗi #16

Bổ sung `unmatchedQualifiers` vào exports và thêm vào `tests/voice-parser.test.js` một bộ 22 case: 18 câu phải được chấp nhận (toàn bộ danh sách `LENH` trong `measure_voice.py` + các câu mẫu của bộ phân loại ý định) và 4 câu phải bị từ chối (đặt tên phòng không tồn tại). Test này không cần DB nên chạy được độc lập.

**Tại sao thêm test:** lỗi #16 là loại lỗi âm thầm — không crash, không log, chỉ đơn giản là bật nhầm thiết bị và báo thành công. Không có test thì lần sau ai đó chỉnh `scoreDeviceName` hay danh sách từ đệm sẽ tái tạo lại nó mà không ai biết. Đây cũng là bộ test đã bắt được lỗi trong chính bản vá lúc đang viết (câu "tắt hết đèn trong nhà").

---

# E. Những gì đã cân nhắc nhưng KHÔNG sửa

| Vấn đề | Lý do không sửa |
|---|---|
| **Dead code**: `simulatorService.js` (cả file), một số hàm không dùng trong `deviceService`/`roomService`/`homeService`/`doorAccessService`/`telemetryService`; component `AccessLogTable.js`, `Button.js`, `IncidentDetail.js` | Vô hại — chúng chỉ là wrapper API không ai gọi. Xoá lúc gần deadline có rủi ro sót một import ở đâu đó, đổi lại không được lợi ích chức năng nào. Ghi lại ở đây để dọn sau demo. |
| **Biểu đồ "7 ngày gần nhất" thực ra không lọc theo ngày**: `alertService.getAll(homeId, {limit:1000})` bị backend cắt còn 200 và không có điều kiện thời gian; `deviceActionService.list()` chỉ lấy 50 bản ghi mới nhất; `getSensorReadings` bị chặn ở 500 bản ghi mới nhất | Sửa đúng cần thêm bộ lọc khoảng thời gian ở backend cho 3 endpoint — đây là **thêm tính năng**, không phải vá lỗi, và đụng vào đường dữ liệu mà video demo đang dùng. Rủi ro cao hơn lợi ích ở thời điểm này. Nên ghi vào phần "hạn chế" của báo cáo. |
| **Kênh nhận thông báo ở trang Cài đặt là state giả** (`enabledChannels` không lưu đâu cả) | Backend không có luồng gửi email/telegram/push nào để bật/tắt. Sửa "đúng" nghĩa là xây cả tính năng gửi thông báo đa kênh. |
| **Hai nhánh MQTT song song** (OhStem `yolobit-*` và Adafruit `YoloBit-A82F-*`) | Đã chốt từ các phiên trước là không đụng tới trước demo — hai nhánh đang cùng chạy, gỡ một nhánh mà quên test nhánh kia thì gãy đúng lúc gấp. |
| **`LIVENESS_THRESHOLD`** | Đã hiệu chuẩn riêng ở phiên trước, chốt `0.90` trên 20 ảnh thật / 18 ảnh giả. |

---

# F. Cách kiểm chứng

Những gì **đã** kiểm chứng được ở môi trường hiện tại:

- `node --check` trên toàn bộ file JS đã sửa — pass.
- `ast.parse` trên file Python đã sửa, `yaml.safe_load` trên `docker-compose.yml` — pass.
- `eslint src --max-warnings=0` trên toàn bộ frontend — **0 lỗi, 0 cảnh báo** (bao gồm cả rule `react-hooks/exhaustive-deps`).
- `prettier --check` trên các file frontend đã sửa — đúng định dạng chung của dự án.
- Logic `unmatchedQualifiers` chạy thật trên 24 câu (20 câu hợp lệ + 4 câu bẫy) — **24/24 đúng**.
- Middleware chữ ký ảnh chạy thật: URL ổn định giữa các lần gọi ✓, chấp nhận chữ ký hợp lệ ✓, từ chối chữ ký giả mạo ✓, từ chối dùng chữ ký của file này cho file khác ✓.
- Bộ che log của morgan: `?token=` và `?sig=` đều bị thay bằng `REDACTED`, URL không có query giữ nguyên ✓.

Những gì **chưa** chạy được ở đây (`node_modules` trong repo được cài trên Windows, thiếu binary Linux; và không có Docker trong môi trường này) — cần m chạy trên máy:

```powershell
# 1. Backend: test unit + integration (cần MySQL đang chạy)
docker compose exec backend npm test

# 2. AI service
docker compose exec ai-service pytest -v

# 3. Build lại và khởi động (bắt buộc: backend/ai-service không mount source)
docker compose up -d --build backend ai-service frontend

# 4. Xác nhận cả 4 service khoẻ
docker compose ps
```

Sau khi lên, kiểm nhanh 5 điểm dễ vỡ nhất:

1. **Đăng nhập** `admin@admin.com` / `password` — vẫn phải vào được (mục 4 giữ nguyên mặc định).
2. **Ảnh khuôn mặt** ở trang An ninh — vẫn phải hiện (mục 2 đổi cách phát URL). Nếu ảnh vỡ, xem log backend có dòng 401 `Invalid signature` không.
3. **Realtime** — mở dashboard, để yên >20 phút, số cảm biến vẫn phải cập nhật (mục 10).
4. **Giọng nói** — thử "bật đèn" (phải chạy) và "bật đèn nhà bếp" (phải báo không hiểu, **không** được bật đèn phòng khách) (mục 16).
5. **Sai PIN 3 lần liên tiếp** — lần thứ 4 phải trả 423 "Mã PIN đang bị khoá" (mục 1).

---

# G. Việc còn lại cần m tự quyết

1. **Đặt `SEED_ADMIN_PASSWORD` trong `.env`** rồi chạy lại seed — đây là lỗ hổng duy nhất trong danh sách chưa được bịt hẳn, vì bịt luôn sẽ làm hỏng quy trình demo đã ghi trong tài liệu.
2. **Đổi mật khẩu WiFi nhà** — chuỗi `68686868` từng nằm trong `PairDeviceModal.js` và vẫn còn trong lịch sử git; xoá khỏi code không xoá khỏi history.
3. **Verify 3** (test chống crash-loop của `model_loader.py` + `docker-entrypoint.sh`) vẫn đang gác lại từ phiên trước, chưa chạy.
