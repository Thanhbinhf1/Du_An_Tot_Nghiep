# Quản trị cửa hàng

## Khởi tạo lần đầu

1. Tạo `backend/.env` từ `.env.example`, sau đó điền `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` và `ADMIN_PASSWORD`. Dùng mật khẩu riêng dài ít nhất 12 ký tự; không đưa thông tin đăng nhập vào mã nguồn.
2. Tại thư mục `backend`, chạy `npm install` rồi `npm run create-admin`.
   Lệnh này tạo tài khoản admin, bốn danh mục ban đầu và sản phẩm mẫu. Lệnh không nâng quyền tài khoản đã tồn tại.
3. Chạy backend bằng `npm run dev`.
4. Tạo `frontend/.env.local` từ `frontend/.env.example`, rồi chạy frontend. Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD`; admin sẽ được chuyển đến `/admin`.

Tài khoản đăng ký từ giao diện luôn có quyền khách hàng. Chỉ backend cấp quyền quản trị; các endpoint quản trị kiểm tra token và role admin trên máy chủ. Tại trang quản trị có thể thêm, sửa, xóa sản phẩm và danh mục; ảnh JPG, PNG hoặc WEBP tối đa 5 MB được lưu trong `backend/uploads`.

## API

- `GET /api/catalog/categories` và `GET /api/catalog/products` trả dữ liệu cửa hàng.
- `POST /api/admin/categories`, `PUT/DELETE /api/admin/categories/:id` quản lý danh mục.
- `POST /api/admin/products`, `PUT/DELETE /api/admin/products/:id` quản lý sản phẩm.
- `POST /api/admin/uploads` tải ảnh lên.

Các endpoint `/api/admin/*` yêu cầu `Authorization: Bearer <JWT>` của admin.
