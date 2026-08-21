# Cấu trúc Database

Tài liệu này mô tả schema DB (MySQL, quản lý qua Prisma) để frontend biết dữ liệu trả về từ API có hình dạng gì. Nguồn chuẩn: `prisma/schema.prisma`.

Quy ước chung:
- Mọi bảng có `id` (auto-increment, unsigned)
- `created_at` / `updated_at` là `DateTime` (`updated_at` do Prisma tự set khi update, không phải trigger MySQL)
- Field kiểu `Int?` / quan hệ có dấu `?` nghĩa là optional (nullable)
- Các quan hệ `onDelete: Cascade` nghĩa là xoá bản ghi cha sẽ xoá luôn bản ghi con liên quan

## Sơ đồ quan hệ (tổng quan)

```
users ──< homes ──< rooms ──< devices ──< sensors ──< sensor_readings
  │         │                  │
  │         ├──< alert_rules ──┘ (qua sensor_id)
  │         ├──< alerts ──< notifications
  │         └──< face_profiles
  │
  ├──< refresh_tokens
  ├──< device_actions >── devices
  ├──< door_access_logs >── devices / face_profiles
  ├──< door_passwords >── devices
  ├──< voice_commands >── devices
  └──< notifications
```

## Bảng chính

### users
Người dùng hệ thống (chủ nhà / thành viên).

| Field | Kiểu | Ghi chú |
|---|---|---|
| id | Int | PK |
| full_name | String | |
| email | String | unique, dùng để login |
| password_hash | String | không trả về FE |
| phone | String? | |
| avatar_url | String? | |
| role | enum `admin \| user` | default `user` |
| status | enum `active \| inactive` | default `active` |

### homes
Một "nhà" — đơn vị gốc chứa phòng, thiết bị, cảnh báo. Mỗi nhà thuộc về đúng 1 user (1-nhiều, không phải nhiều-nhiều).

| Field | Kiểu | Ghi chú |
|---|---|---|
| id | Int | PK |
| user_id | Int | FK → users, cascade delete — chủ nhà |
| name | String | |
| address | String? | |

### rooms
Phòng thuộc 1 nhà.

| Field | Kiểu | Ghi chú |
|---|---|---|
| home_id | Int | FK → homes, cascade delete |
| name | String | unique trong cùng `home_id` |

### devices
Thiết bị IoT (đèn, quạt, cửa, cảm biến...) gắn Yolobit qua Ohstem Cloud.

| Field | Kiểu | Ghi chú |
|---|---|---|
| home_id | Int | FK → homes, cascade delete |
| room_id | Int? | FK → rooms (optional, thiết bị có thể chưa gán phòng) |
| name | String | |
| device_code | String | unique — mã định danh thiết bị (map với Ohstem/Yolobit) |
| device_type | enum `light \| fan \| door \| sensor` | |
| status | String | trạng thái vận hành, free-text, default `"off"` |
| connection_status | enum `online \| offline` | default `offline` |

### sensors
Cảm biến gắn trên 1 device (thường `device_type = sensor`).

| Field | Kiểu | Ghi chú |
|---|---|---|
| device_id | Int | FK → devices, cascade delete |
| sensor_type | enum `temperature \| humidity \| light` | unique theo `(device_id, sensor_type)` |
| unit | String | vd `"°C"`, `"%"` |
| min_value / max_value | Decimal? | ngưỡng hợp lệ |

### sensor_readings
Lịch sử giá trị đo được — bảng time-series, sẽ lớn dần theo thời gian.

| Field | Kiểu | Ghi chú |
|---|---|---|
| sensor_id | Int | FK → sensors, cascade delete |
| value | Decimal(10,2) | |
| created_at | DateTime | thời điểm đo |

### alert_rules
Quy tắc cảnh báo do người dùng đặt (vd "nhiệt độ > 35 thì cảnh báo").

| Field | Kiểu | Ghi chú |
|---|---|---|
| home_id | Int | FK → homes, cascade delete |
| sensor_id | Int? | FK → sensors (optional) |
| name | String | |
| condition_operator | enum `gt` `lt` `gte` `lte` `eq` | API request/response luôn dùng tên field Prisma (`gt`/`lt`/`gte`/`lte`/`eq`) — chỉ cột MySQL bên dưới lưu ký hiệu (`>`, `<`...) qua `@map`, không bao giờ lộ ký hiệu ra ngoài API |
| threshold_value | Decimal(10,2) | |
| severity | enum `info \| warning \| critical` | default `warning` |
| is_active | Boolean | default `true` |

### alerts
Cảnh báo đã phát sinh (từ `alert_rules`, truy cập trái phép, thiết bị mất kết nối...).

| Field | Kiểu | Ghi chú |
|---|---|---|
| home_id | Int | FK → homes, cascade delete |
| alert_rule_id | Int? | FK → alert_rules (null nếu không phải từ rule, vd unauthorized_access) |
| alert_type | enum `environment \| unauthorized_access \| device_offline` | |
| severity | enum `info \| warning \| critical` | default `warning` |
| title | String | |
| message | String (Text) | |
| status | enum `unread \| read \| resolved` | default `unread` |

### notifications
Thông báo gửi tới user (kênh in-app/email/telegram/push), thường sinh ra từ 1 `alert`.

| Field | Kiểu | Ghi chú |
|---|---|---|
| user_id | Int | FK → users, cascade delete |
| alert_id | BigInt? | FK → alerts (optional) |
| title / message | String | |
| channel | enum `in_app \| email \| telegram \| push` | default `in_app` |
| status | enum `pending \| sent \| failed \| read` | default `pending` |

### device_actions
Log lệnh điều khiển thiết bị (bật/tắt/mở/đóng).

| Field | Kiểu | Ghi chú |
|---|---|---|
| device_id | Int | FK → devices, cascade delete |
| user_id | Int? | FK → users (null nếu hệ thống tự thực hiện) |
| action | enum `turn_on \| turn_off \| open \| close` | |
| control_method | enum `app \| voice \| password \| face \| automatic \| manual` | |
| execution_status | enum `success \| failed` | |
| failure_reason | String? | |

### voice_commands
Log lệnh thoại.

| Field | Kiểu | Ghi chú |
|---|---|---|
| user_id | Int? | FK → users |
| device_id | Int? | FK → devices |
| recognized_text | String (Text) | text nhận diện được |
| intent | String? | intent đã phân giải |
| confidence_score | Decimal(5,4)? | |
| execution_status | enum `success \| failed \| unknown_command` | |

### face_profiles
Hồ sơ khuôn mặt để mở cửa bằng face-id.

| Field | Kiểu | Ghi chú |
|---|---|---|
| home_id | Int | FK → homes, cascade delete |
| user_id | Int? | FK → users |
| name | String | |
| image_url | String? | |
| face_embedding | String? (LongText) | vector embedding, không trả raw về FE |
| is_active | Boolean | default `true` |

### door_access_logs
Log truy cập cửa (mọi phương thức: password/face/app/voice/manual).

| Field | Kiểu | Ghi chú |
|---|---|---|
| door_device_id | Int | FK → devices, cascade delete |
| user_id | Int? | FK → users |
| face_profile_id | Int? | FK → face_profiles |
| access_method | enum `password \| face \| app \| voice \| manual` | |
| result | enum `success \| failed` | |
| confidence_score | Decimal(5,4)? | dùng khi access_method = face |
| snapshot_url | String? | ảnh chụp lúc truy cập |
| failure_reason | String? | |

### door_passwords
Mật khẩu cửa (hash, không phải plaintext).

| Field | Kiểu | Ghi chú |
|---|---|---|
| door_device_id | Int | FK → devices, cascade delete |
| password_hash | String | KHÔNG trả về FE |
| is_active | Boolean | default `true` |
| updated_by | Int? | FK → users, ai sửa gần nhất |

### refresh_tokens
Token dùng để cấp lại access token (JWT). Xem `src/services/auth.service.js`.

| Field | Kiểu | Ghi chú |
|---|---|---|
| user_id | Int | FK → users, cascade delete |
| token_hash | String | unique, SHA-256 hash của refresh token thật (token thật không lưu DB) |
| expires_at | DateTime | |

FE không cần đụng bảng này trực tiếp — chỉ tương tác qua API `/api/auth/*`.

## Enum reference

| Enum | Giá trị |
|---|---|
| users_role | admin, user |
| users_status | active, inactive |
| devices_device_type | light, fan, door, sensor |
| devices_connection_status | online, offline |
| sensors_sensor_type | temperature, humidity, light |
| alert_rules_condition_operator | API: `gt`, `lt`, `gte`, `lte`, `eq` (cột MySQL lưu ký hiệu `>`/`<`/`>=`/`<=`/`=` qua `@map`, không lộ ra API) |
| alert_rules_severity / alerts_severity | info, warning, critical |
| alerts_alert_type | environment, unauthorized_access, device_offline |
| alerts_status | unread, read, resolved |
| notifications_channel | in_app, email, telegram, push |
| notifications_status | pending, sent, failed, read |
| device_actions_action | turn_on, turn_off, open, close |
| device_actions_control_method | app, voice, password, face, automatic, manual |
| device_actions_execution_status | success, failed |
| door_access_logs_access_method | password, face, app, voice, manual |
| door_access_logs_result | success, failed |
| voice_commands_execution_status | success, failed, unknown_command |

## Field nhạy cảm — KHÔNG trả về FE

- `users.password_hash`
- `door_passwords.password_hash`
- `refresh_tokens.token_hash`
- `face_profiles.face_embedding` (raw vector, không cần thiết cho FE)

Nguồn: `prisma/schema.prisma`. Đổi schema → chạy `npx prisma migrate dev` → cập nhật file này nếu cấu trúc bảng thay đổi.
