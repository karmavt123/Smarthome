# Voice Command — Text Intent qua ai-service — kế hoạch

**Trạng thái: chưa build, kế hoạch để thống nhất trước khi code.** Thay thế mục 1 (đã lỗi thời — giả định audio→Whisper) của `docs/AI-SERVICE-FUTURE-FEATURES-PLAN.md`. Pattern tích hợp ai-service tham khảo từ `docs/AI-SERVICE-FACE-ID-PLAN.md` / `docs/NODE-INTEGRATION-FOR-FACE-ID.md` (Face ID đã build xong theo pattern này).

## Hiện trạng

- `POST /api/voice-commands` (`voice-commands.routes.js`) đã chạy, nhận `{ recognizedText }` từ FE.
- `voice-command.service.js`: `normalizeText` bỏ dấu tiếng Việt → `parseVoiceIntent` regex match keyword (den/quat/cua, bat/tat/mo/dong...) → `scoreDeviceName` chọn thiết bị cụ thể trong nhà theo tên trùng khớp → `createDeviceCommand(userId, device.id, action, 'voice')`.
- Bảng `voice_commands` đã có `recognized_text`, `intent`, `confidence_score`, `execution_status` (`success`/`failed`/`unknown_command`).
- Vấn đề: regex chỉ khớp đúng từ khoá cứng, không hiểu biến thể câu nói tự nhiên.

## Quyết định đã chốt

1. FE dùng `react-speech-recognition` (Web Speech API, chạy trong trình duyệt) tự chuyển giọng nói → text. Backend **không** nhận audio — route `POST /api/voice-commands` giữ nguyên contract JSON `{ recognizedText }`.
2. ai-service chỉ làm NLU (intent classification), không làm STT.
3. ai-service trả intent chung (`deviceType` + `action` + `confidence`), không resolve thiết bị cụ thể — Node tiếp tục tự chọn thiết bị bằng `scoreDeviceName` như hiện tại (ai-service không biết tên thiết bị trong nhà).
4. Không có fallback rule-based khi ai-service lỗi/down. Lỗi hạ tầng ai-service → trả 503 thẳng cho client.
5. Phạm vi: giữ nguyên tập action hiện có (bật/tắt đơn giản: `turn_on`/`turn_off`/`open`/`close`), không mở rộng.

## Kiến trúc — ai giữ việc gì

```
FE (Web Speech API, react-speech-recognition)
  --text--> Node POST /api/voice-commands
  --text--> ai-service POST /voice/intent
  --intent (deviceType, action, confidence)--> Node resolve thiết bị (scoreDeviceName) + createDeviceCommand
```

## API contract đề xuất: `POST /voice/intent` (ai-service)

- Request: `{ text: string }`, header `X-API-Key`
- Response `200`: `{ deviceType: 'light'|'fan'|'door', action: 'turn_on'|'turn_off'|'open'|'close', confidence: number }`
- Response `422`: không nhận diện được intent đủ tự tin (ai-service tự quyết ngưỡng nội bộ) → `{ message, details }`
- Response khác (`400`/`401`/`500`/timeout/connection refused): lỗi hạ tầng/config phía Node hoặc ai-service down

## Việc bên Node cần đổi (khi build, chưa làm ở bước này)

- Thêm `src/services/voice-intent-client.service.js`, theo khuôn `face-id-client.service.js`: `baseUrl()` đọc `AI_SERVICE_URL`, header `X-API-Key: AI_SERVICE_API_KEY`, hàm `classifyIntent(text)` POST `${baseUrl()}/api/voice/intent` (JSON, không multipart), timeout ~3000ms, `rethrowAiServiceError` cùng kiểu: 422 pass-through, còn lại gộp `HttpError(503, ..., { voiceIntentUnavailable: true })`.
- Sửa `voice-command.service.js`'s `executeVoiceCommand`: thay bước gọi `parseVoiceIntent(text)` bằng `await voiceIntentClient.classifyIntent(text)`. Giữ nguyên `normalizeText`/`scoreDeviceName` để chọn thiết bị cụ thể. Bắt riêng lỗi 422 → ghi `voice_commands.execution_status = 'unknown_command'` (như hành vi hiện tại khi intent null). Lỗi 503 propagate thẳng lên controller, không catch/fallback.
- Gỡ `parseVoiceIntent` (thành dead code sau khi thay) — cần cập nhật/xoá phần liên quan trong `tests/voice-parser.test.js`, thêm test mới mock `voice-intent-client.service` (theo cách `door-access-verify-face.test.js` mock `face-id-client.service`) cho case: match tốt, `422` unknown, `503` service down.
- `confidence_score` lưu vào `voice_commands` lấy từ response ai-service thay vì hardcode `0.5`/`0.9` như hiện tại.
- Env: tái dùng `AI_SERVICE_URL`/`AI_SERVICE_API_KEY` có sẵn trong `.env.example` — không cần biến mới (không cần ngưỡng confidence riêng phía Node vì ai-service tự quyết định trả `422`).
- DB: không cần migration mới — `voice_commands` đã đủ cột.

## Câu hỏi còn mở (biết trước, không chặn code bước đầu)

- ai-service dùng model/rule gì để classify intent tiếng Việt — việc của người viết ai-service (Python repo riêng), cần thống nhất riêng.
- Timeout hợp lý cho `/voice/intent` — đề xuất 3000ms (text ngắn, nên nhanh hơn nhiều so với face verify 8000ms).
