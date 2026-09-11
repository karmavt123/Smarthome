# Tài liệu dự án DADN — Hệ thống nhà thông minh

Toàn bộ tài liệu markdown của monorepo nằm trong thư mục này, chia theo thành phần.

Bốn file cố ý **không** chuyển vào đây:

| File | Lý do giữ nguyên chỗ cũ |
|---|---|
| `README.md` (gốc repo) | Là trang đầu tiên người chấm và GitHub nhìn thấy khi mở repo |
| `apps/*/CLAUDE.md` (3 file) | Không phải tài liệu — là file cấu hình Claude Code đọc theo từng thư mục; chuyển đi là mất tác dụng |
| `apps/ai-service/app/faces/README.md` | Hướng dẫn đặt tên ảnh cho đúng thư mục chứa ảnh đó; tách ra khỏi thư mục là vô nghĩa |

---

## 📋 Báo cáo rà soát (`bao-cao/`)

Kết quả hai đợt rà soát toàn hệ thống ngày 10/09/2026.

| File | Nội dung |
|---|---|
| [`RA-SOAT-VA-SUA-LOI-10-09-2026.md`](bao-cao/RA-SOAT-VA-SUA-LOI-10-09-2026.md) | 25 lỗi đã sửa: bảo mật, lỗi chức năng, lỗi logic. Mỗi mục có trước/sau, lý do sửa và lý do chọn cách đó |
| [`CHUC-NANG-BO-SUNG-10-09-2026.md`](bao-cao/CHUC-NANG-BO-SUNG-10-09-2026.md) | 6 chức năng thêm mới: CRUD thiết bị/phòng, trạng thái khoá PIN, lọc theo thời gian, API gộp theo ngày |
| [`RA-SOAT-VONG-2-10-09-2026.md`](bao-cao/RA-SOAT-VONG-2-10-09-2026.md) | 23 lỗi vòng 2 (gồm 3 hồi quy do chính vòng 1 gây ra): `mqtt/`, `simulator/`, index CSDL, múi giờ, và toàn bộ nội thất ai-service |
| [`RA-SOAT-VONG-3-11-09-2026.md`](bao-cao/RA-SOAT-VONG-3-11-09-2026.md) | 13 lỗi vòng 3 (gồm 4 hồi quy do chính vòng 2 gây ra), toàn bộ do kiểm thử đối kháng trên seed data thật + MySQL 8 thật tìm ra: `selectDevice` viết lại lần 5, DoS khoá cửa chủ nhà, xoá thiết bị để gỡ mã PIN, `math.isfinite` tự gây lỗi 500 |

## ⚙️ Backend (`backend/`)

Node.js + Express + Prisma + MySQL.

| File | Nội dung |
|---|---|
| [`README.md`](backend/README.md) | Tổng quan, cách chạy, biến môi trường |
| [`DATABASE.md`](backend/DATABASE.md) | Lược đồ cơ sở dữ liệu |
| [`DEVICE-API-PLAN.md`](backend/DEVICE-API-PLAN.md) | Thiết kế API thiết bị |
| [`AI-SERVICE-FACE-ID-PLAN.md`](backend/AI-SERVICE-FACE-ID-PLAN.md) · [`AI-SERVICE-FACE-ID-SPEC.md`](backend/AI-SERVICE-FACE-ID-SPEC.md) | Kế hoạch và đặc tả Face ID phía backend |
| [`NODE-INTEGRATION-FOR-FACE-ID.md`](backend/NODE-INTEGRATION-FOR-FACE-ID.md) | Cách backend gọi ai-service |
| [`FACE-ID-USAGE.md`](backend/FACE-ID-USAGE.md) · [`FACE-ID-PLAN-FRONTEND.md`](backend/FACE-ID-PLAN-FRONTEND.md) | Luồng sử dụng Face ID |
| [`VOICE-COMMAND-PLAN.md`](backend/VOICE-COMMAND-PLAN.md) | Thiết kế điều khiển bằng giọng nói |
| [`AI-SERVICE-FUTURE-FEATURES-PLAN.md`](backend/AI-SERVICE-FUTURE-FEATURES-PLAN.md) | Hướng phát triển tiếp |
| [`P1-FIXES.md`](backend/P1-FIXES.md) | Đợt sửa lỗi ưu tiên 1 trước đây |
| [`backend-requests.md`](backend/backend-requests.md) · [`frontend-requests.md`](backend/frontend-requests.md) | Trao đổi yêu cầu giữa hai phía |

## 🎨 Frontend (`frontend/`)

React + Vite + Tailwind.

| File | Nội dung |
|---|---|
| [`README.md`](frontend/README.md) | Tổng quan, cách chạy |
| [`DESIGN.md`](frontend/DESIGN.md) | Hệ thống thiết kế, bảng màu, typography |
| [`AUTH.md`](frontend/AUTH.md) | Luồng xác thực, refresh token |
| [`DATABASE.md`](frontend/DATABASE.md) | Mô hình dữ liệu phía client |
| [`FRONTEND-IMPLEMENTATION-PLAN.md`](frontend/FRONTEND-IMPLEMENTATION-PLAN.md) | Kế hoạch triển khai giao diện |
| [`FACE-ID-USAGE.md`](frontend/FACE-ID-USAGE.md) · [`FACE-ID-PLAN-FRONTEND.md`](frontend/FACE-ID-PLAN-FRONTEND.md) | Face ID phía giao diện |
| [`BACKEND-REQUESTS.md`](frontend/BACKEND-REQUESTS.md) · [`BACKEND-CHANGELOG.md`](frontend/BACKEND-CHANGELOG.md) | Yêu cầu gửi backend và nhật ký thay đổi |

## 🤖 AI Service (`ai-service/`)

Python + Flask + ONNX Runtime + InsightFace.

| File | Nội dung |
|---|---|
| [`README.md`](ai-service/README.md) | Tổng quan, cách chạy, biến môi trường |
| [`AI-SERVICE-FACE-ID-SPEC.md`](ai-service/AI-SERVICE-FACE-ID-SPEC.md) | Đặc tả API Face ID |
| [`NODE-INTEGRATION.md`](ai-service/NODE-INTEGRATION.md) | Hợp đồng giao tiếp với backend Node |
| [`VOICE-COMMAND-PLAN.md`](ai-service/VOICE-COMMAND-PLAN.md) | Thiết kế phân loại ý định giọng nói |
