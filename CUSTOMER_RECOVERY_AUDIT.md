# Khôi phục Customer VSC_BAPD

## Điểm phục hồi

Nhánh ban đầu `feature/ThanhBinh`, HEAD `69d2ceb`. Điểm gốc có nhiều file frontend, backend, Admin và upload chưa commit, cùng các file JS/declaration đã được xóa trước phiên này. Danh sách chính xác nằm trong [status.txt](frontend/e2e/.runtime/customer-recovery-PGbUkY/status.txt).

Trước khi sửa mã, đã sao chép toàn bộ **421 file** có mặt trong kết quả `git ls-files -co --exclude-standard` và xác minh từng bản sao bằng SHA-256. [Bản sao nguồn](frontend/e2e/.runtime/customer-recovery-PGbUkY/source/) · [Manifest SHA-256](frontend/e2e/.runtime/customer-recovery-PGbUkY/sha256.json). Bản sao lưu cả file chưa được Git theo dõi, bao gồm upload chưa commit. File môi trường riêng, cơ sở dữ liệu và cache nằm ngoài phạm vi bản sao. Để lấy lại một file, đối chiếu manifest rồi sao chép riêng bản tương ứng sau khi kiểm tra thay đổi mới.

## Lịch sử và phần tái sử dụng

Đã đối chiếu log và diff của `96d717b`, `5ab278d`, HEAD và working tree. Header cũ dùng chữ F.Style. Worktree hiện tại có logo VSC_BAPD, các biến thể, checkout qua API và form tài khoản đã tích hợp. Giữ các luồng này làm nền cho việc sửa từng component. Không cần rollback toàn bộ.

## Cấu trúc và phạm vi

Next App Router có 36 file `page.tsx` trước khi sửa. 35 route Customer bao gồm route động, bí danh và chuyển hướng. Màn Admin/Staff nằm ở `/admin`. Root layout dùng StorefrontChrome và WishlistProvider. API đang chạy từ `backend/src/server.ts`; `app.ts` có phạm vi route khác. Client đọc envelope `data`, gửi Bearer token cho dữ liệu riêng. Express kiểm tra quyền, Mongoose lưu dữ liệu. Xem [ma trận route](CUSTOMER_ROUTE_MATRIX.md).

Đã kiểm kê các model tài khoản, địa chỉ, OTP và giới hạn reset, sản phẩm, biến thể, ảnh, thương hiệu, danh mục, giỏ và dòng giỏ, coupon, đơn và dòng đơn, lịch sử trạng thái, thanh toán, hoàn trả, biến động kho, bộ phối và dòng bộ phối, bảng size, bình luận, đánh giá và báo cáo, liên hệ, cấu hình, nhân viên, khóa và biên nhận chỉnh sửa catalog. Các phép thử ghi dữ liệu dùng MongoDB replica set tạm riêng và tài khoản QA.

## Phát hiện đầu kỳ

| Khu vực | Hiện trạng xác minh trong source | Ưu tiên |
|---|---|---|
| Header/footer | Mobile dồn năm thao tác bên phải logo. Footer hardcode thông tin liên hệ khác nguồn cấu hình cửa hàng. | Cao |
| Homepage | Mục có id bán chạy lấy cờ nổi bật, chưa xếp theo lượng bán. | Cao |
| Danh mục và card | Trạng thái lọc của trang danh mục mất khi tải lại. Danh sách rút gọn thiếu ảnh theo màu. | Cao |
| Tài khoản | Đơn hàng và wishlist dùng khung riêng. Hồ sơ chưa sửa số điện thoại qua API. Xóa địa chỉ gọi ngay API. | Cao |
| Đơn hàng | Tiến trình suy ra từ trạng thái hiện tại, không có thời điểm của từng sự kiện. | Cao |
| Giỏ và checkout | Thay đổi giỏ từ drawer có thể để lại nội dung cũ trên trang giỏ hoặc checkout. | Cao |
| Đổi trả | Có chính sách, liên hệ và xử lý kiện hoàn của nhân viên. Chưa thấy API Customer quản lý hồ sơ đổi trả sau giao. | Phụ thuộc chính sách |
