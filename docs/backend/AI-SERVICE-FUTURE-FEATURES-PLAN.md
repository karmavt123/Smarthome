# AI Service — các tính năng AI khác — kế hoạch tương lai

**Trạng thái: chưa build, chỉ là kế hoạch để tham khảo.** Không có code nào trong repo hiện tại phụ thuộc vào tài liệu này. Xem `docs/AI-SERVICE-FACE-ID-PLAN.md` cho kế hoạch dời Face ID sang cùng service AI (`ai-service`, repo Python riêng) — tài liệu này là các tính năng khác có thể thêm vào **cùng service đó** sau khi Face ID xong.

Xếp theo mức độ ăn khớp với schema/tính năng đã có trong repo Node (ăn khớp cao = ít việc phải đổi bên Node, tận dụng bảng/route đã tồn tại).

## 1. Speech-to-text + intent classification cho voice command (ưu tiên cao)

**Vì sao**: bảng `voice_commands` (`prisma/schema.prisma`) đã có sẵn `recognized_text`, `intent`, `confidence_score`, `execution_status` — nhưng phần parse hiện tại (xem `tests/voice-parser.test.js`) là rule-based/keyword match đơn giản, không hiểu ngữ cảnh tiếng Việt tự nhiên.

**Đề xuất**:
- `POST /voice/transcribe` — nhận audio (FE ghi âm gửi lên) → Whisper (open-source, chạy local, tốt tiếng Việt) → trả text.
- `POST /voice/intent` — nhận text đã transcribe → classify intent + entity (device nào, action gì) → trả structured `{ intent, deviceHint, action, confidence }` thay vì Node tự match keyword cứng.

**Việc bên Node cần đổi**: `src/services/voice-command.service.js` (nếu có, hoặc tương đương) gọi sang thay vì tự parse. Route `POST /api/voice-commands` giữ nguyên contract với FE, chỉ đổi bên trong.

**Rủi ro**: Whisper cần tải audio lên (không chỉ text như hiện tại) — đổi contract multipart giữa FE↔Node, không chỉ Node↔Python.

## 2. Anomaly detection cho sensor readings (ưu tiên cao)

**Vì sao**: `alert_rules` hiện chỉ so ngưỡng tĩnh (`condition_operator`: `gt/lt/gte/lte/eq` so với `threshold_value` cố định — xem `alert-evaluation.service.js`'s `compareValue`). Nhiệt độ 35°C lúc trưa là bình thường, lúc 2h sáng là bất thường, nhưng ngưỡng cứng không phân biệt được theo thời gian/pattern.

**Đề xuất**:
- `POST /anomaly/check` — nhận `{ sensorType, value, recentReadings: [...] }` (Node gửi kèm lịch sử gần đây từ `sensor_readings`) → model thống kê đơn giản (vd Isolation Forest, hoặc rolling mean/std theo khung giờ) → trả `{ isAnomaly: bool, score }`.

**Việc bên Node cần đổi**: `alert-evaluation.service.js`'s `evaluateReading` — thêm nhánh gọi anomaly-check song song với check ngưỡng tĩnh hiện có (không thay thế `alert_rules`, chỉ bổ sung 1 loại alert mới, vd `alert_type: 'anomaly'` — cần thêm giá trị enum mới trong `prisma/schema.prisma` + migration).

**Rủi ro**: cần đủ dữ liệu lịch sử để model học pattern "bình thường" — nhà mới setup (ít dữ liệu) sẽ không chính xác lúc đầu.

## 3. Object detection ở cửa (mở rộng camera cửa đang có)

**Vì sao**: camera cửa hiện chỉ dùng cho face-id (nhận diện người đã enroll). Chưa có gì xử lý trường hợp "có người lạ đứng trước cửa" (chưa enroll) hoặc "có gói hàng để trước cửa".

**Đề xuất**:
- `POST /vision/detect-objects` — nhận ảnh từ camera cửa → YOLO (pretrained, nhẹ, nhiều bản có sẵn) → trả danh sách object phát hiện được (`person`, `package`, ...) kèm bounding box.

**Việc bên Node cần đổi**: cần route/table mới hoàn toàn (chưa có gì tương tự hiện tại) — vd `device_events` hoặc tái dùng `door_access_logs` với `access_method` mới (`'unknown_person'`?). Cần thiết kế thêm, không tận dụng được schema có sẵn như #1/#2.

**Rủi ro**: cần trigger camera chụp liên tục hoặc theo cảm biến chuyển động (chưa rõ camera cửa hiện tại chụp theo cơ chế nào ngoài lúc user chủ động verify-face) — cần làm rõ luồng trigger trước khi build.

## 4. Tóm tắt alert bằng LLM

**Vì sao**: `notifications` đã có `channel` hỗ trợ `telegram`/`email` (enum có sẵn trong schema) ngoài `in_app`. Nếu 1 ngày có nhiều `alerts` (nhiều cảnh báo môi trường + unauthorized_access), gửi từng cái riêng lẻ dễ gây spam/bỏ sót.

**Đề xuất**:
- `POST /summarize/alerts` — nhận danh sách `alerts` trong khoảng thời gian (Node query từ `alerts` table gửi qua) → LLM tóm tắt thành 1 đoạn tiếng Việt tự nhiên → Node gửi qua Telegram/email 1 lần/ngày (cron).

**Việc bên Node cần đổi**: cần build cơ chế gửi `telegram`/`email` thật trước (hiện `notifications.channel` có giá trị này trong enum nhưng chưa chắc có code gửi thật — cần kiểm tra `notifications` service trước khi làm tính năng này, có thể đây là việc phải làm trước, không phải AI feature).

**Rủi ro**: phụ thuộc LLM API bên ngoài (OpenAI/Anthropic/local LLM) — thêm chi phí vận hành, khác hẳn các mục trên (đều chạy model local, không cần gọi ra ngoài).

## 5. Chatbot hỏi trạng thái nhà

**Vì sao**: hiện muốn biết "phòng khách bao nhiêu độ" phải tự mở dashboard tra — chatbot có thể trả lời trực tiếp bằng ngôn ngữ tự nhiên.

**Đề xuất**:
- `POST /chat` — nhận câu hỏi tiếng Việt → LLM với function-calling, gọi ngược lại API Node (`GET /api/telemetry/...`, `GET /api/devices/...`) để lấy dữ liệu thật → trả lời tự nhiên.

**Việc bên Node cần đổi**: cần expose 1 "service token" hoặc cơ chế auth riêng để `ai-service` gọi ngược vào API Node thay mặt user (khác hướng với các mục trên — mục 1-4 đều là Node gọi Python, mục này là Python gọi ngược lại Node).

**Rủi ro**: phức tạp nhất trong 5 mục — vừa phụ thuộc LLM ngoài (như #4), vừa cần thiết kế lại chiều gọi API (Python→Node), vừa cần xử lý auth 2 chiều. Để cuối cùng, sau khi các mục khác đã chạy ổn.

## Ưu tiên đề xuất

**#1 (voice) và #2 (anomaly)** trước — tận dụng đúng bảng/tính năng đã tồn tại (`voice_commands`, `alert_rules`/`sensor_readings`), không cần thiết kế schema mới, chỉ nâng chất lượng phần đang chạy. #3 cần thiết kế thêm nhưng vẫn nằm trong domain đã quen (camera cửa). #4-5 phụ thuộc LLM ngoài + cần hạ tầng chưa chắc có sẵn (gửi Telegram/email thật, auth 2 chiều) — để sau cùng.
