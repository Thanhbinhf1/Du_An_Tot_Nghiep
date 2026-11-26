# Đối chiếu hình ảnh Customer VSC_BAPD

| Ảnh đính kèm | Chi tiết đã đọc | Quyết định triển khai |
|---|---|---|
| 1 | Bảng tổng hợp desktop từ hero đến footer, gồm cả form và đơn hàng | Dùng để đối chiếu cấu trúc và nhãn tiếng Việt. Nội dung thương mại lấy từ API. |
| 2 | Màn hình điện thoại, lưới hai cột, form một cột và các bước mua hàng | Kiểm tra 390 và 320 px. Chỉ hiển thị phương thức, phí và trạng thái do backend trả về. |
| 3 | Hồ sơ, sổ địa chỉ, đơn, đánh giá và hoàn tiền cùng trục sidebar–nội dung | Dùng chung lề, sidebar, tiêu đề và khoảng cách giữa các thao tác. |
| 4 | Drawer trái, tác vụ tài khoản trên mobile, địa chỉ mặc định và nút sửa/xóa | Ưu tiên diện tích đọc, giữ tìm kiếm và giỏ trong tầm tay, thu gọn điều hướng phụ. |
| 5 | Phần review UNIQLO ở trái, lựa chọn và giá bên phải | Giữ bộ chọn SKU, số lượng và trạng thái kho rõ khi đọc chi tiết. |
| 6 | Hai ảnh gallery liền nhau, ảnh chiếm phần lớn chiều rộng, thông tin mua bên phải | Tỷ lệ xấp xỉ 60/40 khi đủ rộng, ưu tiên ảnh thật theo màu. |
| 7 | Bốn ảnh dọc liền hàng, swatch và tên, giá giảm đỏ cạnh giá cũ | Giữ tỉ lệ ảnh, nhãn có nguồn dữ liệu, mặt thẻ trắng. |
| 8 | Lưới danh mục với ảnh và nhãn riêng, khoảng trống đều | Dùng ảnh của danh mục hoặc sản phẩm thuộc danh mục đó. |
| 9 | Hero toàn chiều ngang, copy nằm thấp bên trái, thanh điều hướng gọn | Dùng banner của cửa hàng, ưu tiên đọc được tiêu đề và CTA trên từng kích thước. |
| 10 | Bảng màn hình có thương hiệu VSC_BAPD, gồm grid và các bước checkout | Đối chiếu các vùng chức năng. Giá, thời hạn, tài khoản, hãng thanh toán trong ảnh là nội dung minh họa. |
| 11 | Chi tiết form địa chỉ, trạng thái hủy đơn, checkout và footer | Áp dụng phân cấp cho form và thao tác theo trạng thái thực của đơn. |

Ảnh 5–9 là tham chiếu UNIQLO. Các bảng ghép có logo VSC_BAPD gợi ý cách áp dụng cho thương hiệu. Do tệp đính kèm không có nhãn phân loại từng ảnh, hiện trạng được xác định bằng ảnh chụp lại từ source trước khi sửa. Dữ liệu và ảnh chụp QA dùng fixture trong MongoDB tạm. Logo ứng dụng là `frontend/public/logo-vsc.png`.

Các màn tham chiếu dùng sản phẩm, ảnh chụp và kích thước khác website QA. Đối chiếu theo bố cục, vị trí, lưới và phân cấp chữ. Chênh lệch pixel giữa hai bộ nội dung không đo được mức tương đồng thiết kế.
