# FE → Backend: việc cần backend xử lý

Ghi chú các vấn đề bên backend mà FE phát hiện khi tích hợp, không tự sửa được vì nằm ngoài code FE.

## 1. ✅ `expirePendingCommands` chết theo `SIMULATOR_ENABLED=false` — đã fix

[`src/simulator/runtime.js:62-63`](../src/simulator/runtime.js#L62-L63):

```js
function start() {
  if (started || process.env.SIMULATOR_ENABLED === 'false') return;
  ...
  addInterval('Command timeout monitor', expirePendingCommands, monitorMs);
  addInterval('Offline monitor', markStaleDevicesOffline, monitorMs);
```

`start()` return sớm khi tắt simulator, kéo theo **toàn bộ 4 interval** không chạy — kể cả 2 job không liên quan gì tới simulated device:

- `expirePendingCommands` ([device-command.service.js:215](../src/services/device-command.service.js#L215)) — hết hạn `device_commands` pending quá `expires_at`, áp dụng cho MỌI device (kể cả board Yolobit thật).
- `markStaleDevicesOffline` — đánh dấu device mất kết nối, cũng áp dụng mọi device.

Hệ quả khi deploy môi trường không dùng simulator (`SIMULATOR_ENABLED=false`): command gửi cho device thật mà không được ack sẽ treo mãi ở `pending`, không bao giờ chuyển `expired` — client polling `GET /api/device-actions/:id` không có cách nào biết lệnh đã "chết" để retry.

**Đã fix** ([`src/simulator/runtime.js:62-78`](../src/simulator/runtime.js#L62-L78)): tách `Command timeout monitor` và `Offline monitor` ra khỏi gate `SIMULATOR_ENABLED` — 2 job này giờ chạy ngay khi `start()` chạy, không phụ thuộc flag. Chỉ `Simulator heartbeat` / `Simulator readings` (2 job thật sự chỉ sinh dữ liệu giả) mới return sớm nếu `SIMULATOR_ENABLED=false`.

## 2. ✅ `GET /sensors/:id/readings` với `to` date-only bị mất data cùng ngày — đã fix

Root cause đúng như FE nghi vấn: `new Date("2026-07-26")` parse thành `00:00:00.000Z`, nên `capturedAt.lte` loại hết reading cùng ngày sau mốc đó.

**Đã fix** ([`src/services/telemetry.service.js:38-43,191`](../src/services/telemetry.service.js#L38-L43)): khi `to` match dạng date-only (`YYYY-MM-DD`), tự bump thành cuối ngày `23:59:59.999Z` trước khi query. `from` giữ nguyên hành vi cũ (đầu ngày) vì đúng ý nghĩa "từ ngày X". Verify: `getHistory(1, 7, { from: '2026-07-19', to: '2026-07-26' })` giờ trả đủ 12 reading (trước fix trả `[]`).

FE có thể tiếp tục gửi full ISO datetime như đang làm — không bắt buộc đổi lại, cả 2 dạng đều ra kết quả đúng bây giờ.
