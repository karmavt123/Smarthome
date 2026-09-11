# Chức năng bổ sung — 10/09/2026

Tài liệu này nối tiếp `RA-SOAT-VA-SUA-LOI-10-09-2026.md` (đợt sửa lỗi). Lần này là **thêm chức năng còn thiếu**, không phải vá lỗi.

**Tổng cộng: 6 hạng mục, 20 file (2 file backend mới, 2 component frontend mới, 1 file test mới).**

---

## Cách chọn phạm vi

Tiêu chí xếp thứ tự: **giá trị cho bài nộp × mức độ sẵn sàng của backend ÷ rủi ro làm vỡ thứ đang chạy**.

Ưu tiên cao nhất rơi vào nhóm *"backend đã viết xong nhưng không có màn hình nào gọi"* — đây là loại thiếu sót tệ nhất trong một đồ án: công đã bỏ ra rồi, chấm bài lại không thấy, mà chi phí bổ sung thì thấp và rủi ro gần như bằng không (không đụng vào đường dữ liệu đang chạy).

Bị loại khỏi phạm vi lần này:

- **Quên mật khẩu qua email** — cần SMTP + luồng token đặt lại. Là một tính năng riêng, không phải chỗ thiếu.
- **Kênh nhận thông báo (email/telegram/push)** — cần bảng cấu hình + worker gửi. Cùng lý do.
- **Điều khiển simulator từ UI** — backend có `/simulator/bootstrap`, nhưng đây là công cụ dev; đưa lên giao diện chấm điểm dễ gây hiểu nhầm là tính năng thật.

---

## 1. Sửa & xoá thiết bị ngay trên trang Thiết bị

**Trước:** backend có đủ `PATCH /api/devices/:id` và `DELETE /api/devices/:id` (đổi tên, đổi phòng, xoá), `deviceService.update/delete` cũng có sẵn ở frontend — nhưng **không màn hình nào gọi tới**. Đợt trước tôi sửa `apiClient.put` → `apiClient.patch` ở `deviceService`, và chính vì không có UI nên cái sửa đó là code chết, không kiểm chứng được.

Tệ hơn: trang chỉ render `controllableRoomDevices` (đèn/quạt/cửa). **Cảm biến hoàn toàn vô hình** — không xem được, không sửa được, không xoá được, dù nó là thiết bị gửi toàn bộ dữ liệu môi trường.

**Sau:**
- `QuickControlCard` nhận thêm prop `onEdit` → nút bút chì ở góc thẻ.
- `RoomsPage` render **mọi** thiết bị trong phòng, không chỉ loại điều khiển được. Cảm biến hiện thẻ không có công tắc.
- Component mới `EditDeviceForm.js`: đổi tên, chuyển phòng, và xoá thiết bị.

**Tại sao cần:** thiếu CRUD là thiếu ở mức module — "quản lý thiết bị" mà chỉ thêm được, không sửa không xoá được thì chưa gọi là quản lý. Riêng việc cảm biến vô hình còn dẫn tới hệ quả thực tế: seed sinh ra thiết bị `Cam bien Yolo:Bit` mà người dùng không có cách nào đổi tên hay dọn đi.

**Tại sao chọn cách này:**

- *Nút sửa đặt trên chính thẻ thiết bị*, không làm màn hình quản lý riêng — người dùng đang nhìn thẻ nào thì sửa thẳng thẻ đó, không phải nhớ tên thiết bị rồi đi tìm ở trang khác. Đổi lại thẻ chật hơn một chút, chấp nhận được.
- *`device_code` để chỉ đọc* trong form sửa. Đây là **định danh của thiết bị trên MQTT** — đổi nó là cắt đứt liên kết với mọi số đo và lệnh đã ghi, mà lại không có cảnh báo nào. Cho sửa tên (nhãn hiển thị) và phòng (quan hệ) là đủ; những thứ còn lại là danh tính, không phải thuộc tính.
- *Xác nhận xoá hai bước ngay trong modal* thay vì `window.confirm`. Hộp thoại của trình duyệt chặn toàn bộ trang và nằm chồng lên modal vốn đã bẫy focus — vừa xấu vừa dễ kẹt. Hai bước inline giữ mọi thứ trong cùng một luồng.
- *Lỗi 409 được dịch sang tiếng Việt có nghĩa*. Backend từ chối xoá thiết bị còn lịch sử với một câu tiếng Anh dài; UI đổi thành "Thiết bị đã có lịch sử điều khiển hoặc quy tắc cảnh báo, không xoá được. Xoá các mục đó trước."

Kèm theo, `getStatusLabel` thêm nhánh cho cảm biến: trả `"Đang gửi dữ liệu"` thay vì `"Đang bật"` — cảm biến không có trạng thái bật/tắt để người dùng tác động, và câu "Đang bật" nằm cạnh một thẻ không có công tắc thì vô nghĩa.

## 2. Sửa & xoá phòng

**Trước:** `PATCH /api/rooms/:id` và `DELETE /api/rooms/:id` có sẵn, `roomService.update/delete` có sẵn, không ai gọi. Tạo phòng nhầm tên là phải vào thẳng database sửa.

**Sau:** nút **"Sửa phòng"** cạnh nút "Thêm thiết bị", mở `EditRoomForm.js` (component mới): đổi tên hoặc xoá phòng.

**Tại sao chọn cách này:**

- *Thao tác trên phòng đang xem*, không phải chọn phòng trong danh sách — người dùng đã ở trong ngữ cảnh phòng đó rồi (tab phòng đang active), thêm một bước chọn nữa là thừa.
- *Cảnh báo có số lượng cụ thể* trước khi xoá: "N thiết bị trong phòng sẽ bị xoá theo". Quan hệ trong schema là cascade, nên xoá phòng là xoá luôn thiết bị — người dùng phải biết con số đó trước khi bấm, không phải sau.
- *Sau khi xoá thì điều hướng về `/thiet-bi` không kèm query*. Phòng vừa xoá vẫn còn trong URL (`?roomId=...`); không dọn thì trang render trạng thái "phòng không tồn tại" ngay sau một thao tác thành công.
- *Lỗi 409 (trùng tên) được dịch riêng*, giống luồng tạo phòng đã làm sẵn.

## 3. Hiển thị trạng thái mã PIN và trạng thái khoá

**Trước:** `PasscodeCard` không nhận prop nào ngoài `onEdit`, và mang một comment sai:

```js
// Backend has no "is a PIN currently set" status endpoint (only set-pin and
// verify-pin) — this card can't truthfully show active/inactive...
```

Thực tế `GET /api/door-access/pin-status` **có tồn tại**, và `SecurityPage` **đang gọi nó** — chỉ là kết quả bị dùng ở chỗ khác, còn thẻ PIN thì không nhận. Ngoài ra cơ chế khoá PIN tôi thêm ở đợt trước hoàn toàn vô hình: người dùng chỉ biết mình bị khoá khi nhập sai lần thứ 4 và nhận lỗi 423 giữa chừng.

**Sau:**

- Backend: `getPinStatusForDoor` trả thêm `locked`, `lockedUntil`, `lockoutThreshold` (dùng lại `accessLockStatus(deviceId, "password")` đã có).
- Frontend: `SecurityPage` giữ nguyên cả payload thay vì chỉ `hasPin`; `PasscodeCard` hiện badge **"Đã đặt" / "Chưa đặt" / "Đang khoá"** kèm giờ mở lại.

**Tại sao cần:** đây là tính năng bảo mật dễ bị hỏi nhất khi bảo vệ ("Face ID khoá sau 3 lần sai, thế PIN thì sao?"). Có cơ chế mà không nhìn thấy được thì khi demo phải giải thích bằng miệng; hiện lên thẻ thì bấm vào là thấy.

**Tại sao mở rộng endpoint cũ thay vì thêm endpoint mới:** đã có sẵn `GET /door-access/face-lock-status` cho khuôn mặt, nhưng nhân bản thành `pin-lock-status` sẽ thành hai endpoint gần giống nhau mà frontend phải gọi thêm một vòng. `pin-status` vốn đã là "mọi thứ cần biết về PIN của cửa này" — nhét trạng thái khoá vào đúng chỗ đó là mở rộng tự nhiên, không thêm round-trip, không thêm route để nhớ.

## 4. Lọc theo khoảng thời gian cho cảnh báo và lịch sử lệnh

**Trước:** ba thẻ thống kê đều ghi *"7 ngày gần nhất"*, nhưng:

| Thẻ | Thực tế đang lấy |
|---|---|
| `AlertsSeverityCard` | 200 cảnh báo mới nhất, **không lọc ngày** (FE xin 1000, BE cắt còn 200) |
| `DeviceActivityCard` | 50 lệnh mới nhất, **không lọc ngày** |
| `SensorTrendCard` | 500 số đo mới nhất trong khoảng 7 ngày |

Nhà hoạt động nhiều thì "7 ngày" thực chất là "vài giờ gần nhất" — biểu đồ nói dối.

**Sau:** thêm `src/utils/date-range.js` (file mới) với `buildDateRange(query)`, dùng chung cho cả ba đường dữ liệu:

```js
const createdAt = buildDateRange(query);
// -> { gte, lte } | undefined
```

- `listAlerts` và `listDeviceActions` giờ nhận `?from=&to=`.
- `telemetry.service.js` bỏ bản `parseHistoryDate` riêng, dùng chung helper này.
- `StatisticsPage` truyền `from`/`to` xuống cả hai endpoint.

**Tại sao chọn helper dùng chung thay vì viết lọc riêng cho từng service:** trước đó đã có sẵn một bản parse ngày riêng nằm trong `telemetry.service.js`. Copy nó sang hai service nữa là bảo đảm ba bản sẽ lệch nhau — điển hình là quy ước `to`: một chuỗi trần `"2026-09-10"` parse ra **0h00 ngày 10**, nên nếu lấy nguyên thì toàn bộ dữ liệu trong ngày 10 bị loại. Helper xử lý đúng một lần (đẩy `to` về cuối ngày khi nhận ngày trần, giữ nguyên khi nhận ISO đầy đủ), cộng thêm validate `from > to` và ngày không hợp lệ → 400 thay vì lặng lẽ trả sai.

## 5. API gộp số đo theo ngày (mới)

**Trước:** biểu đồ xu hướng tải tối đa 500 số đo thô về trình duyệt rồi tự tính trung bình theo ngày. Với board gửi mỗi 5 giây, 7 ngày ≈ **120.000 bản ghi** — 500 bản ghi chỉ phủ được vài giờ. Nâng giới hạn 500 lên không phải lời giải: kéo 120k dòng về trình duyệt để vẽ 7 cái cột là sai về bản chất.

**Sau:** endpoint mới

```
GET /api/sensors/:id/readings/daily?from=&to=
→ { sensorId, sensorType, unit, from, to,
    days: [{ day: "2026-09-10", avg, min, max, count }] }
```

Gộp bằng `GROUP BY` trong MySQL, trả về đúng 7 dòng. `buildSensorTrend` ở frontend không còn tính trung bình nữa, chỉ ghép 3 chuỗi số liệu lên cùng một trục ngày.

**Tại sao chọn gộp ở database:** đây là việc database làm tốt nhất — `AVG/MIN/MAX` trên một index có sẵn (`idx_sensor_readings_sensor_time`) nhanh hơn nhiều so với truyền hàng chục nghìn dòng qua mạng rồi cộng bằng JavaScript. Ngoài ra API trả thêm `min`/`max`/`count` gần như miễn phí — sau này muốn vẽ dải dao động trong ngày thì đã có sẵn dữ liệu.

**Hai chi tiết đã phải xử lý:**

1. **`DATE_FORMAT` chứ không phải `DATE()`.** `DATE(captured_at)` trả về một `Date` của JS dựng ở nửa đêm **giờ máy**; đưa qua `toISOString()` ở múi giờ UTC+7 sẽ rơi về **ngày hôm trước**. Ép MySQL trả thẳng chuỗi `'%Y-%m-%d'` thì không còn câu hỏi múi giờ nào nữa.
2. **Ép kiểu tường minh mọi cột.** Qua `$queryRaw`, `AVG/MIN/MAX` về dạng `Decimal` còn `COUNT(*)` về dạng `BigInt` — cả hai đều không `JSON.stringify` được trực tiếp. Mỗi trường được `Number()` rõ ràng thay vì tin vào serializer.

Truy vấn dùng tagged template của Prisma nên tham số được bind, không phải nối chuỗi — không có đường SQL injection.

## 6. Test cho helper khoảng thời gian

Thêm `tests/date-range.test.js` (7 case): thiếu bound, ngày trần ở `from`, ngày trần ở `to` phải phủ hết ngày, ISO giữ nguyên, khoảng đảo ngược phải ném 400, ngày rác phải ném 400, tên field tuỳ chỉnh.

**Tại sao đáng test:** quy ước "`to` trần phải tính đến hết ngày" là loại logic mà người đọc code sau này rất dễ "dọn cho gọn" và làm hỏng — hỏng theo kiểu âm thầm mất đúng một ngày dữ liệu ở cuối biểu đồ, không ai để ý. Test không cần DB nên chạy cùng `npm test` bình thường.

---

## Tóm tắt thay đổi API

| Endpoint | Thay đổi |
|---|---|
| `GET /api/alerts` | **Mới:** `?from=`, `?to=` |
| `GET /api/device-actions` | **Mới:** `?from=`, `?to=` (và bổ sung tài liệu Swagger vốn chưa có) |
| `GET /api/door-access/pin-status` | Trả thêm `locked`, `lockedUntil`, `lockoutThreshold` |
| `GET /api/sensors/:id/readings/daily` | **Endpoint mới** — gộp trung bình/nhỏ nhất/lớn nhất theo ngày |
| `GET /api/sensors/:id/readings` | Không đổi hành vi; chuyển sang dùng helper ngày dùng chung |

Tất cả đều **tương thích ngược** — không tham số nào trở thành bắt buộc, không response nào bị bỏ trường.

---

## Kiểm chứng

Đã chạy được ở môi trường hiện tại:

- `eslint src --max-warnings=0` toàn frontend — **0 lỗi, 0 cảnh báo**.
- `node --check` toàn bộ file backend đã đụng — pass.
- `buildDateRange` chạy thật trên 7 case — **7/7 đúng**.
- Logic pivot của `buildSensorTrend` chạy thật với dữ liệu mẫu 3 cảm biến / 2 ngày — ghép đúng trục ngày, làm tròn đúng.
- `prettier` đúng định dạng chung trên mọi file frontend đã sửa.

Cần chạy trên máy có Docker:

```powershell
docker compose up -d --build backend frontend
docker compose exec backend npm test          # co them tests/date-range.test.js
```

Kiểm tay 5 việc:

1. Trang **Thiết bị** → thẻ nào cũng có nút bút chì → đổi tên, chuyển phòng, lưu.
2. Thẻ **cảm biến** giờ phải hiện trong lưới (trước đây không hiện).
3. Nút **"Sửa phòng"** → đổi tên phòng; thử xoá phòng và xem cảnh báo có đúng số thiết bị không.
4. Trang **An ninh** → thẻ "Mật khẩu số" phải hiện badge "Đã đặt"/"Chưa đặt". Nhập sai PIN 3 lần → badge chuyển sang **"Đang khoá"** kèm giờ mở lại.
5. Trang **Thống kê** → biểu đồ xu hướng vẫn vẽ đúng (giờ lấy từ endpoint gộp theo ngày), các thẻ "7 ngày gần nhất" giờ đúng nghĩa 7 ngày.
