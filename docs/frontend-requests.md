# Backend cần làm thêm gì cho FE

Khảo sát toàn bộ `src/pages` + `src/components` hiện tại (đa số đang hardcode mock data), đối chiếu với API đã có (`new-backend-changes.md`, `DATABASE.md`, `AUTH.md`). Danh sách dưới đây là những gì UI đang cần mà **chưa thấy endpoint tương ứng**.

Chia theo mức độ chặn: **Bắt buộc** (không có thì page không thể nối API thật), **Nên có** (page vẫn chạy được nhưng thiếu tính năng).

---

## ✅ Đã làm — Phase A (Homes + Rooms CRUD, mục 1, 2)

Route mới, mount ở `/api`, đều yêu cầu `requireAuth`, scope theo `req.user.sub` (chỉ thấy home/room của chính user đang login):

- `GET /api/homes`, `POST /api/homes` — [homes.routes.js](../src/routes/homes.routes.js)
- `PATCH /api/homes/:id`, `DELETE /api/homes/:id` (204 No Content)
- `GET /api/rooms?home_id=` (bắt buộc query `home_id`, 400 nếu thiếu), `POST /api/rooms` — [rooms.routes.js](../src/routes/rooms.routes.js)
- `PATCH /api/rooms/:id`, `DELETE /api/rooms/:id` (204 No Content)

Ghi chú cho FE:
- Xoá home cascade xoá luôn devices/alert_rules/alerts/face_profiles của home đó (theo FK `onDelete: Cascade` có sẵn trong schema) — nên confirm dialog rõ ràng ở `AddHomeCard.js`.
- Xoá room KHÔNG xoá device — device trong room bị xoá chỉ mất `room_id` (set NULL), không mất device. An toàn hơn cho `RoomCard.js`.
- Tạo room trùng tên trong cùng home trả `409` (unique constraint `home_id + name`), không phải `400` — `AddRoomForm.js` nên phân biệt lỗi này để báo "tên phòng đã tồn tại".
- Request body dùng camelCase như các route khác (`homeId`, không phải `home_id`) nhờ `case.middleware.js` tự convert.
- Đã có test `tests/homes.test.js`, `tests/rooms.test.js` (Jest + Supertest, cùng kiểu integration test như `devices.test.js`) — **chưa chạy được ở máy hiện tại** vì `.env` có `DB_PASSWORD`/`DATABASE_URL` không khớp mật khẩu MySQL root local (`Access denied for user 'root'@'localhost'`). Cần fix `.env` hoặc reset password MySQL rồi chạy `npm test` để confirm trước khi merge.

Đã đủ để FE nối `SelectHomePage`, `AddHomeForm.js`, `AddHomeCard.js`, `RoomsPage`, `AddRoomForm.js`, `RoomCard.js`, `RoomTabs.js`, và dropdown chọn room trong `AddDeviceForm.js`.

## 1. Homes — chưa có resource nào (Bắt buộc)

`dashboard` nhận `home_id` làm tham số, `alert-rules`/`alerts`/`face-profiles` đều scope theo home — nghĩa là "home" đã tồn tại ở DB, nhưng không có route nào để FE tạo/xem/sửa/xoá:

- `GET /api/homes` — danh sách nhà của user đang login (dùng ở `SelectHomePage`, hiện đang hardcode `HOMES`).
- `POST /api/homes` — tạo nhà mới (`AddHomeForm.js`).
- `PATCH /api/homes/:id`, `DELETE /api/homes/:id` — sửa/xoá nhà (`AddHomeCard.js` implies quản lý nhà).

Không có cái này thì `SelectHomePage` và toàn bộ flow "chọn home_id để gọi dashboard" không nối API thật được — chặn luôn phase dashboard bên FE.

## 2. Rooms — chưa có resource nào (Bắt buộc)

`devices.room_id` optional nhưng UI có hẳn flow quản lý phòng (`RoomsPage`, `AddRoomForm.js`, `RoomCard.js`, `RoomTabs.js`):

- `GET /api/rooms?home_id=` — danh sách phòng theo nhà.
- `POST /api/rooms` — tạo phòng mới.
- `PATCH/DELETE /api/rooms/:id` — sửa/xoá phòng.

`AddDeviceForm.js` cũng cần danh sách này để gán `room_id` lúc tạo device.

## 3. Face profiles CRUD — chưa có (Bắt buộc cho SecurityPage)

`new-backend-changes.md` chỉ nói simulator tự tạo 1 demo face profile lúc bootstrap. Không có route nào để FE tự quản lý:

- `GET /api/face-profiles?home_id=` — danh sách hồ sơ khuôn mặt (`FaceProfilesCard.js`).
- `POST /api/face-profiles` — tạo hồ sơ mới (`AddFaceProfileForm.js` có bước "quét mặt qua camera cửa để hoàn tất đăng ký" — cần làm rõ enrollment flow: FE gửi ảnh/embedding thẳng, hay tạo profile trước rồi thiết bị tự cập nhật `face_embedding` sau khi quét?).
- `DELETE /api/face-profiles/:id` — xoá hồ sơ.

## 4. Door passcode (PIN) — chưa có (Bắt buộc cho SecurityPage)

Bảng `door_passwords` đã có trong DB nhưng không route nào được nhắc:

- `GET /api/door-passwords/:doorDeviceId` — trạng thái passcode hiện tại (active/inactive, không trả hash) cho `PasscodeCard.js`.
- `POST/PATCH /api/door-passwords/:doorDeviceId` — đặt/đổi PIN (`ChangePasscodeForm.js`) — validate ở BE, hash trước khi lưu, không bao giờ trả plaintext về FE.

## 5. Xác thực unlock (PIN/Face) — cần làm rõ, không chỉ là log (Bắt buộc)

`POST /api/door-access/events` hiện tại **chỉ ghi log**, chặn cứng field `pin`/`password` trong payload — tức là không dùng để xác thực. Nhưng `UnlockPinPad.js`/`UnlockFaceId.js` cần 1 chỗ để thực sự *kiểm tra* PIN/face rồi mới mở cửa. Cần backend trả lời:

- Có API riêng để verify (vd `POST /api/door-access/verify-pin` nhận PIN, backend so hash rồi trả `success/failed`, tự ghi `door_access_logs` luôn, tự tạo `device_actions` mở cửa nếu đúng)?
- Hay dự định flow này chỉ chạy trên thiết bị (Yolobit) — nhập PIN tại bàn phím vật lý, không qua app — và FE chỉ hiển thị log, không có nút "unlock" thật từ app?

Cần chốt trước khi code `SecurityPage`, vì 2 hướng này khác nhau hoàn toàn về UI (có nút unlock hay chỉ xem lịch sử).

## 6. Notifications — route đọc/cập nhật (Bắt buộc cho NotificationsPage)

Bảng `notifications` đã có, sinh ra từ alert (`alert-evaluation.service.js` có tạo `notifications` theo `new-backend-changes.md` mục 5), nhưng không có route đọc:

- `GET /api/notifications` — danh sách thông báo của user đang login (`NotificationsList.js`).
- `PATCH /api/notifications/:id` (hoặc `PATCH /api/notifications/mark-all-read`) — đánh dấu đã đọc.

## 7. Notification channel preferences — chưa có (Nên có)

`NotificationChannelsCard.js` cho user bật/tắt kênh nhận thông báo (in_app/email/telegram/push) — hiện `notifications.channel` là field ghi lúc tạo, không phải setting của user. Cần:

- `GET/PATCH /api/users/me/notification-preferences` (hoặc field riêng trên `users`) — bật/tắt từng kênh.

Nếu backend chưa có kế hoạch làm feature này, FE tạm ẩn card này cũng được — không chặn cứng.

## 8. Cập nhật hồ sơ user — chưa có (Nên có)

`AccountInfoCard.js` có form sửa `fullName`/`phone`/`avatarUrl`. `AUTH.md` chỉ có sign-up/sign-in/refresh/sign-out, không có endpoint update profile:

- `GET /api/auth/me` (hoặc `/api/users/me`) — lấy lại profile mới nhất (hiện FE đang dùng cache `authUser` trong localStorage, không tự refresh).
- `PATCH /api/auth/me` (hoặc `/api/users/me`) — cập nhật `fullName`/`phone`/`avatarUrl`. Đổi password nên tách route riêng (`PATCH /api/auth/change-password`, cần `oldPassword`) vì lý do bảo mật, không gộp chung update profile.

---

## Việc không cần hỏi thêm (đã đủ thông tin để code)

- Device CRUD + commands, telemetry, alert-rules/alerts (theo rule, không phải theo user pref ở mục 7), dashboard, simulator — đã đủ chi tiết trong `new-backend-changes.md`.
- Device creation form (`AddDeviceForm.js`) — chỉ cần thêm route rooms (mục 2) để fill dropdown, phần còn lại dùng `POST /api/devices` sẵn có.

---

## Phase backend làm (ưu tiên endpoint chặn nhiều page nhất trước, module tách rời để sau)

### Phase A — Bắt buộc, chặn gần như toàn bộ FE — ✅ Đã xong

**Homes + Rooms CRUD (mục 1, 2).** Không có 2 cái này thì FE không có `home_id`/`room_id` thật để gọi bất kỳ endpoint nào khác (`dashboard`, `alert-rules`, `face-profiles` đều scope theo home) — mọi phase FE từ `SelectHomePage` trở đi đứng im chờ cái này.

- ✅ `GET/POST /api/homes`, `PATCH/DELETE /api/homes/:id`
- ✅ `GET /api/rooms?home_id=`, `POST /api/rooms`, `PATCH/DELETE /api/rooms/:id`

Chi tiết + ghi chú FE ở mục "✅ Đã làm" phía trên. **Còn thiếu:** chạy `npm test` để confirm (bị chặn bởi lỗi `.env`/MySQL cục bộ, xem ghi chú).

### Phase B — Bắt buộc, chặn riêng SecurityPage (làm sau Phase A, độc lập với Phase C/D) — tiếp theo

**Door passcode + flow xác thực unlock (mục 4, 5).** Cần chốt kiến trúc trước (app xác thực hay chỉ thiết bị vật lý xác thực) rồi mới code, vì 2 hướng ra API khác nhau.

- `GET/POST/PATCH /api/door-passwords/:doorDeviceId`
- Trả lời + implement flow verify PIN/face (route mới hoặc xác nhận không cần route, chỉ hardware)

**Face profiles CRUD (mục 3).** Tách rời khỏi door passcode, có thể làm song song hoặc sau, chỉ chặn `FaceProfilesCard`/`AddFaceProfileForm`.

- `GET/POST/DELETE /api/face-profiles`

### Phase C — Bắt buộc nhưng độc lập, không phụ thuộc Phase A/B

**Notifications read + mark-read (mục 6).** Không liên quan home/room/door — làm bất kỳ lúc nào, không chặn page khác ngoài `NotificationsPage`.

- `GET /api/notifications`, `PATCH /api/notifications/:id` (hoặc `mark-all-read`)

### Phase D — Nên có, không gấp, không chặn phase nào khác

- User profile update (mục 8): `GET/PATCH /api/auth/me`, `PATCH /api/auth/change-password` riêng. FE tạm ẩn nút "Lưu" ở `AccountInfoCard` nếu chưa có.
- Notification channel preferences (mục 7): `GET/PATCH /api/users/me/notification-preferences`. FE tạm ẩn `NotificationChannelsCard` nếu chưa có.

---

**Tóm lại thứ tự làm:** ~~A trước tiên (chặn nhiều nhất)~~ ✅ xong → B (chặn SecurityPage, cần chốt kiến trúc verify trước khi code) → C (làm song song lúc nào cũng được, không phụ thuộc A/B) → D (cuối cùng, không gấp).
