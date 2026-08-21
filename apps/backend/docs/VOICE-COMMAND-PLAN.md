# Voice Command — Text Intent qua ai-service

**Trạng thái: đã build.** ai-service chạy voice intent classification thật (`POST /api/voice/intent`, port dev `5050`, xem `.env.example`'s `AI_SERVICE_URL`). Pattern tích hợp theo `docs/AI-SERVICE-FACE-ID-PLAN.md` / `docs/NODE-INTEGRATION-FOR-FACE-ID.md`.

## Hiện trạng

- `POST /api/voice-commands` (`voice-commands.routes.js`) nhận `{ text, homeId }` từ FE (JWT bearer, `requireAuth`).
- `voice-command.service.js`'s `executeVoiceCommand(userId, recognizedText, homeId)`:
  1. `requireHome(userId, homeId)` — 404 nếu home không tồn tại/không thuộc user gọi lên.
  2. `voiceIntentClient.classifyIntent(text)` gọi ai-service — 422 (không nhận diện được) → ghi `voice_commands.execution_status: 'unknown_command'`, không throw ra client (response 200). Lỗi khác (500/timeout/connection refused) → `HttpError(503, ..., { voiceIntentUnavailable: true })`, propagate thẳng, **không fallback**.
  3. `normalizeText` bỏ dấu tiếng Việt + `scoreDeviceName` chọn thiết bị cụ thể **trong đúng home đó** (`home_id: home.id`, không quét toàn bộ nhà của user) theo tên trùng khớp trong câu nói.
  4. Không tìm được thiết bị khớp → cũng ghi `unknown_command`.
  5. `device.device_type === 'door'` → **không** gọi `createDeviceCommand`. Ghi `voice_commands.execution_status: 'requires_verification'`, trả `{ action: null, requiresVerification: true, device }`. Mở cửa bằng giọng nói không đủ tin cậy (dễ bị người ngoài hô lệnh qua cửa/loa) — FE phải mở modal xác thực Face ID/PIN, gọi `POST /api/door-access/verify-face` hoặc `verify-pin` với `doorDeviceId: device.id` như flow mở cửa thường.
  6. Còn lại (light/fan) → `createDeviceCommand(userId, device.id, intent.action, 'voice')`, y hệt pipeline lệnh app/PIN/face — ghi `device_commands` row `status: 'pending'`, thật sự thực thi (không chỉ trả response).
- Bảng `voice_commands` có `recognized_text`, `intent`, `confidence_score`, `execution_status` (`success`/`failed`/`unknown_command`/`requires_verification`) — không có cột `home_id` riêng (không cần, vì `device_id` đã ngầm định home qua quan hệ device→home).

## Quyết định đã chốt

1. FE dùng `react-speech-recognition` (Web Speech API, chạy trong trình duyệt) tự chuyển giọng nói → text. Backend **không** nhận audio — route `POST /api/voice-commands` nhận JSON `{ text, homeId }`.
2. ai-service chỉ làm NLU (intent classification), không làm STT.
3. ai-service trả intent chung (`deviceType` + `action` + `confidence`), không resolve thiết bị cụ thể — Node tự chọn thiết bị bằng `scoreDeviceName`, scoped theo `homeId` truyền lên (ai-service không biết tên thiết bị/home nào).
4. Không có fallback rule-based khi ai-service lỗi/down. Lỗi hạ tầng ai-service → trả 503 thẳng cho client.
5. Phạm vi: giữ nguyên tập action hiện có (bật/tắt đơn giản: `turn_on`/`turn_off`/`open`/`close`), không mở rộng.
6. `homeId` **bắt buộc** trong request body — user có thể sở hữu nhiều home, không có cách nào suy ra "đang ở nhà nào" từ JWT/text, nên FE phải gửi lên tường minh (giống pattern `face-profiles`/`rooms` — luôn cần `homeId`). Thiếu `homeId` → `400`; `homeId` không thuộc user → `404` (qua `requireHome`, `src/services/ownership.service.js`).
7. Door (`open`/`close`) **không thực thi qua voice** — chỉ nhận diện intent + trả `requiresVerification: true` cho FE mở modal Face ID/PIN. Light/fan (`turn_on`/`turn_off`) thực thi ngay như bình thường.

## Kiến trúc — ai giữ việc gì

```
FE (Web Speech API, react-speech-recognition)
  --text--> Node POST /api/voice-commands
  --text--> ai-service POST /voice/intent
  --intent (deviceType, action, confidence)--> Node resolve thiết bị (scoreDeviceName) + createDeviceCommand
```

## API contract: `POST /api/voice-commands` (Node, FE gọi cái này)

Request:
```json
{ "text": "bật đèn phòng khách", "homeId": 1 }
```

- `202` — nhận diện + queue lệnh thành công (light/fan): `{ voiceCommand, action, device }` (`action` là `device_commands` row vừa tạo, `status: 'pending'`).
- `200` — 1 trong 2 trường hợp, phân biệt bằng `voiceCommand.executionStatus`:
  - `unknown_command` — không nhận ra lệnh (ai-service 422, hoặc intent nhận ra nhưng home đó không có thiết bị khớp): `{ voiceCommand, action: null }`.
  - `requires_verification` — nhận ra lệnh mở/đóng cửa, nhưng chưa thực thi: `{ voiceCommand, action: null, requiresVerification: true, device }`. FE đọc `requiresVerification` để mở modal Face ID/PIN, gọi `doorDeviceId: device.id` sang `POST /api/door-access/verify-face`/`verify-pin`.
- `400` — thiếu `text`/`homeId`, hoặc `text` rỗng.
- `404` — `homeId` không tồn tại/không thuộc user.
- `503` — ai-service voice-intent không khả dụng (`details.voiceIntentUnavailable: true`), không fallback.

## API contract: `POST /api/voice/intent` (ai-service, Node gọi cái này)

- Request: `{ text: string }`, header `X-API-Key`
- Response `200`: `{ deviceType: 'light'|'fan'|'door', action: 'turn_on'|'turn_off'|'open'|'close', confidence: number }`
- Response `422`: không nhận diện được intent đủ tự tin → `{ message, details }`
- Response khác (`400`/`401`/`500`/timeout/connection refused): lỗi hạ tầng/config, Node gộp thành `503`

## Việc bên Node đã làm

- `src/services/voice-intent-client.service.js` — theo khuôn `face-id-client.service.js`: `baseUrl()` đọc `AI_SERVICE_URL`, header `X-API-Key: AI_SERVICE_API_KEY`, `classifyIntent(text)` POST `${baseUrl()}/api/voice/intent`, timeout 3000ms, lỗi 422 pass-through còn lại gộp `HttpError(503, ..., { voiceIntentUnavailable: true })`.
- `voice-command.service.js`'s `executeVoiceCommand(userId, recognizedText, homeId)` — `requireHome` scoping + gọi `classifyIntent` thay cho regex cũ (`parseVoiceIntent` đã gỡ).
- Env: dùng chung `AI_SERVICE_URL`/`AI_SERVICE_API_KEY` với Face ID.
- Test: `tests/voice-commands.test.js` (mock `voice-intent-client.service`, cover: match thành công, `422` unknown, không có thiết bị khớp, `503`, thiếu `homeId`/`text`, `homeId` không thuộc user, và không match nhầm thiết bị ở home khác của cùng user).

## Đã biết, chưa cần làm gì thêm

- Case-sensitivity của ai-service intent classifier (vd `"Tắt đèn"` viết hoa từng bị hiểu nhầm thành `turn_on`) — đã fix bên ai-service, Node không cần xử lý phòng thủ thêm.
- `voice_commands` không lưu `home_id` — nếu sau này cần audit theo home cho cả case `unknown_command` (hiện `device_id` null), cần thêm cột + migration.
