# smarthome-backend

Backend API cho đồ án IoT Smart Home (Yolobit + Ohstem Cloud). Express + MySQL (qua Prisma ORM).

## Yêu cầu

- Node.js 20+
- MySQL

## Cài đặt

1. Clone repo. Nếu dùng nvm:

   ```bash
   nvm use
   ```

   Project có sẵn `.nvmrc`

2. Cài dependency:

   ```bash
   npm install
   ```

3. Copy file env mẫu, chỉnh lại cho khớp MySQL của bạn:

   ```bash
   cp .env.example .env
   ```

   ```
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=smart_home

   DATABASE_URL="mysql://root:@127.0.0.1:3306/smart_home"
   ```

4. Tạo database + bảng:

   ```bash
   npx prisma migrate dev
   ```

## Chạy dự án

```bash
npm run dev
```

Server chạy ở `http://localhost:3000` (đổi qua biến `PORT` trong `.env`).

Kiểm tra kết nối DB:

```bash
curl http://localhost:3000/api/health
```

### Test API bằng giao diện

Mở `http://localhost:3000/api-docs` — Swagger UI, list sẵn hết endpoint, bấm "Try it out" để gọi thử ngay trên browser, không cần curl/Postman.

Thêm endpoint mới thì viết comment `@openapi` phía trên route (xem `src/routes/devices.routes.js` làm ví dụ), Swagger UI tự đọc lại khi restart server.

## Cấu trúc thư mục

```
src/
  app.js               # entry point: middleware + route mounting + listen
  config/prisma.js      # Prisma Client singleton
  routes/               # định nghĩa endpoint, mount dưới /api
  controllers/          # nhận request, gọi service
  services/             # business logic, query qua Prisma
prisma/
  schema.prisma         # khai báo bảng/cột/quan hệ — muốn đổi cấu trúc DB thì sửa ở đây
  migrations/           # lịch sử mỗi lần đổi schema (giống database/migrations của Laravel)
db/
  schema.sql            # file schema gốc.
```

## Cập nhật DB (thêm bảng, thêm cột...)

1. Sửa `prisma/schema.prisma`
2. Chạy `npx prisma migrate dev --name ten_thay_doi`

File migration mới được lưu vào `prisma/migrations/`.

## Các lệnh hay dùng

| Lệnh                                         | Mục đích                                     |
| -------------------------------------------- | -------------------------------------------- |
|                                              |
| `npx prisma migrate dev --name ten_thay_doi` | tạo + apply migration mới sau khi sửa schema |
| `npx prisma migrate deploy`                  | run migration                                |
