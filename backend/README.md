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

## API biến thể sản phẩm (ERD2)

Biến thể dùng model `ProductVariant` riêng với collection hiện có `productvariants`
(tên mặc định của Mongoose). Không đổi tên collection để tránh bỏ sót dữ liệu cũ.

- `GET /api/products/:productId/variants`: danh sách biến thể đang bán của sản phẩm đang hoạt động, truy cập công khai.
- `GET /api/products/admin?page=1&limit=25`: danh sách sản phẩm ERD2 có phân trang, gồm cả sản phẩm đã tắt, yêu cầu JWT admin.
- `GET /api/products/:productId/variants/admin`: danh sách toàn bộ biến thể, gồm cả biến thể ngừng bán, yêu cầu JWT admin.
- `POST /api/products/:productId/variants`: thêm biến thể, yêu cầu JWT admin.
- `PATCH /api/products/:productId/variants/:variantId`: cập nhật một phần, yêu cầu JWT admin.
- `DELETE /api/products/:productId/variants/:variantId`: đặt `status: false` để ngừng bán, giữ tham chiếu giỏ hàng/đơn hàng, yêu cầu JWT admin.

Ví dụ body POST:

```json
{
  "sku": "AO-001-M-DEN",
  "size": "M",
  "color": "Đen",
  "price": 250000,
  "sale_price": 220000,
  "stock_quantity": 10,
  "status": true
}
```

`sku`, `size`, `color`, `price` bắt buộc khi thêm; tồn kho mặc định 0, trạng thái mặc định true.
SKU được cắt khoảng trắng và viết hoa; size/color được cắt khoảng trắng.
SKU duy nhất toàn hệ thống; size + color duy nhất trong cùng sản phẩm (phân biệt hoa/thường).
Giá phải là số hữu hạn không âm; giá giảm không vượt giá gốc, dùng `null` để bỏ giá giảm.
Tồn kho phải là số nguyên an toàn không âm; `status` phải là boolean.
PATCH không cho đổi `product_id` hay cập nhật trường ngoài danh sách trên.
Mã lỗi: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền, 404 không tìm thấy,
409 trùng SKU/size + color hoặc có cập nhật đồng thời.
Biến thể ngừng bán có thể bật lại bằng PATCH với `status: true`.

Chạy `npm run typecheck` và `npm test` tại `backend`.
`npm test` chạy HTTP qua Express, JWT và schema Mongoose; tầng lưu trữ được giả lập,
không kết nối hay thay đổi MongoDB thật.

### Kiểm thử với MongoDB thật

Chạy `npm run test:integration` tại `backend` sau khi điền `DATABASE` hoặc
`DATABASE_URL` trong `.env`. Không cần khởi động backend hay tạo admin thủ công.

Lệnh tạo database riêng có tên ngẫu nhiên `pv_test_<mã ngẫu nhiên>`, ghi đè tên
database trong URI kết nối và tự dọn database kiểm thử sau khi chạy. Tài khoản
MongoDB cần quyền tạo database/collection/index, đọc ghi và xóa database kiểm thử.
Lệnh không ghi vào database ứng dụng và không dùng tài khoản admin đang có.

Các tình huống gồm đăng nhập admin, đăng ký khách hàng, phân quyền, tạo sản phẩm,
thêm/sửa/ngừng bán/bật bán lại biến thể, kiểm tra giá/tồn kho, unique index SKU và
size + color, hai request tạo trùng đồng thời, kiểm tra biến thể thuộc sản phẩm,
ẩn biến thể ngừng bán khỏi chi tiết sản phẩm và ngăn ghi đè phiên bản đã thay đổi.

### Quản lý trên giao diện

Đăng nhập admin tại frontend, mở `/admin` và chọn tab **Biến thể sản phẩm**.
Chọn sản phẩm, nhập SKU/size/màu/giá/tồn kho để thêm biến thể; dùng **Sửa**,
**Ngừng bán** hoặc **Bật bán lại** ở từng dòng. Để trống giá khuyến mãi để bỏ giá giảm.
Nếu chưa có sản phẩm ERD2, dùng **Tạo sản phẩm mới**, chọn danh mục và thương hiệu
đang hoạt động, sau đó thêm biến thể.

Tab này dùng `Product` + `ProductVariant` theo ERD2. Tab **Sản phẩm** hiện có và
catalog cửa hàng vẫn dùng `StorefrontProduct`; chưa thực hiện chuyển đổi dữ liệu
hoặc nối sản phẩm ERD2 vào giao diện mua hàng. Vì vậy, các sản phẩm tạo từ tab
**Biến thể sản phẩm** hiện được quản lý riêng với catalog cũ.
