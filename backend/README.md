# Quản trị cửa hàng

## Khởi tạo lần đầu

1. Tạo `backend/.env` từ `.env.example`, sau đó điền `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` và `ADMIN_PASSWORD`. Dùng mật khẩu riêng dài ít nhất 12 ký tự; không đưa thông tin đăng nhập vào mã nguồn.
2. Tại thư mục `backend`, chạy `npm install` rồi `npm run create-admin`.
   Lệnh này tạo tài khoản admin, bốn danh mục ban đầu và sản phẩm mẫu trong catalog cũ. Lệnh không nâng quyền tài khoản đã tồn tại.
3. Chạy backend bằng `npm run dev`.
4. Tạo `frontend/.env.local` từ `frontend/.env.example`, rồi chạy frontend. Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD`; admin sẽ được chuyển đến `/admin`.

Tài khoản đăng ký từ giao diện luôn có quyền khách hàng. Chỉ backend cấp quyền quản trị; các endpoint quản trị kiểm tra token và role admin trên máy chủ. Tại trang quản trị có thể thêm, sửa, xóa sản phẩm và danh mục; ảnh JPG, PNG hoặc WEBP tối đa 5 MB được lưu trong `backend/uploads`.

## API

- `GET /api/catalog/categories` trả danh mục cửa hàng. `GET /api/products?view=storefront&page=1&limit=100` trả sản phẩm đang hoạt động, ảnh chính và biến thể đang bán. `GET /api/products/:id` trả chi tiết.
- `GET /api/catalog/products` phục vụ danh sách sản phẩm cũ trong trang quản trị.
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

Đăng nhập admin tại frontend, mở `/admin` và chọn tab **Sản phẩm cửa hàng**.
Chọn sản phẩm, nhập SKU/size/màu/giá/tồn kho để thêm biến thể; dùng **Sửa**,
**Ngừng bán** hoặc **Bật bán lại** ở từng dòng. Để trống giá khuyến mãi để bỏ giá giảm.
Nếu chưa có sản phẩm ERD2, dùng **Tạo sản phẩm mới**, chọn danh mục và thương hiệu
đang hoạt động, sau đó thêm biến thể.

Catalog cửa hàng, giỏ hàng và đơn hàng cùng dùng `Product` và `ProductVariant` theo ERD2.
Trong **Sản phẩm cửa hàng**, chọn sản phẩm để chỉnh sửa thông tin, hiển thị, ảnh và biến thể.
Tạo hoặc sửa danh mục và thương hiệu ở các tab tương ứng. API `StorefrontProduct` cũ vẫn phục vụ các bản ghi cũ.

Luồng đặt hàng dùng transaction và yêu cầu MongoDB replica set hoặc sharded cluster.
Checkout hiển thị COD và những phương thức thanh toán có cấu hình backend. Với VNPay hoặc MoMo, khai báo thêm tên miền chuyển hướng tương ứng trong cấu hình frontend.

## Tài khoản và liên hệ

- `GET /api/wishlist`, `PUT/DELETE /api/wishlist/:productId` đồng bộ yêu thích theo JWT.
- `PATCH /api/auth/password` nhận `currentPassword` và `newPassword`. Sau khi đổi, các JWT đã cấp của tài khoản hết hiệu lực.
- `POST /api/contact` nhận biểu mẫu và trả mã liên hệ. Quản trị viên xem và đánh dấu yêu cầu tại **Liên hệ** trong `/admin`.

## Cấu hình thanh toán

- Chuyển khoản dùng `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`. Trong **Đơn hàng**, quản trị viên nhập mã giao dịch sau khi đối chiếu tiền đã nhận. Mỗi mã giao dịch chỉ xác nhận được một đơn.
- VNPay cần `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL` trỏ đến `/api/payments/vnpay/return` và `VNP_RESULT_PAGE_URL` trỏ đến trang `/payment/result` của frontend. Đăng ký địa chỉ HTTPS công khai `/api/payments/vnpay/ipn` với VNPay. `VNP_API_URL` trỏ tới endpoint QueryDR cho đối soát. [Tài liệu VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
- Nếu trang đăng ký Sandbox trả lỗi 404, dùng [trang hỗ trợ kỹ thuật VNPay](https://sandbox.vnpayment.vn/apis/contact/) để đề nghị cấp mã kết nối thử nghiệm.
- MoMo cần thông tin merchant và các URL trong `.env.example`. Dùng `MOMO_REDIRECT_URL` trỏ đến `/api/payments/momo/return`, `MOMO_IPN_URL` trỏ đến `/api/payments/momo/ipn` qua HTTPS công khai và `MOMO_RESULT_PAGE_URL` trỏ đến `/payment/result`. [Tài liệu MoMo](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/)
- Khi chuyển từ sandbox sang môi trường thật, đặt `NEXT_PUBLIC_VNPAY_PAYMENT_HOST` và `NEXT_PUBLIC_MOMO_PAYMENT_HOST` trong frontend theo tên miền trang thanh toán do từng cổng cung cấp rồi build lại frontend.

### Google Sign-In và địa chỉ

- Tạo OAuth Client kiểu Web application, thêm origin frontend vào **Authorized JavaScript origins**, đặt Web Client ID vào `GOOGLE_CLIENT_ID` trong backend rồi khởi động lại backend. Khi chạy F.Style tại cổng 3000, thêm cả `http://localhost` và `http://localhost:3000`. [Hướng dẫn Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- Danh sách giao hàng dùng `GET /api/addresses/locations` và `GET /api/addresses/locations/:provinceCode/wards`. Khi tạo hoặc đổi địa bàn, gửi `province_code` và `ward_code`. API lưu tên chuẩn dựa trên cả hai mã. Dữ liệu địa phương đi kèm backend lấy từ [Province Open API v2](https://provinces.open-api.vn/) theo [Quyết định 19/2025/QĐ-TTg](https://congbao.chinhphu.vn/tai-ve-van-ban-so-19-2025-qd-ttg-45430-57438?format=pdf).

Trang kết quả đọc trạng thái lưu ở backend. Trong admin, **Đối soát và cập nhật VNPay** chỉ cập nhật đơn nếu QueryDR xác thực được kết quả cuối cùng và số tiền khớp.
