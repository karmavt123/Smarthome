# Backend cần làm thêm gì cho FE

Khảo sát toàn bộ `src/pages` + `src/components` hiện tại (đa số đang hardcode mock data), đối chiếu với API đã có (`BACKEND-CHANGELOG.md`, `DATABASE.md`, `AUTH.md`). Danh sách dưới đây là những gì UI đang cần mà **chưa thấy endpoint tương ứng**.

Chia theo mức độ chặn: **Bắt buộc** (không có thì page không thể nối API thật), **Nên có** (page vẫn chạy được nhưng thiếu tính năng).

---

## 1. Homes — ✅ ĐÃ LÀM (Bắt buộc)

Route mount ở `/api`, `requireAuth`, scope theo `req.user.sub` — [homes.routes.js](../src/routes/homes.routes.js):

- `GET /api/homes` — danh sách nhà của user đang login.
- `POST /api/homes` — tạo nhà mới.
- `PATCH /api/homes/:id`, `DELETE /api/homes/:id` — sửa/xoá nhà (204 No Content).

**Ghi chú cho FE:**
- Xoá home cascade xoá luôn devices/alert_rules/alerts/face_profiles của home đó (FK `onDelete: Cascade` có sẵn) — cần confirm dialog rõ ràng ở `AddHomeCard.js`.
- Body dùng camelCase (`homeId`, không phải `home_id`) như mọi route khác, tự convert qua `case.middleware.js`.
- Test `tests/homes.test.js` (Jest + Supertest) đã viết nhưng **chưa chạy pass được** ở máy dev hiện tại — `.env` `DATABASE_URL`/`DB_PASSWORD` sai so với MySQL root local (`Access denied for user 'root'@'localhost'`). Cần fix env rồi `npm test` xác nhận trước khi FE tin tưởng nối API thật.

FE giờ nối được: `SelectHomePage`, `AddHomeForm.js`, `AddHomeCard.js`.

## 2. Rooms — ✅ ĐÃ LÀM (Bắt buộc)

Route mount ở `/api`, `requireAuth`, scope theo `req.user.sub` — [rooms.routes.js](../src/routes/rooms.routes.js):

- `GET /api/rooms?home_id=` — bắt buộc query `home_id`, thiếu trả `400`.
- `POST /api/rooms` — tạo phòng mới.
- `PATCH /api/rooms/:id`, `DELETE /api/rooms/:id` — sửa/xoá (204 No Content).

**Ghi chú cho FE:**
- Xoá room KHÔNG xoá device trong room — device chỉ mất `room_id` (set NULL), không mất device. `RoomCard.js` an toàn khi xoá phòng.
- Tạo room trùng tên trong cùng home trả `409` (unique `home_id + name`), không phải `400` — `AddRoomForm.js` cần phân biệt lỗi này để báo "tên phòng đã tồn tại", không phải lỗi validate chung.
- Test `tests/rooms.test.js` — cùng tình trạng chưa chạy pass được do env DB, xem ghi chú mục 1.

FE giờ nối được: `RoomsPage`, `AddRoomForm.js`, `RoomCard.js`, `RoomTabs.js`, dropdown chọn room trong `AddDeviceForm.js`.

## 3. Face profiles CRUD — chưa có (Bắt buộc cho SecurityPage)

`BACKEND-CHANGELOG.md` chỉ nói simulator tự tạo 1 demo face profile lúc bootstrap. Không có route nào để FE tự quản lý:

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

Bảng `notifications` đã có, sinh ra từ alert (`alert-evaluation.service.js` có tạo `notifications` theo `BACKEND-CHANGELOG.md` mục 5), nhưng không có route đọc:

- `GET /api/notifications` — danh sách thông báo của user đang login (`NotificationsList.js`).
- `PATCH /api/notifications/:id` (hoặc `PATCH /api/notifications/mark-all-read`) — đánh dấu đã đọc.

## 7. Notification channel preferences — chưa có (Nên có)

`NotificationChannelsCard.js` cho user bật/tắt kênh nhận thông báo (in_app/email/telegram/push) — hiện `notifications.channel` là field ghi lúc tạo, không phải setting của user. Cần:

- `GET/PATCH /api/users/me/notification-preferences` (hoặc field riêng trên `users`) — bật/tắt từng kênh.

Nếu backend chưa có kế hoạch làm feature này, FE tạm ẩn card này cũng được — không chặn cứng.

## 9. ✅ ĐÃ LÀM — `expirePendingCommands` chết theo `SIMULATOR_ENABLED=false`

Phát hiện lúc test Phase 3 (quick-control switch): gửi command cho device thật (`isSimulated: false`), switch bị disable "vĩnh viễn", Network tab spam request `GET /api/device-actions/:id` không dừng.

Nguyên nhân — [`src/simulator/runtime.js:62-63`](../src/simulator/runtime.js#L62-L63): `start()` return sớm khi `SIMULATOR_ENABLED=false`, kéo theo cả `expirePendingCommands`/`markStaleDevicesOffline` không chạy dù 2 job này áp dụng cho mọi device, không riêng simulated — command pending không bao giờ tự chuyển `expired`.

Backend đã fix ([`src/simulator/runtime.js:62-78`](../src/simulator/runtime.js#L62-L78)): tách 2 job này ra khỏi gate `SIMULATOR_ENABLED`, chạy độc lập ngay khi `start()` chạy.

FE vẫn giữ timeout cứng phía client (35s, `useDeviceCommand.js`) làm lớp phòng thủ — không gỡ, đề phòng job backend die vì lý do khác (server restart, deploy...) mà FE không có cách nào biết ngoài tự giới hạn.

## 8. Cập nhật hồ sơ user — chưa có (Nên có)

`AccountInfoCard.js` có form sửa `fullName`/`phone`/`avatarUrl`. `AUTH.md` chỉ có sign-up/sign-in/refresh/sign-out, không có endpoint update profile:

- `GET /api/auth/me` (hoặc `/api/users/me`) — lấy lại profile mới nhất (hiện FE đang dùng cache `authUser` trong localStorage, không tự refresh).
- `PATCH /api/auth/me` (hoặc `/api/users/me`) — cập nhật `fullName`/`phone`/`avatarUrl`. Đổi password nên tách route riêng (`PATCH /api/auth/change-password`, cần `oldPassword`) vì lý do bảo mật, không gộp chung update profile.

## 10. ✅ ĐÃ LÀM — Dashboard thiếu breakdown climate theo phòng

Phát hiện lúc build Phase 4 (`RoomsPage` — climate card theo từng phòng). Response thật của `GET /api/dashboard?home_id=` hiện tại:

```json
"environment": {
  "temperature": { "sensorId": 7, "value": 27.41, "unit": "°C", "history": [...] },
  "humidity": { "sensorId": 8, "value": 53.9, "unit": "%", "history": [...] },
  "light": { "sensorId": 9, "value": 652.55, "unit": "lux", "history": [...] }
}
```

Đây là **1 bộ số liệu duy nhất cho cả home**, không gắn với `room`/`device` nào cả (không có field `roomId`/`deviceId` bên trong từng sensor). Trong khi đó, thực tế 1 home có thể có nhiều device loại `sensor` nằm ở nhiều phòng khác nhau (vd sample seed home 35: "Cảm biến phòng khách" ở phòng khách, "Cảm biến ánh sáng bếp" ở nhà bếp) — không rõ 3 `sensorId` (7/8/9) xuất hiện trong `environment` được chọn ra theo tiêu chí gì khi có nhiều sensor cùng loại trong 1 home.

`new-backend-changes.md` mục 8 mô tả dashboard trả "mọi sensor kèm giá trị mới nhất" — nhưng response thật chỉ có đúng 3 key cố định (`temperature`/`humidity`/`light`), không phải danh sách theo từng sensor/device/room. FE không có cách nào hiển thị climate riêng cho từng phòng từ response hiện tại.

**Cần backend làm 1 trong 2 hướng** (FE ưu tiên hướng 1 vì gọn, không cần thêm round-trip khi chuyển tab phòng):

1. Thêm breakdown theo phòng vào response `GET /api/dashboard` — mỗi phần tử trong `rooms[]` có thêm field `environment` cùng shape với home-wide hiện tại (chỉ gồm sensor type nào thực sự có device trong phòng đó), vd:
```json
"rooms": [
  { "id": 26, "name": "Phòng khách", "environment": { "temperature": {...} } },
  { "id": 27, "name": "Phòng ngủ", "environment": {} }
]
```
2. Hoặc: mỗi `devices[]` có `deviceType: "sensor"` trả kèm `sensors: [{id, sensorType, unit, latestValue}]` — FE tự group theo `device.room.id` để dựng climate card, không cần sửa response `rooms[]`.

Backend đã làm theo hướng 1: mỗi phần tử `rooms[]` giờ có thêm `environment` cùng shape home-wide, chỉ gồm sensor type thực sự có device trong phòng đó (phòng không có sensor thì `environment: {}`). Field `environment` top-level (home-wide) vẫn giữ nguyên song song, không breaking change.

## 11. Bug nhỏ (không chặn) — `GET /sensors/:id/readings` với `to` date-only bị mất data cùng ngày

Phát hiện lúc build Phase 5 (`StatisticsPage`). Gọi `GET /api/sensors/7/readings?from=2026-07-19&to=2026-07-26` trả `readings: []`, dù sensor có data thật lúc `13:40` ngày `2026-07-26` (nằm trong khoảng, xác nhận qua dashboard `history`). Gọi lại không kèm `from`/`to` thì thấy đủ data.

Nghi vấn: `to` dạng date-only (`2026-07-26`, không có giờ) bị parse thành `00:00:00` đầu ngày đó, nên loại mất toàn bộ reading cùng ngày sau mốc `00:00:00` — không phải bug nghiêm trọng, `from`/`to` filter vẫn nên hiểu `to` là cuối ngày (`23:59:59`) khi client chỉ gửi date-only, hoặc tài liệu nên ghi rõ cần gửi full ISO datetime.

FE không chặn bởi cái này — luôn gửi `from`/`to` dạng full ISO datetime (`new Date().toISOString()`) thay vì date-only để né vấn đề, không cần backend fix gấp.

## 12. ✅ ĐÃ LÀM — `DELETE /api/alert-rules/:id`

Backend đã thêm route xoá. FE khôi phục lại nút xoá ở `AlertRulesCard.js` (`onDelete`), gọi `alertService.deleteRule(id)` — optimistic remove khỏi list, revert nếu request fail.

## 13. ✅ ĐÃ LÀM — `DATABASE.md` đã sửa giá trị `alert_rules.condition_operator`

Backend đã cập nhật doc khớp giá trị thật (`gt/lt/gte/lte/eq`). FE code từ đầu đã theo giá trị thật này, không cần đổi gì thêm.

---

## Việc không cần hỏi thêm (đã đủ thông tin để code)

- Device CRUD + commands, telemetry, alert-rules/alerts (theo rule, không phải theo user pref ở mục 7), dashboard, simulator — đã đủ chi tiết trong `BACKEND-CHANGELOG.md`.
- Device creation form (`AddDeviceForm.js`) — chỉ cần thêm route rooms (mục 2) để fill dropdown, phần còn lại dùng `POST /api/devices` sẵn có.

---

## Phase backend làm (ưu tiên endpoint chặn nhiều page nhất trước, module tách rời để sau)

### Phase A — ✅ ĐÃ LÀM — Bắt buộc, chặn gần như toàn bộ FE

**Homes + Rooms CRUD (mục 1, 2).** Xong, xem chi tiết + ghi chú ở mục 1, 2 phía trên. Còn lại 1 việc chặn trước khi FE tin tưởng dùng: fix `.env` DB local để `npm test` chạy pass (`tests/homes.test.js`, `tests/rooms.test.js`).

### Phase B — Bắt buộc, chặn riêng SecurityPage (làm sau Phase A, độc lập với Phase C/D)

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

**Tóm lại thứ tự làm:** A trước tiên (chặn nhiều nhất) → B (chặn SecurityPage, cần chốt kiến trúc verify trước khi code) → C (làm song song lúc nào cũng được, không phụ thuộc A/B) → D (cuối cùng, không gấp).
