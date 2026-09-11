# Rà soát vòng 4 — 11/09/2026

Vòng này khác hẳn ba vòng trước ở một điểm duy nhất, nhưng là điểm quyết định: **bộ test được chạy thật.**

Ba vòng đầu sửa hơn 70 lỗi mà không chạy một dòng test nào — `node_modules` trong repo cài trên Windows nên jest/vitest/Prisma engine không khởi động được trong môi trường Linux. Mọi kiểm chứng đều đi vòng: tách hàm thuần ra chạy riêng, dựng MySQL tạm, đọc code bằng mắt.

Vòng 4 chạy trong Docker, và kết quả lần đầu là **4 test đỏ** — trong đó **1 lỗi do chính bản sửa vòng 3 gây ra**, còn **2 lỗi đã nằm sẵn trong repo từ lâu mà không ai biết, vì test chưa từng được chạy**.

Kết quả cuối: **199/199 backend, 21/21 ai-service, 10/10 frontend.**

---

## Phần 1 — Hồi quy do vòng 3 gây ra: `selectDevice` lần 5

### Triệu chứng

```
● POST /api/voice-commands › queues a device command on a confident intent + device match
  Expected: 202
  Received: 200
```

Ba test cùng lỗi này. Trả 200 thay vì 202 nghĩa là `result.action` rỗng — tức `selectDevice` đã **từ chối** câu lệnh.

### Nguyên nhân

Test tạo thiết bị tên **`'Living Room Light'`** rồi gửi câu lệnh **`'bat den phong khach'`**.

Bản sửa vòng 3 dựng một danh sách `PLACE_WORDS` đóng, chứa cả từ tiếng Việt lẫn tiếng Anh — nhưng coi chúng là các token **rời rạc, không liên quan gì nhau**:

```js
// khach và living nằm cùng một Set, nhưng không có gì nối chúng lại
const PLACE_WORDS = new Set(['khach', ..., 'living', ...]);
```

Nên khi người dùng nói "phòng khách" mà thiết bị tên "Living Room Light":

| Bước | Giá trị |
|---|---|
| qualifiers | `[khach]` |
| tên thiết bị (bỏ từ chung) | `[living]` |
| `khach ∈ {living}` ? | **không** → TỪ CHỐI |

Lớp bảo vệ đọc thành *"người dùng gọi tên một nơi chốn nhà này không có"* — trong khi **phòng khách và living room là cùng một chỗ**.

### Vì sao ba vòng rà soát không bắt được

Seed và `bootstrap-board.js` của dự án đặt tên thiết bị **toàn tiếng Việt**. Mọi bộ đo t tự dựng cũng dùng tên tiếng Việt. Nên trên dữ liệu thật lỗi này không bao giờ lộ.

Nó chỉ lộ ở `tests/`, nơi thiết bị đặt tên tiếng Anh còn câu lệnh vẫn tiếng Việt — đúng tình huống một người Việt dùng app có sẵn thiết bị tên tiếng Anh. Đây là kịch bản thật, không phải test giả định.

### Cách sửa

Thêm bảng quy từ về **khái niệm phòng**, rồi so khớp ở mức khái niệm thay vì mặt chữ:

```js
const ROOM_CONCEPTS = {
  khach: 'living', living: 'living',
  ngu: 'bed', bed: 'bed', bedroom: 'bed',
  bep: 'kitchen', kitchen: 'kitchen',
  tam: 'bath', bath: 'bath', bathroom: 'bath', wc: 'bath', toilet: 'bath',
  an: 'dining', dining: 'dining',
  // ...
};
function conceptOf(word) { return ROOM_CONCEPTS[word] || word; }
```

Áp dụng ở **hai chỗ**:

```js
// TRƯỚC — tính điểm theo mặt chữ
const spoken = wordsOf(commandText);
return nameWords(deviceName).filter((w) => !GENERIC_WORDS.has(w) && spoken.has(w)).length;

// SAU — theo khái niệm
const spoken = new Set([...wordsOf(commandText)].map(conceptOf));
return nameWords(deviceName).filter((w) => !GENERIC_WORDS.has(w) && spoken.has(conceptOf(w))).length;
```

```js
// TRƯỚC
const winnerWords = new Set(nameWords(ranked[0].candidate.name));
if (qualifiers.some((w) => !winnerWords.has(w))) return null;

// SAU
const winnerWords = new Set(nameWords(ranked[0].candidate.name).map(conceptOf));
if (qualifiers.some((w) => !winnerWords.has(conceptOf(w)))) return null;
```

### Kiểm chứng trước khi ghi

Chạy lại toàn bộ bộ hồi quy của bốn vòng trước — **không ca từ chối nào bị hỏng**:

| Ca | Kết quả |
|---|---|
| 3 ca jest đang đỏ | resolve đúng thiết bị |
| seed thật: `bật đèn phòng ngủ`, `bật đèn nhà bếp`, `bật đèn phòng tắm`, `bật đèn số 2` | vẫn **từ chối** đúng |
| seed thật: `tắt hết đèn trong nhà`, `bật đèn cho sáng`, `bật đèn phòng khách nhá anh`, `tắt đèn rồi đi ngủ`, `bật công tắc đèn` | vẫn resolve đúng |
| `bat den phong bep` (2 đèn) → `Den bep` | đúng |
| `mo cua so` → từ chối, `bat den so 2` → `Den 2` | đúng |
| hợp đồng `scoreDeviceName` | giữ nguyên |

Điểm cần giữ: nếu trong nhà có **cả** "Đèn phòng khách" **và** "Living Room Light" thì hai thiết bị hoà điểm → **từ chối**, đúng, vì lúc đó câu lệnh thật sự mơ hồ.

---

## Phần 2 — Hai lỗi có sẵn, lộ ra vì lần đầu chạy test

### 2.1 `homes.test.js` — test sai, không phải code sai

```
● homes routes › deletes a home
  Expected: 204
  Received: 200
```

Đối chiếu ba nguồn:

| Nguồn | Nói gì |
|---|---|
| `homes.controller.js` | `res.json(serialize(home))` → 200 kèm body |
| `homes.routes.js` (openapi) | `200: Home deleted, returns the deleted home` |
| `homes.test.js` | `expect(res.status).toBe(204)` |

Code và tài liệu khớp nhau, **test lệch**. Sửa test chứ không sửa contract đã công bố:

```js
expect(res.status).toBe(200);
expect(res.body.id).toBe(homeId);
```

### 2.2 `simulator.integration.test.js` — teardown dính khoá ngoại, và nó làm **mù** cả bộ test

```
● Test suite failed to run
  PrismaClientKnownRequestError: Foreign key constraint violated on the fields: (`user_id`)
  → await prisma.users.delete({ where: { id: userId } });
```

`afterAll` xoá thẳng user. Nhưng:

```sql
ADD CONSTRAINT `fk_device_commands_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

Mà bộ test này **có gửi lệnh điều khiển**, nên luôn tồn tại `device_commands` trỏ vào user đó.

**Sửa:**

```js
// TRƯỚC
await prisma.users.delete({ where: { id: userId } });

// SAU — xoá nhà trước, cascade devices -> device_commands, dọn đường cho user
await prisma.homes.deleteMany({ where: { user_id: userId } });
await prisma.users.delete({ where: { id: userId } });
```

**Đây mới là phần đáng ghi nhớ.** Lỗi teardown trông như chuyện dọn dẹp vặt, nhưng nó gây hai hậu quả nặng:

1. Jest báo cả suite **"failed to run"**, che mất kết quả thật của 11 test bên trong.
2. Mỗi lần chạy để lại nguyên một user + nhà + 4 thiết bị `sim-` trong DB. Sau hai lần chạy hỏng, `generateSimulatedReadings()` — hàm quét **toàn bộ** thiết bị `device_code LIKE 'sim-%'` trong cả database — phải xử lý 8 thiết bị mồ côi, và test `runtime generates bounded readings` bắt đầu đỏ với `Expected 6, Received 9`.

Dọn tài khoản test mồ côi xong thì test xanh trở lại.

> **Chỗ chưa giải thích được.** Dọn rác → hết đỏ, nhưng cơ chế thì chưa chứng minh. Bộ đếm trong test lọc theo `device_id` riêng của nó, mà kiểm tra DB cho thấy **không có `device_code` trùng** và **không thiết bị nào thừa sensor**. Vì sao dữ liệu của user khác lại làm đúng thiết bị đó nhận 6 dòng đọc thay vì 3 — chưa rõ.
>
> Bản sửa teardown chặn được nguồn sinh rác nên hiện tượng không tự lặp lại. Nhưng **nếu nó hiện lại thì đừng dọn rác rồi cho qua** — lúc đó là lỗi thật trong `storeReadings`, phải đào tới nơi.

---

## Phần 3 — Hai bug im lặng, tìm ra nhờ đối chiếu code với báo cáo

Cả hai đều **không làm test đỏ** và **không báo lỗi gì**. Chúng chỉ lộ ra khi ngồi so từng con số trong báo cáo LaTeX với code thật.

### 3.1 `FACE_MATCH_THRESHOLD` mặc định sai — Face ID sẽ từ chối gần như mọi người

```js
// TRƯỚC
const DEFAULT_MATCH_THRESHOLD = 0.6;
// SAU
const DEFAULT_MATCH_THRESHOLD = 1.24;
```

`0.6` là mặc định cũ của **face-api.js**, còn sót lại từ trước khi chuyển sang InsightFace/ArcFace. Khoảng cách đo thực nghiệm trên bộ ảnh thật:

$$\text{cùng người}: 0.411 \text{–} 1.195 \qquad \text{khác người}: 1.281 \text{–} 1.462$$

Với ngưỡng $0.6$, **phần lớn lần xác thực ĐÚNG đều bị từ chối**.

Nguy hiểm ở chỗ: lỗi chỉ xảy ra khi biến `FACE_MATCH_THRESHOLD` không được set — tức là trên máy sạch, máy của người chấm, hoặc bất kỳ ai clone repo về mà chưa sửa `.env`. Trên máy đã cấu hình thì không bao giờ thấy.

Con số `0.6` sai trong báo cáo LaTeX chính là chép từ hằng số này — sửa báo cáo mới lòi ra code cũng sai.

### 3.2 Biểu đồ thống kê nuốt mất toàn bộ lần mở cửa bằng PIN

```js
// TRƯỚC — thiếu 'password'
const CONTROL_METHODS = ['app', 'voice', 'face', 'automatic', 'manual'];
// SAU
const CONTROL_METHODS = ['app', 'voice', 'face', 'password', 'automatic', 'manual'];
```

`StatisticsPage.js` chỉ cộng dồn khi method nằm trong danh sách:

```js
if (CONTROL_METHODS.includes(controlMethod)) byDay[key][controlMethod] += 1;
```

Nên mọi `device_actions` có `control_method: 'password'` bị **âm thầm loại khỏi biểu đồ** — không sai số, không cảnh báo, chỉ đơn giản là biến mất. Một trong hai phương thức bảo mật cửa của đề tài không bao giờ xuất hiện trong thống kê.

Thêm cả nhãn trong `DeviceActivityCard.js`:

```js
{ key: 'password', name: 'Mã PIN', color: '#f2b8b5' },
```

### 3.3 `DEVICE_OFFLINE_AFTER_SECONDS` — code và config nói hai số khác nhau

| Nơi | Giá trị |
|---|---|
| `telemetry.service.js` (mặc định) | 15 |
| `.env.example` + docker-compose | 60 |

Chạy backend mà thiếu biến môi trường thì thiết bị bị đánh offline **nhanh gấp 4 lần** dự kiến, gây nhảy online/offline liên tục. Sửa mặc định trong code về 60 cho ba nơi khớp nhau.

---

## Phần 4 — Frontend: bỏ test rác, chuyển độ phủ sang chỗ có giá trị

`App.test.js` là test scaffold mặc định của Create React App:

```js
test('renders learn react link', () => { ... });
```

Sai ở **hai tầng**:

1. Chữ "learn react" **chưa bao giờ tồn tại** trong dự án này. Test chưa từng kiểm tra điều gì thật.
2. Nó nổ vì lý do cấu trúc: `App.js` dùng `<Routes>` còn `<BrowserRouter>` nằm ở `index.js`, nên render `<App />` trần ném `useRoutes() may be used only in the context of a <Router>`.

Bọc `<MemoryRouter>` thì hết nổ nhưng vẫn đỏ ở "learn react". Sửa tiếp thì phải assert vào chỗ route `/` điều hướng tới — mà chỗ đó phụ thuộc trạng thái đăng nhập trong jotai và một loạt lời gọi API. Thành ra **mock rất nhiều để kiểm tra rất ít**, và dễ flaky.

**Quyết định:** xoá, chuyển độ phủ sang `src/utils/deviceStatus.test.js` — 10 test, logic thuần, không thể flaky.

Chọn `deviceStatus.js` vì nó không có DOM, không có mạng, nhưng Dashboard, thẻ thiết bị, thẻ khoá cửa và màn hình An ninh **đều** dựa vào. Điểm dễ vỡ nhất là sự **bất đối xứng giữa cửa và thiết bị khác**:

```js
device.deviceType === 'door' ? device.status === 'open' : device.status === 'on'
```

Có hai test chốt riêng chuyện không được lẫn từ vựng giữa hai loại — một cánh cửa có `status: 'on'` **không phải** là cửa đang mở. Điều này quan trọng vì chính trạng thái cửa là thứ frontend dùng để quyết định có bắt xác thực PIN/Face khi mở cửa bằng giọng nói hay không (`VoiceSearchModal.js`), đúng cái lỗ đã vá ở backend vòng 3.

---

## Kết quả

| Bộ test | Kết quả |
|---|---|
| backend `jest --runInBand` | **199/199**, 12/12 suite |
| ai-service `pytest -v` | **21/21** |
| frontend `vitest` | **10/10** |
| Báo cáo LaTeX | compile sạch, 59 trang |

---

## Bài học của cả bốn vòng

Ba vòng đầu, mỗi vòng đều: sửa nhiều, tự viết test cho chính bản sửa của mình, test xanh, tự tin. Vòng sau vẫn tìm ra lỗ ở đúng chỗ vừa sửa.

`selectDevice` phải viết lại **năm lần**. Bốn lần đầu đều có test riêng và đều xanh.

Vòng 4 cho thấy thứ thực sự tìm ra lỗi, xếp theo hiệu quả:

1. **Chạy bộ test thật của dự án.** Tìm ra 1 hồi quy + 2 lỗi nằm sẵn trong repo.
2. **Chạy trên dữ liệu thật** (`seed.js`, `bootstrap-board.js`). Vòng 3 tìm ra lối tắt `devices.length === 1` vô hiệu hoá toàn bộ bản sửa trên 100% dữ liệu thật.
3. **Chạy trên hạ tầng thật.** MySQL thật mới lộ ra `DATETIME(0)` làm tròn chứ không cắt.
4. **Đối chiếu tài liệu với code từng dòng.** Tìm ra 3 bug im lặng mà không bộ test nào bắt được.

Viết thêm test **không** nằm trong danh sách đó. Test do chính người sửa viết chỉ kiểm tra đúng kịch bản người sửa đã nghĩ tới — đó là lý do bốn lần `selectDevice` đều xanh mà vẫn sai.

Một ghi chú cuối về mức độ tin cậy: lỗi `Expected 6, Received 9` ở mục 2.2 **chưa được giải thích**, chỉ mới hết triệu chứng. Ghi ra đây thay vì lặng lẽ cho qua, vì kiểu "sửa xong thấy hết lỗi rồi kết luận đã hiểu" chính là cái đã lặp lại suốt ba vòng đầu.
