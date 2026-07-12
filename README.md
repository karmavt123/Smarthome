# smarthome-backend

Backend API cho đồ án IoT Smart Home (Yolobit + Ohstem Cloud). Express + MySQL (qua Prisma ORM).

## Yêu cầu

- Node.js 20+ ([nvm](https://github.com/nvm-sh/nvm) khuyên dùng để quản lý version)
- MySQL đang chạy (XAMPP, Docker, hoặc cài trực tiếp đều được), port mặc định 3306

## Cài đặt

1. Clone repo, cài dependency:

   ```bash
   npm install
   ```

2. Copy file env mẫu:

   ```bash
   cp .env.example .env
   ```

   Mở `.env`, chỉnh lại cho khớp MySQL của bạn:

   ```
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=smart_home

   DATABASE_URL="mysql://root:@127.0.0.1:3306/smart_home"
   ```

3. Tạo database + bảng từ file schema có sẵn:

   ```bash
   mysql -h 127.0.0.1 -P 3306 -u root < db/schema.sql
   ```

   (Dùng XAMPP thì thay `mysql` bằng đường dẫn client của XAMPP, ví dụ trên macOS: `/Applications/XAMPP/xamppfiles/bin/mysql`)

4. Generate Prisma Client (dựa trên `prisma/schema.prisma`, đã khớp sẵn với `db/schema.sql`):

   ```bash
   npx prisma generate
   ```

## Chạy dự án

```bash
npm run dev
```

Server chạy ở `http://localhost:3000` (đổi qua biến `PORT` trong `.env` nếu cổng bị chiếm).

Kiểm tra kết nối DB:

```bash
curl http://localhost:3000/api/health
```

Trả về `{"status":"ok","db":"connected"}` là setup xong.

## Cấu trúc thư mục

```
src/
  app.js               # entry point: middleware + route mounting + listen
  config/prisma.js      # Prisma Client singleton
  routes/               # định nghĩa endpoint, mount dưới /api
  controllers/          # nhận request, gọi service
  services/             # business logic, query qua Prisma
db/
  schema.sql            # schema MySQL gốc, nguồn sự thật của cấu trúc DB
prisma/
  schema.prisma         # model Prisma, generate từ db/schema.sql qua `prisma db pull`
```

Xem thêm `CLAUDE.md` để hiểu kiến trúc chi tiết hơn.

## Các lệnh hay dùng

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | chạy server với nodemon (tự reload khi sửa code) |
| `npm start` | chạy server bình thường |
| `npx prisma studio` | mở GUI xem/sửa dữ liệu trong DB |
| `npx prisma db pull` | đồng bộ lại `schema.prisma` sau khi sửa `db/schema.sql` và apply vào DB |
