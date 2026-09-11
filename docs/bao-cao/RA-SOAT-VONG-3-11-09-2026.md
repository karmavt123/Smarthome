# Rà soát vòng 3 — 11/09/2026

Vòng này khác hai vòng trước ở một điểm: **không có lỗi nào tự tìm ra.** Toàn bộ 13 lỗi dưới đây do hai agent kiểm thử đối kháng tìm được, chạy trên **dữ liệu seed thật của dự án** và trên **MySQL 8.0.46 thật**. Bốn trong số đó là hồi quy do chính các bản sửa vòng 2 gây ra.

Đó là kết luận đáng ghi lại nhất của cả ba vòng: mỗi vòng sửa đều tự tin, tự viết test cho chính mình, test đều xanh — và vòng sau vẫn tìm ra lỗ ở đúng chỗ vừa sửa. Chi tiết ở mục cuối.

---

## Phần 1 — `selectDevice`: lần sửa thứ 5

### Lỗi là gì

Người dùng nói *"bật đèn phòng ngủ"*, nhà chỉ có **Đèn phòng khách** → hệ thống bật đèn phòng khách và báo **thành công**.

Hàm này đã sửa hỏng **4 lần**. Mỗi lần đều có test riêng, test đều xanh, và lần nào cũng lọt:

| Lần | Quy tắc | Lọt ở đâu |
|---|---|---|
| 1 | Từ chối khi điểm cao nhất = 0 | Gần như mọi tên tiếng Việt đều chứa "phòng" nên không bao giờ có điểm 0 |
| 2 | …và có hoà điểm | Tên bất đối xứng ("Đèn phòng khách" vs "Đèn sân vườn") cho ra người thắng rõ ràng bằng một từ không định danh ai cả |
| 3 | Từ chối mọi từ lạ, gộp chung mọi tên thiết bị, trừ khi chỉ có 1 thiết bị | Lọt **hai lần**: gộp chung khiến từ sai "khớp" nhờ tên thiết bị *khác*; và lối tắt `devices.length === 1` chạy **trước** lớp bảo vệ nên vô hiệu hoá toàn bộ bản sửa trên đúng seed data của dự án |
| 4 | Chỉ từ ngữ chỉ nơi chốn có thật mới được từ chối | Đúng ý tưởng, sai độ mịn — xem dưới |

### Lần 4 sai ở đâu (lỗi do vòng 2 tự gây ra)

Agent chạy 55 câu tiếng Việt tự nhiên trên 3 nhà seed thật. **14 câu bình thường bị từ chối oan:**

```
REFUSED | tắt hết đèn trong nhà      quals=[nha]
REFUSED | tắt đèn rồi đi ngủ         quals=[ngu]
REFUSED | bật công tắc đèn           quals=[cong]
REFUSED | bật đèn cảm ơn bạn         quals=[cam]
REFUSED | bật đèn cho sáng           quals=[sang]
REFUSED | tăng quạt lên              quals=[tang]
REFUSED | tắt đèn lâu rồi bật lại đi quals=[lau]
REFUSED | tắt tạm cái đèn            quals=[tam]
REFUSED | bật đèn phòng khách nhá anh quals=[khach,nha,anh]
```

Hai nguyên nhân gốc:

**(a) Từ vựng bị nhiễm bởi tên cảm biến.** Vòng 2 nạp tên **mọi** thiết bị trong nhà vào từ vựng nơi chốn. Nhà seed có `Cảm biến ánh sáng bếp` → đưa `cảm`, `ánh`, `sáng` vào từ vựng. Từ đó *"bật đèn cho sáng"* bị đọc thành "người dùng gọi tên một nơi chốn".

**(b) Bỏ dấu tiếng Việt tạo ra hàng loạt từ đồng tự.** Sau `normalizeText`:

$$\text{tạm} \to \texttt{tam} \gets \text{tắm} \qquad \text{lâu} \to \texttt{lau} \gets \text{lầu} \qquad \text{tăng} \to \texttt{tang} \gets \text{tầng}$$
$$\text{nhá} \to \texttt{nha} \gets \text{nhà} \qquad \text{công tắc} \to \texttt{cong} \gets \text{ban công} \qquad \text{ngủ} \to \texttt{ngu} \gets \text{phòng ngủ}$$

**Không một danh sách từ nào phân biệt được `ngủ` (đi ngủ) với `ngủ` (phòng ngủ) — chúng là cùng một từ.** Đây là lý do cách tiếp cận "danh sách từ" không thể đúng, dù có bổ sung bao nhiêu lần.

### Cách sửa (lần 5) — ba cơ chế, mỗi cái một việc

**1. Khớp theo CỤM, không theo túi từ.**

```js
// TRƯỚC: túi từ — mọi từ trong mọi tên phòng đều là "từ nơi chốn"
const namesWords = new Set(devices.flatMap((d) => normalizeText(d.name).split(' ')));

// SAU: cụm — "nha bep" phải xuất hiện liền nhau mới tính
function placePhrases(names) { /* mỗi tên -> mảng từ, khớp liên tiếp */ }
```

Phòng `Nhà bếp` không còn biến mọi chữ "nhá" thành lời gọi nhà bếp.

**2. Quy tắc VỊ TRÍ — phần mà danh sách từ không bao giờ làm được.**

Từ định danh thiết bị **nằm cạnh danh từ thiết bị**, trong một chuỗi liền mạch gồm từ chung và từ nơi chốn. Từ lạ **cắt** chuỗi đó.

```js
function qualifierRun(tokens, marked) {
  let anchor = -1;                                   // danh từ thiết bị cuối cùng
  for (let i = tokens.length - 1; i >= 0; i -= 1)
    if (DEVICE_NOUNS.has(tokens[i])) { anchor = i; break; }
  const partOfRun = (i) => GENERIC_WORDS.has(tokens[i]) || marked[i];
  while (low - 1 >= 0 && partOfRun(low - 1)) low -= 1;   // sang trái (tiếng Anh)
  while (high + 1 < n && partOfRun(high + 1)) high += 1; // sang phải (tiếng Việt)
}
```

| Câu | Chuỗi sau "đèn" | Kết quả |
|---|---|---|
| `bật đèn phòng ngủ` | `phòng`(chung) → `ngủ`(nơi chốn) | `ngu` **tính** → từ chối đúng |
| `tắt đèn rồi đi ngủ` | `rồi` → **cắt** | `ngu` không tính → chạy đúng |
| `bật công tắc đèn` | trái: `tắc` → **cắt** | `cong` không tính → chạy đúng |
| `tắt hết đèn trong nhà` | `trong` → **cắt** | `nha` không tính → chạy đúng |

**3. Từ vựng chỉ lấy từ `rooms`, không lấy tên thiết bị khác loại.**

```js
// TRƯỚC
const vocabulary = [...homeDevices.map((i) => i.name), ...rooms.map((r) => r.name)];
// SAU
const vocabulary = rooms.map((room) => room.name);
```

Cảm biến không bao giờ là đích của lệnh giọng nói, mà tên nó lại dài và mô tả. Bảng `rooms` đã chứa đủ mọi nơi chốn — đó là thứ duy nhất từ vựng này cần.

### Hai lỗ nhỏ phát hiện thêm khi kiểm lại

- `mở cửa chính` mở nhầm **Cửa nhà bếp**. `chính` không phải tên phòng nên bị coi là từ đệm. → thêm `chinh`, `phu`, `main` vào từ nơi chốn. **Cố ý không thêm** `trước`/`sau`/`back`: *"turn the light back on"* sẽ bị từ chối oan.
- `bật đèn số 2` bật đèn duy nhất trong nhà. `số` cắt chuỗi nên số `2` rơi ra ngoài. → đưa `so`, `thu`, `number` vào từ chung để chuỗi **đi xuyên qua** chúng tới con số.
- `mở cửa số 2` bị từ chối vì trùng luật "cửa sổ". → luật đó nay **huỷ khớp khi theo sau là một con số**: `cửa sổ` không bao giờ đi kèm số, `cửa số` thì luôn.

### Kết quả đo được

| Bộ đo | Trước (lần 4) | Sau (lần 5) |
|---|---|---|
| 55 câu tự nhiên × 3 nhà seed thật | **14 từ chối oan** | **0** |
| Bộ 70 ca gốc (gồm mọi ca từ chối của 4 lần trước) | 70/70 | **70/70** |
| Seed thật, 33 ca cả hai chiều | — | **33/33** |

---

## Phần 2 — Cửa & mã PIN (5 lỗi)

### 2.1 — DoS khoá cửa chủ nhà *(hồi quy do vòng 2 gây ra)*

Vòng 2 chặn `result: 'success'` giả cho `password`/`face` — nhưng để hở **chiều ngược lại**.

```
POST /api/door-access/events {"accessMethod":"password","result":"failed"} × 3
  → verify-pin và set-pin đều trả 423 suốt 5 phút, lặp lại vô hạn
```

Chủ nhà bị khoá khỏi chính cửa nhà mình. **Sửa:** từ chối `password`/`face` ở endpoint này **cả hai chiều**. `verify-pin`/`verify-face` tự ghi log của chúng, nên không có nhu cầu hợp lệ nào cần ghi qua đây.

### 2.2 — `voice`/`app` success mở cửa ảo

`result:'success'` với `voice` ghi thẳng `devices.status='open'` + đẩy SSE mà **không hề nói chuyện với board**. `executeVoiceCommand` cố tình từ chối xếp lệnh cho cửa và trả `requiresVerification` — endpoint này trả lại đúng cái trạng thái mà lớp bảo vệ kia đang giữ. **Sửa:** chỉ `manual` mới được ghi `success`.

### 2.3 — `manual` vẫn là cùng lỗ đó *(agent tìm ra, sau khi 2.2 đã sửa)*

Sửa 2.2 chưa đủ. Frontend chốt bước xác thực bằng **trạng thái thiết bị**, không phải bằng access method:

```js
// VoiceSearchModal.js
const isDoorOpenNeedsVerify = res?.requiresVerification && … && device?.status !== 'open';
```

Nên `{"accessMethod":"manual","result":"success"}` → `status='open'` → lần "mở cửa" tiếp theo **bỏ qua bước nhập PIN/Face**.

**Sửa:** endpoint này **không ghi `devices.status` nữa, với bất kỳ method nào.** Nó ghi lại một lần truy cập đã xảy ra; nó chưa từng nói chuyện với board nên không có cơ sở gì khẳng định cửa đã mở. Cột đó thuộc về lớp MQTT.

### 2.4 — `faceProfileId` giả mạo được nhật ký

`{"accessMethod":"manual","result":"success","faceProfileId":P}` → 201, và lịch sử hiển thị một lần mở cửa thành công **kèm tên và ảnh** của người đó. Đổ tội cho một thành viên vô can. **Sửa:** từ chối `faceProfileId` — không method nào còn được phép ở đây có chỗ dùng nó.

### 2.5 — Cảnh báo bị gộp nhầm theo cửa thay vì theo phương thức

```js
const doorTag = `[door:${device.id}]`;          // TRƯỚC
const doorTag = `[door:${device.id}:${accessMethod}]`;  // SAU
```

Một cảnh báo **face** chưa xử lý nuốt sạch mọi cảnh báo **PIN** của cùng cửa đó → kẻ tấn công dò mã PIN trong im lặng cho tới khi ai đó đóng cảnh báo face bằng tay. Agent đã kiểm tra 45 cặp thẻ với id `{1,11,111,…}`: **0 va chạm** với định dạng mới.

---

## Phần 3 — Khoá PIN: bỏ bản ghi giả, neo theo id

### Trước

`setDoorPin` ghi một dòng `password`/`success` **giả** vào `door_access_logs` chỉ để reset bộ đếm khoá — và ghi **ngoài transaction**.

Hai vấn đề: dòng đó trong lịch sử bảo mật **không phân biệt được với một lần mở cửa thật** (đúng thứ kẻ trộm điện thoại muốn núp sau); và nếu transaction ghi PIN thất bại, dòng "đã mở cửa" ma vẫn còn lại.

### Sau — và tại sao neo theo `id` chứ không theo thời gian

Bản sửa đầu tiên của tôi neo theo `door_passwords.created_at`. Agent dựng MySQL 8 thật và chứng minh nó sai:

> Chèn `'2026-09-11 10:00:00.600'` vào cột `DATETIME(0)` lưu thành `10:00:01`.

MySQL **làm tròn**, không cắt. Nên một lần nhập sai lúc `10:00:00.600` và một lần đổi PIN lúc `10:00:01.400` **cùng lưu là `10:00:01`** → lần sai xảy ra *trước* khi đổi PIN vẫn bị tính vào hạn mức của PIN **mới**. Người dùng bị khoá sau 2 lần đoán thay vì 3.

→ Thêm cột `door_passwords.anchor_log_id` (migration `20260911040000_pin_lockout_anchor`), ghi trong transaction, và đếm theo `id > anchor_log_id`. **`id` đơn điệu tuyệt đối nên không còn đồng hồ nào trong phép so sánh** — đúng lý do mà đoạn code cũ đã chọn so `id` thay vì `created_at` cho mốc "lần thành công gần nhất".

Agent cũng đo `EXPLAIN` thật: thêm điều kiện `created_at` làm index `idx_door_access_logs_lockout` **mất tính covering** và chi phí tăng `590 → 1323` (truy vấn này chạy mỗi 5 giây trên trang bảo mật). Migration đồng thời thêm `created_at` vào index.

---

## Phần 4 — Xoá thiết bị = xoá mã PIN không cần biết mã

Agent tìm ra lỗ này **ngoài phạm vi được giao** — nó vô hiệu hoá toàn bộ Phần 3.

Mọi khoá ngoại trỏ tới `devices` đều `ON DELETE CASCADE`. Kẻ đang bị khoá, 3 request:

```
DELETE /api/devices/{doorId}      → 204, xoá sạch door_passwords VÀ toàn bộ door_access_logs
POST   /api/devices               → cửa mới
PUT    /api/door-access/{new}/pin → 200, KHÔNG hỏi currentPin (nhánh "PIN đầu tiên")
```

Cả yêu cầu `currentPin` lẫn khoá 5 phút đều biến mất, **cùng với nhật ký lẽ ra ghi lại việc đó**.

**Sửa (2 phần, phải đi cùng nhau):**
1. `deleteDevice` từ chối xoá cửa còn PIN (409).
2. Thêm `DELETE /api/door-access/:doorDeviceId/pin`, **đòi `currentPin`** như khi đổi.

Phần 2 là bắt buộc: trước đó **không có cách nào gỡ PIN**, nên nếu chỉ làm phần 1 thì cửa đã đặt PIN sẽ vĩnh viễn không xoá được. Phép kiểm chứng `currentPin` được tách thành `requireCurrentPin()` dùng chung cho cả `setDoorPin` và `clearDoorPin` — **mọi lối ra của một mã PIN đều tốn đúng một cái giá như nhau**, và hai nhánh không thể trôi lệch nhau về sau.

---

## Phần 5 — ai-service (3 lỗi)

### 5.1 — Lớp kiểm tra tự gây ra đúng lỗi 500 nó sinh ra để chặn

```python
math.isfinite(value)          # TRƯỚC
```

`json.loads` biến một literal số nguyên khổng lồ thành Python `int` **không giới hạn độ lớn**, còn `math.isfinite()` ép về C double *trước khi* kiểm tra. Nên `math.isfinite(10**400)` **không trả về False — nó ném `OverflowError`** → 500 → Node báo "Face ID unavailable" cho cả nhà. Đúng hệt sự cố mà dòng kiểm tra này được thêm vào để ngăn. Một phần tử embedding dài 400 chữ số là đủ.

```python
def _is_finite_number(value) -> bool:        # SAU
    if isinstance(value, bool) or not isinstance(value, (int, float)): return False
    if isinstance(value, int):
        try: coerced = float(value)
        except OverflowError: return False
        return math.isfinite(coerced)
    return math.isfinite(value)
```

Dùng `float()` thay vì một hằng số chặn trên vì số nguyên lớn nhất còn sống sót qua phép ép **không phải số tròn** (phụ thuộc làm tròn float64) — để trình thông dịch tự trả lời vừa chính xác vừa hiển nhiên đúng. **Đã kiểm chứng: 14/14 ca, và xác nhận biểu thức cũ thật sự ném `OverflowError`.**

### 5.2 — `MODEL_DIR` trỏ vào một file thường → container chết im lặng

`mkdir -p "$MODEL_DIR"` thất bại → `set -e` giết script, **exit 1, không một dòng log**, restart-loop. Cả file entrypoint được viết theo nguyên tắc "mất Face ID chứ không chết"; lỗi này vi phạm chính nguyên tắc đó. → bọc trong `if ! mkdir …; then echo cảnh báo; fi`.

### 5.3 — Rò stderr khi seed không đọc được

```sh
wc -c < "$1" 2>/dev/null      # TRƯỚC — KHÔNG che được
{ wc -c < "$1"; } 2>/dev/null # SAU
```

Shell **mở file trước khi chạy `wc`**, nên `sh: cannot open: Permission denied` là do *chính shell* in ra và `2>` của `wc` không với tới. Đã kiểm chứng cả hai dạng.

**Đã chạy 8 kịch bản entrypoint** (thư mục sạch / `MODEL_DIR` là file / seed không đọc được / seed cụt 15 byte / seed thiếu / đích hỏng / mount read-only / không set biến): **cả 8 exit 0, log trung thực, không rò stderr.**

### 5.4 — Lệnh hiệu chỉnh ngưỡng trong README không chạy được

`.dockerignore` loại `app/faces/*.jpg`, `live/`, `spoof/` (để ~20MB ảnh sinh trắc không bị nướng vào image), và `ai-service` **không bind-mount** source. Nên hai lệnh đo trong README §11 báo thư mục rỗng **chứ không báo lỗi rõ ràng**. → thêm bước 0 dùng `docker compose cp` (không phải `docker cp` — trên PowerShell nó hay báo `GetFileAttributesEx … cannot find the file specified`, đúng lỗi đã gặp) cùng một lệnh kiểm tra copy đã vào chưa, ở cả bản tiếng Việt và tiếng Anh.

---

## Đã kiểm chứng những gì

| Hạng mục | Kết quả |
|---|---|
| Nạp module backend (bắt tham chiếu tới symbol đã xoá — `node --check` **không** bắt được) | 71 file, **0 lỗi** |
| Cú pháp mọi file đã sửa (js / py / sh) | Sạch |
| `selectDevice` — bộ 70 ca gốc | **70/70** |
| `selectDevice` — seed thật, 33 ca hai chiều | **33/33** |
| `selectDevice` — 55 câu tự nhiên × 3 nhà seed thật | **0 từ chối oan** |
| `_is_finite_number` | **14/14**, và xác nhận lỗi cũ có thật |
| `docker-entrypoint.sh`, 8 kịch bản | **8/8 exit 0** |
| `EXPLAIN` trên MySQL 8.0.46 thật, 63.000 dòng log | Index còn dùng; đã thêm `created_at` để phục hồi covering |
| Va chạm chuỗi thẻ cảnh báo, 45 cặp | **0 va chạm** |

## Vẫn CHƯA chạy

`npm test`, `pytest`, `docker compose up`. `node_modules` trong repo được cài trên Windows nên jest / vite / Prisma engine **không chạy được** trong VM Linux. Mọi kiểm chứng ở trên đều đi vòng: tách hàm thuần ra chạy riêng, hoặc agent tự dựng MySQL/Flask trong container của nó.

**Việc cần làm khi về máy Windows:**

```bash
docker compose up -d --build              # ai-service KHÔNG bind-mount, bắt buộc --build
docker compose exec backend npx prisma migrate deploy   # migration mới: anchor_log_id + index
docker compose exec backend npm test
docker compose exec ai-service pytest -v
```

---

## Điều đáng rút ra nhất

Ba vòng, cùng một khuôn mẫu:

- **Vòng 1** sửa 25 lỗi. Vòng 2 tìm thấy **3 hồi quy do chính vòng 1 gây ra**.
- **Vòng 2** sửa 23 lỗi. Vòng 3 tìm thấy **4 hồi quy do chính vòng 2 gây ra** (2.1 DoS khoá, `selectDevice` lần 3 lọt hai đường, từ vựng nhiễm tên cảm biến).
- **Vòng 3**: bản sửa `selectDevice` đầu tiên của tôi trong chính vòng này **cũng lọt** — từ chối oan 14/55 câu bình thường, chỉ lộ ra khi agent chạy trên seed data thật.

`selectDevice` phải viết lại **5 lần**. Bốn lần đầu đều có test riêng, test đều xanh.

Điểm chung của mọi lần lọt: **test do chính người sửa viết chỉ kiểm tra đúng cái kịch bản mà người sửa đã nghĩ tới.** Thứ tìm ra lỗi không phải là thêm test — mà là chạy trên **dữ liệu thật của dự án** (`seed.js`, `bootstrap-board.js`) và trên **hạ tầng thật** (MySQL 8 thật mới lộ ra chuyện `DATETIME(0)` làm tròn).

Cụ thể hơn: lối tắt `devices.length === 1` ở lần 3 là một tối ưu **hợp lý về mặt logic** — một thiết bị thì không có gì để nhầm. Nó chỉ sai vì `seed.js` và `bootstrap-board.js` tạo **đúng một thiết bị mỗi loại mỗi nhà**, nên nó vô hiệu hoá bản sửa trên 100% dữ liệu thật của dự án trong khi mọi test dùng 2–3 thiết bị đều xanh.
