# F.Style Store Frontend

## Chạy cùng backend

1. Cấu hình và khởi động backend theo hướng dẫn trong `backend/README.md`.
2. Tại thư mục frontend, sao chép `.env.example` thành `.env.local`. Nếu backend chạy ở cổng mặc định 5000, có thể dùng cấu hình sẵn.
3. Chạy `npm install` rồi `npm run dev`. Mở `http://localhost:3000`.

Vào **Sản phẩm cửa hàng** trong `/admin` để thêm sản phẩm và biến thể có tồn kho. Từ `/products`, mở sản phẩm để chọn biến thể, thêm vào giỏ hàng, lưu địa chỉ tại `/profile/address` và đặt hàng tại `/checkout`. Lịch sử và chi tiết đơn hàng nằm tại `/orders`.

Checkout lấy giá, tồn kho, địa chỉ và đơn hàng từ backend. Đơn hàng yêu cầu MongoDB có hỗ trợ transaction. SePay tạo QR theo đơn và nhận webhook tại backend. Thiết lập tài khoản nhận tiền theo hướng dẫn trong README của backend.

- `/wishlist` đồng bộ danh sách theo tài khoản. Khách chưa đăng nhập lưu danh sách trên thiết bị.
- `/profile/password` cập nhật mật khẩu và yêu cầu đăng nhập lại trên các thiết bị.
- `/contact` gửi yêu cầu đến tab **Liên hệ** trong `/admin` để quản trị viên xử lý.
- Trong `/admin`, dùng các tab **Danh mục**, **Thương hiệu**, **Sản phẩm cửa hàng** để cập nhật catalog. Tab **Đơn hàng** theo dõi thanh toán và tiến độ giao hàng.

Kiểm tra cục bộ: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Test mặc định dùng dữ liệu giả lập/render, không gửi thanh toán hoặc ghi MongoDB.
Danh sách quản trị đơn hàng/giao dịch/đánh giá dùng phân trang và bộ lọc từ API.
Khi lưu kho gặp 409, tải lại để đối chiếu số lượng mới; không tự gửi lại số lượng cũ.

## E2E tách biệt

Sau khi cài dependencies, chạy `npx playwright install chromium` một lần rồi
`npm run test:e2e`. Bộ chạy tạo MongoDB replica set tạm trên loopback, seed tài khoản
QA/database ngẫu nhiên, chạy API port 5100, cổng thanh toán giả lập port 5101 và frontend port 3101.
Các cổng phải đang trống. MongoDB binary được tải vào cache ngoài mã nguồn ở lần đầu.
Không cần chỉnh `.env`; backend test không nạp `.env` ứng dụng. Build test dùng
`.next-e2e` riêng, tránh chiếm thư mục build của server phát triển.

Không trỏ bộ E2E vào database ứng dụng: harness và helper chặn URL ngoài loopback
và database không có prefix `fstyle_e2e_`. Browser chặn request tới host bên ngoài.
Kiểm tra riêng luồng SePay với `E2E_TEST_MATCH=SEPAY-`. Bộ kiểm thử tạo QR theo đơn, gửi webhook thử và đọc lại trạng thái từ MongoDB tạm trên desktop và mobile.

Kết quả: `../E2E_TEST_REPORT.md`, `playwright-report/index.html`, `e2e-results.json`,
`test-results/` (ảnh/trace/DB evidence khi có). Logs server nằm trong `e2e/.runtime`.
Các artifact/runtime credentials không được theo dõi bởi Git. Orchestrator dừng
server và database do nó tạo ở cuối lượt chạy, kể cả khi test thất bại.

Để chạy thêm hai suite MongoDB có sẵn trên cùng MongoDB tạm, đặt process variable
`E2E_DB_CHECKS=1` khi gọi `npm run test:e2e` (không sửa `.env`).
