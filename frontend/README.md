# F.Style Store Frontend

## Chạy cùng backend

1. Cấu hình và khởi động backend theo hướng dẫn trong `backend/README.md`.
2. Tại thư mục frontend, sao chép `.env.example` thành `.env.local`. Nếu backend chạy ở cổng mặc định 5000, có thể dùng cấu hình sẵn.
3. Chạy `npm install` rồi `npm run dev`. Mở `http://localhost:3000`.

Vào **Sản phẩm cửa hàng** trong `/admin` để thêm sản phẩm và biến thể có tồn kho. Từ `/products`, mở sản phẩm để chọn biến thể, thêm vào giỏ hàng, lưu địa chỉ tại `/profile/address` và đặt hàng tại `/checkout`. Lịch sử và chi tiết đơn hàng nằm tại `/orders`.

Checkout lấy giá, tồn kho, địa chỉ và đơn hàng từ backend. Đơn hàng yêu cầu MongoDB có hỗ trợ transaction. Các phương thức thanh toán xuất hiện theo cấu hình backend và tên miền được phép trong `.env.local`.

- `/wishlist` đồng bộ danh sách theo tài khoản. Khách chưa đăng nhập lưu danh sách trên thiết bị.
- `/profile/password` cập nhật mật khẩu và yêu cầu đăng nhập lại trên các thiết bị.
- `/contact` gửi yêu cầu đến tab **Liên hệ** trong `/admin` để quản trị viên xử lý.
- Trong `/admin`, dùng các tab **Danh mục**, **Thương hiệu**, **Sản phẩm cửa hàng** để cập nhật catalog. Tab **Đơn hàng** theo dõi thanh toán và tiến độ giao hàng.
