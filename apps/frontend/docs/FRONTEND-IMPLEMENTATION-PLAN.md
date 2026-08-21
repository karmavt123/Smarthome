# Kế hoạch implement FE cho `BACKEND-CHANGELOG.md`

Trạng thái hiện tại (đã khảo sát code): **toàn bộ page (`HomePage`, `RoomsPage`, `SecurityPage`, `StatisticsPage`, `NotificationsPage`, `SettingsPage`, `SelectHomePage`) đang dùng data hardcode, không gọi service nào.** `deviceService.js` tồn tại nhưng không được import ở đâu cả, và có 1 method `toggle()` gọi `PATCH /devices/:id/toggle` — endpoint này không còn đúng với backend mới (điều khiển thiết bị giờ là async qua `POST /devices/:id/commands`). Đây gần như là wiring từ đầu, không phải sửa chỗ hỏng.

Chia làm các phase, mỗi phase làm xong review/test được độc lập trước khi qua phase sau.

---

## Gap cần chốt trước khi code (chặn 1 số phase bên dưới)

~~Homes + Rooms CRUD~~ — **backend đã làm xong** (`GET/POST /api/homes`, `PATCH/DELETE /api/homes/:id`, `GET /api/rooms?home_id=`, `POST /api/rooms`, `PATCH/DELETE /api/rooms/:id`, xem `BACKEND-REQUESTS.md` mục 1, 2). Lưu ý: test `tests/homes.test.js`/`tests/rooms.test.js` chưa chạy pass được ở máy dev do `.env` DB sai — chờ backend confirm trước khi tin tưởng 100%, nhưng không còn chặn code FE (route đã tồn tại, đọc đúng schema).

Còn lại các gap sau vẫn chưa có, chặn `SecurityPage`/`NotificationsPage`:

1. **Danh sách notifications** (`NotificationsPage`) — bảng `notifications` có trong DB nhưng không thấy route `GET/PATCH /api/notifications`.
2. **Flow unlock cửa bằng password/face từ FE** — `POST /api/door-access/events` chỉ *ghi log* sự kiện (và chặn cứng field `pin`/`password` trong payload), không rõ ai là nơi xác thực password/face thật (`door_passwords`, `face_profiles`). Cần hỏi: FE gọi API nào để xác thực trước, rồi mới log event? Hay việc unlock chỉ dành cho simulator/hardware và FE chỉ hiển thị log?
3. **Face profiles CRUD** — `SecurityPage`/`FaceProfilesCard` cần thêm/sửa/xoá hồ sơ khuôn mặt, không thấy route nào ngoài việc simulator tự tạo 1 demo profile.

Đề xuất: làm phase 1–6 (nền tảng, home context, dashboard, rooms, statistics, settings) trước vì không phụ thuộc các gap còn lại, song song hỏi backend về 3 điểm trên trước khi làm tới SecurityPage/NotificationsPage.

---

## Phase 1 — Service layer

Không đụng UI, chỉ dựng lại tầng gọi API cho khớp backend mới.

- `src/services/deviceService.js` — bỏ `toggle()` (endpoint chết), thêm `sendCommand(deviceId, payload)` → `POST /devices/:id/commands` (payload gồm `action`, `value?`, `commandId?` cho idempotency).
- `src/services/deviceActionService.js` (mới) — `list(params)` → `GET /device-actions`, `getById(id)` → `GET /device-actions/:id` (dùng để poll trạng thái command).
- `src/services/telemetryService.js` (mới) — `sendReadings(payload)` → `POST /telemetry/readings`, `getSensorReadings(sensorId, params)` → `GET /sensors/:id/readings`, `sendHeartbeat(deviceId)` → `POST /devices/:id/heartbeat`.
- `src/services/alertService.js` (mới) — `listRules()`/`createRule()`/`updateRule(id, data)` → `/alert-rules`, `listAlerts(params)`/`updateAlert(id, data)` → `/alerts`.
- `src/services/doorAccessService.js` (mới) — `listEvents(params)` → `GET /door-access/events`, `createEvent(payload)` → `POST /door-access/events` (không bao giờ gửi field `pin`/`password`).
- `src/services/voiceCommandService.js` (mới) — `send(recognizedText)` → `POST /voice-commands`.
- `src/services/dashboardService.js` (mới) — `get(homeId)` → `GET /dashboard?home_id=`.
- `src/services/simulatorService.js` (mới, dev-only) — `bootstrap()` → `POST /simulator/bootstrap`, `setConnectivity(deviceId, paused)` → `PATCH /simulator/devices/:id/connectivity`.
- `src/services/homeService.js` (mới) — `getAll()` → `GET /homes`, `create(data)` → `POST /homes`, `update(id, data)` → `PATCH /homes/:id`, `delete(id)` → `DELETE /homes/:id`.
- `src/services/roomService.js` (mới) — `getAll(homeId)` → `GET /rooms?home_id=`, `create(data)` → `POST /rooms`, `update(id, data)` → `PATCH /rooms/:id`, `delete(id)` → `DELETE /rooms/:id`.

Tất cả theo đúng pattern copy từ `deviceService.js` hiện có, camelCase thuần, không convert case ở FE (theo CLAUDE.md).

**Test:** gọi thử từng method qua console/Postman-style script tạm, không cần UI.

---

## Phase 2 — Current-home context (nền tảng cho mọi page)

Hầu hết endpoint mới cần `home_id`. Cần 1 nơi giữ "nhà đang chọn":

- `SelectHomePage` gọi `homeService.getAll()` thay hardcode `HOMES` — nếu rỗng thì hiện `AddHomeForm.js` trước (dùng `homeService.create()`), chưa cần fallback simulator nữa vì API homes đã có thật.
- Thêm `src/contexts/HomeContext.js` (hoặc hook `useCurrentHome` dựa trên `localStorage` key `currentHomeId`) — set lúc user chọn nhà ở `SelectHomePage`, đọc lại lúc reload. Validate lại `currentHomeId` còn tồn tại trong `homeService.getAll()` lúc bootstrap (phòng trường hợp home đã bị xoá ở tab khác).
- Nếu muốn có sẵn data demo lúc dev cho nhanh (sensor/device đầy đủ) vẫn có thể gọi `simulatorService.bootstrap()` thủ công (Phase 10), nhưng không còn là workaround bắt buộc — chỉ là tiện ích dev.

**Test:** tạo home mới qua `AddHomeForm.js` → chọn nhà ở `SelectHomePage` → `home_id` available ở mọi page con của `MainLayout`.

---

## Phase 3 — HomePage: dashboard tổng quan

- Thay `STATS`/`ROOMS`/`DEVICES`/`ALERTS` hardcode bằng `dashboardService.get(homeId)`.
- Map field: `sensors[].latestValue` + `history` (12 điểm) → `StatCard`/`Sparkline`; `devices[]` (kèm `isSimulated`/`simulationPaused`) → `QuickControlCard`; `environmentStatus` (safe/warning/critical) → banner màu.
- `toggleControl` hiện tại chỉ flip state local — đổi thành: gọi `deviceService.sendCommand(id, {action, commandId: uuid()})`, set switch về trạng thái "pending" (disable + spinner), rồi poll `deviceActionService.getById(commandId)` mỗi ~500ms tới khi `status` là `executed`/`failed`/`expired`, cập nhật lại switch theo kết quả thật.
- Refresh dashboard định kỳ (vd mỗi 5–10s, khớp nhịp simulator backend) để thấy sensor/alert cập nhật mà không cần F5 — dùng `setInterval` trong `useEffect`, cleanup lúc unmount.

**Test:** bootstrap simulator, xem `HomePage` load đúng home ảo, đợi vài giây thấy chart tăng dần, bấm switch thấy pending → executed/failed (~8% fail).

---

## Phase 4 — RoomsPage

- Danh sách phòng thật qua `roomService.getAll(homeId)` (thay `INITIAL_ROOMS` hardcode) — `RoomTabs.js`/`AddRoomForm.js` nối thẳng vào đây. Lưu ý tạo trùng tên phòng trong cùng home trả `409` (unique `home_id+name`), cần bắt riêng để báo lỗi đúng ("tên phòng đã tồn tại"), không phải lỗi validate chung.
- Xoá phòng (`RoomCard.js`) không xoá device trong phòng đó (BE chỉ set `room_id = null`) — UI nên confirm nói rõ "device sẽ chuyển về chưa gán phòng", không phải "sẽ bị xoá".
- Devices theo phòng: lấy từ `dashboardService` (đã có sẵn theo home) hoặc `deviceService.getAll()` lọc theo `roomId`.
- Climate card (`CLIMATE_BY_ROOM`) dùng sensor latest value từ dashboard response, lọc theo room.
- `toggleDevice`/`turnOffAll` — dùng chung logic pending/poll ở Phase 3 (nên rút thành hook `useDeviceCommand` để tái dùng, tránh copy-paste giữa Home/Rooms/Security).

**Test:** tạo/xoá phòng, bật/tắt đèn quạt trong từng phòng, xác nhận trạng thái đồng bộ với `HomePage` (cùng nguồn dữ liệu).

---

## Phase 5 — StatisticsPage

- `SENSOR_TREND` → `telemetryService.getSensorReadings(sensorId, {from, to})`, cần chọn sensor (per-room hoặc per-home aggregate — kiểm tra dashboard đã có history sẵn dùng luôn cho nhanh).
- `DEVICE_ACTIVITY` (app/voice/face/automatic/manual theo ngày) → `deviceActionService.list()` group theo `control_method` + ngày (group ở FE vì backend chỉ trả list).
- `ALERTS_SEVERITY` → `alertService.listAlerts()` group theo `severity`.

**Test:** so dữ liệu hiển thị khớp với action/alert vừa tạo ở phase 3/4.

---

## Phase 6 — SettingsPage (alert rules + account)

- `AlertRulesCard`/`AlertRuleForm` → CRUD thật qua `alertService` (`listRules`, `createRule`, `updateRule` cho toggle `isActive` và xoá — kiểm tra backend có DELETE hay chỉ PATCH `isActive: false`, tài liệu chỉ nhắc GET/POST/PATCH nên có thể không có xoá cứng).
- `AccountInfoCard` → lấy từ `useAuth().user` thay vì props hardcode.

**Test:** tạo rule ngưỡng thấp (vd temperature > 20), đợi simulator sinh reading vượt ngưỡng, xác nhận alert xuất hiện ở `AlertsSeverityCard`/`HomePage`.

---

## Phase 7 — SecurityPage (phụ thuộc gap #3, #4)

- `AccessLogTable`/`IncidentDetail` → `doorAccessService.listEvents()`, filter theo `result: failed` cho incident.
- `DoorLockCard` mở/khoá cửa → dùng `useDeviceCommand` (action `open`/`close`) giống Phase 3/4, không phải local `setLocked`.
- `UnlockPinPad`/`UnlockFaceId` — **chờ chốt gap #3** trước khi code, tránh làm sai flow xác thực.
- `FaceProfilesCard` — **chờ chốt gap #4**, tạm thời chỉ hiển thị read-only nếu chưa có API CRUD.

**Test:** thử unlock qua PIN sai → thấy log `failed` xuất hiện đúng; thử gửi `pin` trong payload `door-access/events` để xác nhận FE không bao giờ làm vậy (chặn ở service layer, không rely vào backend chặn).

---

## Phase 8 — NotificationsPage (phụ thuộc gap #2)

- Chờ chốt gap #2 (chưa có endpoint). Nếu không có trong scope backend hiện tại, giữ nguyên mock hoặc ẩn page tạm, note rõ trong PR.

---

## Phase 9 — Voice command UI (tính năng mới, chưa có UI)

- Thêm entry point gọi giọng nói/nhập text — quick-add vào `HomePage` (nút mic hoặc ô input nhỏ) thay vì tạo page riêng, vì tính năng này bổ trợ điều khiển nhanh chứ không phải 1 khu vực nội dung riêng.
- Dùng Web Speech API (`SpeechRecognition`) để lấy text nói → gọi `voiceCommandService.send(text)` → hiển thị kết quả parse (device tìm được + action) hoặc `unknown_command`.
- Fallback: nếu trình duyệt không hỗ trợ Speech API, cho nhập text tay.

**Test:** gõ "bat den phong khach", xác nhận queue đúng command cho đèn phòng khách đã bootstrap.

---

## Phase 10 — Dev-only simulator panel

- 1 component nhỏ (chỉ hiện khi `import.meta.env.DEV`) gọi `simulatorService.bootstrap()` và toggle connectivity từng device — giúp test local không cần Postman.
- Đặt ở `SettingsPage` hoặc 1 route riêng `/dev/simulator`, không route trong nav chính.

**Test:** bootstrap từ UI, pause door, thử gửi command cho door thấy lỗi "Device is offline" hiển thị đúng ra ngoài UI (không silent fail).

---

## Phase 11 — Cross-cutting: polling hook + error surface

- Rút `useDeviceCommand(deviceId)` hook dùng chung (Phase 3/4/7): gửi command, track pending/executed/failed, expose ra UI.
- Chuẩn hoá lỗi: backend ném `HttpError` (`status` + `details`) qua `error.middleware.js` — kiểm tra `apiClient.js` interceptor hiện parse `error.response.data` thế nào, thêm helper `getErrorMessage(err)` dùng chung, hiển thị qua toast/banner thay vì `alert()`/console.
- Backend không có websocket — mọi "real-time" ở FE đều là polling (dashboard refresh interval + command status poll). Note rõ trong code comment tại hook, vì dễ bị hiểu nhầm là cần realtime infra.

---

## Thứ tự đề xuất

1 → 2 → 3 → 4 → 6 → 5 → 9 → 10 → 11 (rút hook sau khi đã có 2-3 chỗ dùng thực tế) → 7, 8 sau khi gap chốt xong.
