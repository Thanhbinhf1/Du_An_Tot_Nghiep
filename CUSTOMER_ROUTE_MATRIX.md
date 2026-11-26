# ROUTE_AUDIT — VSC_BAPD

Kiểm kê đầu kỳ theo `frontend/app/**/page.tsx`. Tất cả dùng root layout và StorefrontChrome, trừ khi route chuyển hướng ngay. API trong bảng dùng tiền tố `/api`. Cột cuối mô tả ưu tiên khi tiếp nhận; kết quả sau sửa có trong [kiểm thử chức năng](CUSTOMER_FUNCTION_TEST.md) và [QA cuối](CUSTOMER_FINAL_QA.md).

| Route | Page component | Layout | API chính | Chức năng | UI ban đầu | Nghiệp vụ và lỗi cần kiểm tra | Ưu tiên |
|---|---|---|---|---|---|---|---|
| / | HomePage | Storefront | GET /storefront-content/home, /catalog/categories, /products, /catalog/outfits | Hero, danh mục, các bộ sản phẩm | Banner toàn chiều ngang | Danh sách nổi bật gắn id bán chạy | Cao |
| /products | ProductListing | Catalog | GET /products, /catalog/categories | Danh sách, bộ lọc, sort, trang | Grid 4 cột | Thiếu ảnh theo màu trong payload rút gọn | Cao |
| /search | ProductListing (searchMode) | Catalog | GET /products, /catalog/categories | Tìm theo q, lọc, sắp xếp | Chung product card | Chung vấn đề ảnh theo màu | Cao |
| /categories/[slug] | CategoryEntry → CategoryPage | Catalog | GET /categories/resolve/:slug, /catalog/categories, /products | Nhóm người mặc, danh mục con, phân trang | Lưới chung | Bộ lọc danh mục chỉ tồn tại trong state | Cao |
| /nu | CategoryEntry → CategoryPage | Catalog | GET /categories/resolve/:slug, /catalog/categories, /products | Nhóm người mặc, danh mục con, phân trang | Lưới chung | Bộ lọc danh mục chỉ tồn tại trong state | Cao |
| /nam | CategoryEntry → CategoryPage | Catalog | GET /categories/resolve/:slug, /catalog/categories, /products | Nhóm người mặc, danh mục con, phân trang | Lưới chung | Bộ lọc danh mục chỉ tồn tại trong state | Cao |
| /tre-em | CategoryEntry → CategoryPage | Catalog | GET /categories/resolve/:slug, /catalog/categories, /products | Nhóm người mặc, danh mục con, phân trang | Lưới chung | Bộ lọc danh mục chỉ tồn tại trong state | Cao |
| /em-be | CategoryEntry → CategoryPage | Catalog | GET /categories/resolve/:slug, /catalog/categories, /products | Nhóm người mặc, danh mục con, phân trang | Lưới chung | Bộ lọc danh mục chỉ tồn tại trong state | Cao |
| /product/[id] | ProductDetailPage | Chi tiết sản phẩm | GET /products/:id, /reviews/:productKey, /catalog/size-chart · POST /cart/items, /reviews/:productKey | SKU, gallery, zoom, size, kho, đánh giá, giỏ | Gallery và cột chọn SKU | Cần giữ lựa chọn khi đăng nhập | Cao |
| /cart | CartPage | Giỏ | GET /cart · PATCH/DELETE /cart/items/:itemId · DELETE /cart | Xem và sửa giỏ | Hai cột desktop | Trang giữ dòng đã xóa từ drawer | Cao |
| /checkout | BackendCheckout | Checkout | GET /cart, /addresses, /payments/methods · POST /orders/quote, /orders | Địa chỉ, vận chuyển, coupon, đặt hàng | Form và tóm tắt | Có thể giữ nút đặt hàng khi drawer đã xóa hết | Cao |
| /profile | ProfilePage | AccountLayout | GET /auth/me, /addresses | Thông tin tài khoản, địa chỉ, đăng xuất | Khung riêng của nhóm hồ sơ | Đối chiếu điện thoại từ hồ sơ server | Cao |
| /profile/edit | ProfileEditForm | AccountLayout | GET/PATCH /auth/me | Đọc và lưu hồ sơ | Form trong cột chính | API cập nhật chỉ nhận tên ở đầu kỳ | Cao |
| /profile/address | AddressBook | AccountLayout | GET/POST /addresses · PATCH/DELETE /addresses/:id · PATCH /addresses/:id/default · GET /addresses/locations | CRUD, chọn mặc định | Card và form địa chỉ | Thiếu xác nhận xóa | Cao |
| /profile/password | PasswordSettings | AccountLayout | PATCH /auth/password | Xác nhận mật khẩu hiện tại và đổi mật khẩu | Form tài khoản | Cần kiểm tra xác nhận và hiệu lực session | Cao |
| /orders | OrdersPage | Khung đơn hàng | GET /orders/my · PATCH /orders/:id/cancel | Tra cứu, lọc, hủy theo chính sách | Tách khỏi khung tài khoản | Chưa có phân trang UI | Cao |
| /orders/[id] | OrderDetailsPage | Khung đơn hàng | GET /orders/:id · PATCH /orders/:id/cancel · POST /payments/{gateway}/create | Chi tiết, giao nhận, thanh toán, hủy | Cột nội dung độc lập | Timeline suy ra từ trạng thái, thiếu lịch sử thật | Cao |
| /orders/backend | BackendOrdersPage | Chuyển hướng | Theo /orders | Chuyển đến danh sách | Dùng trang đích | Đường dẫn tương thích cũ | Thấp |
| /order-confirmation | OrderConfirmationPage | Chuyển hướng | Theo /orders/:id hoặc /orders | Đi đến đơn vừa đặt | Dùng trang đích | Cần xác minh chuyển đúng id | Vừa |
| /wishlist | WishlistPage | Sidebar + grid riêng | GET /products, /wishlist · PUT/DELETE /wishlist/:productId · POST /wishlist/import | Lưu/bỏ yêu thích | Khác grid tài khoản | Guest dùng dữ liệu thiết bị, Customer đồng bộ máy chủ | Cao |
| /dang-nhap | LoginForm | AuthShell | POST /auth/login, /auth/google | Mật khẩu hoặc Google nếu cấu hình | Form đăng nhập | Cần giữ đường quay về hợp lệ | Cao |
| /dang-ky | DangKyPage | AuthShell | POST /auth/register, /auth/google | Đăng ký và khởi tạo phiên | Form đăng ký | Cần xác minh trùng email, validation và lưu phiên | Cao |
| /quen-mat-khau | ForgotPasswordPage | AuthShell | POST /auth/forgot-password, /auth/reset-password | Yêu cầu mã và đặt lại mật khẩu | Form theo bước | Gửi email phụ thuộc SMTP | Cao |
| /outfit | OutfitPage | Lookbook | GET /catalog/outfits, /products · POST /cart/items | Chọn bộ, SKU và thêm các món | Grid bộ phối | Cần xác minh xử lý hết hàng và thành công một phần | Vừa |
| /mix-match | OutfitPage | Lookbook | GET /catalog/outfits, /products · POST /cart/items | Chọn bộ, SKU và thêm các món | Grid bộ phối | Cần xác minh xử lý hết hàng và thành công một phần | Vừa |
| /tu-van-size | SizeGuidePage | Smart Size | GET /catalog/categories, /catalog/size-chart, /products · POST /catalog/size-recommendations | Chọn phạm vi và nhập số đo | Form và kết quả | Đối chiếu gợi ý với size/kho thực | Vừa |
| /payment/result | PaymentResult | Kết quả thanh toán | GET /orders/:id, /payments/order/:orderId · POST /payments/sepay/orders/:orderId/reconcile | Đọc trạng thái thanh toán | Trạng thái có giải thích | Cần kết quả backend mới kết luận | Cao |
| /payment/sepay | SePayPayment | Thanh toán | POST /payments/sepay/create, /payments/sepay/orders/:orderId/reconcile · GET /payments/order/:orderId | Thanh toán SePay và đối soát | QR và trạng thái | QA chỉ dùng webhook thử | Cao |
| /payment/bank-transfer | BankTransferContent | Thanh toán | POST /payments/bank-transfer | Tạo nội dung chuyển khoản cho đơn | Trang hẹp | Có thể hiển thị thông tin của đơn trước | Cao |
| /contact | ContactPage | Hỗ trợ | POST /contact | Tạo yêu cầu hỗ trợ thực | Form liên hệ | Theo dõi phản hồi lỗi và mã ticket | Vừa |
| /help | StoreInfoPage | Hỗ trợ | Nội dung tĩnh | Trung tâm trợ giúp | Trang thông tin | Không có mutation tại route này | Thấp |
| /shipping | StoreInfoPage | Hỗ trợ | Nội dung tĩnh | Chính sách giao hàng | Trang thông tin | Không có mutation tại route này | Thấp |
| /returns | StoreInfoPage | Hỗ trợ | Nội dung tĩnh | Hướng dẫn đổi trả | Trang thông tin | Không có mutation tại route này | Thấp |
| /terms | StoreInfoPage | Hỗ trợ | Nội dung tĩnh | Điều khoản | Trang thông tin | Không có mutation tại route này | Thấp |
| /privacy | StoreInfoPage | Hỗ trợ | Nội dung tĩnh | Chính sách bảo mật | Trang thông tin | Không có mutation tại route này | Thấp |

API dùng chung trên nhiều trang gồm danh mục điều hướng, tìm kiếm gợi ý, giỏ của chủ token, wishlist và cấu hình cửa hàng. Mỗi route động đại diện cho một mẫu route. Checkout, sửa địa chỉ, bộ lọc, OTP và chi tiết outfit có nhiều trạng thái nội bộ trong cùng route. Promotions và collections có thể là section hoặc query của catalog. Không đếm từng giá trị query như một trang mới.
