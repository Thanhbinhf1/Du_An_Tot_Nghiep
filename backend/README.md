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
Giá phải là số nguyên VNĐ an toàn không âm; giá giảm không vượt giá gốc, dùng `null` để bỏ giá giảm.
Tồn kho phải là số nguyên an toàn không âm; `status` phải là boolean.
PATCH không cho đổi `product_id` hay cập nhật trường ngoài danh sách trên.
Mã lỗi: 400 dữ liệu sai, 401 chưa đăng nhập, 403 không có quyền, 404 không tìm thấy,
409 trùng SKU/size + color hoặc có cập nhật đồng thời.
Biến thể ngừng bán có thể bật lại bằng PATCH với `status: true`.

PATCH biến thể có `stock_quantity` phải gửi thêm `expected_version` bằng `__v` đã đọc
(dùng 0 nếu bản ghi cũ chưa có `__v`). `PATCH /api/admin/inventory/:id` cũng yêu cầu
`stock_quantity` và `expected_version`. Nếu kho đã thay đổi do checkout/hoàn kho/chỉnh sửa
khác, API trả 409; tải lại và đối chiếu trước khi lưu. Cả hai màn hình quản trị đã gửi version.

`DELETE /api/products/:id` ẩn sản phẩm và ngừng bán các biến thể trong transaction;
giữ nguyên ảnh, variants và tham chiếu lịch sử. Bật hiển thị sản phẩm không tự bật lại variants.

`GET /api/admin/orders`, `/payments`, `/reviews` trả `data` dạng array và `pagination`
gồm `page`, `limit`, `total`, `totalPages` (mặc định 25, tối đa 100). Orders nhận
`status`, `method`, `search`; payments nhận `status`, `method`; reviews nhận `rating`, `search`.
Filter áp dụng trước phân trang; search literal tối đa 100 ký tự. Orders còn trả
`pagination.statusCounts` cho toàn bộ tập khớp search/method.

Hoàn thành đơn COD đồng nghĩa đã giao và thu đủ tiền, chuyển `payment_status` sang
`success` cùng transaction. Chỉ áp dụng khi cập nhật mới, không sửa đơn cũ hồi tố.
Đơn legacy mới dùng cùng cấu hình phí/coupon; nhận tại cửa hàng vẫn miễn phí.

Chạy `npm run typecheck` và `npm test` tại `backend`.
Chạy thêm `npm run typecheck:test` để kiểm tra kiểu cả test và `npm run build` để compile.
`npm test` chạy HTTP qua Express, JWT và schema Mongoose; tầng lưu trữ được giả lập,
không kết nối hay thay đổi MongoDB thật.
Không đặt các file JS/declarations sinh từ TypeScript cạnh source trong `src`;
`npm run check:source` phát hiện các file có thể che source. Build sinh vào `dist`.

### Kiểm thử với MongoDB thật

Chỉ chạy các lệnh dưới đây trong môi trường MongoDB kiểm thử được phép ghi/xóa.
Các lệnh này không nằm trong `npm test` mặc định. Transaction cần replica set/sharded cluster.
`npm run test:mongodb` kiểm tra commit/rollback theo cấu hình `MONGO_TEST_URI` trong
`.env.test`; đọc kỹ test và xác nhận URI disposable trước khi chạy.

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
Checkout hiển thị COD và những phương thức thanh toán có cấu hình backend. SePay tạo QR chuyển khoản theo đơn. MoMo dùng tài khoản merchant riêng của cửa hàng.

## Tài khoản và liên hệ

- `GET /api/wishlist`, `PUT/DELETE /api/wishlist/:productId` đồng bộ yêu thích theo JWT.
- `PATCH /api/auth/password` nhận `currentPassword` và `newPassword`. Sau khi đổi, các JWT đã cấp của tài khoản hết hiệu lực.
- `POST /api/contact` nhận biểu mẫu và trả mã liên hệ. Quản trị viên xem và đánh dấu yêu cầu tại **Liên hệ** trong `/admin`.

## Cấu hình thanh toán

- Chuyển khoản dùng `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`. Trong **Đơn hàng**, quản trị viên nhập mã giao dịch sau khi đối chiếu tiền đã nhận. Mỗi mã giao dịch chỉ xác nhận được một đơn.
- VNPay chỉ còn phục vụ tra cứu lịch sử.
- MoMo cần thông tin merchant và các URL trong `.env.example`. Dùng `MOMO_REDIRECT_URL` trỏ đến `/api/payments/momo/return`, `MOMO_IPN_URL` trỏ đến `/api/payments/momo/ipn` qua HTTPS công khai và `MOMO_RESULT_PAGE_URL` trỏ đến `/payment/result`. [Tài liệu MoMo](https://developers.momo.vn/v3/vi/docs/payment/api/result-handling/notification/)
- Khi MoMo được duyệt môi trường thật, đặt `NEXT_PUBLIC_MOMO_PAYMENT_HOST=payment.momo.vn` trong frontend rồi build lại.

### SePay và tài khoản nhận tiền

Trong biến môi trường của backend, đặt `SEPAY_BANK_CODE` (ví dụ `VietinBank`), `SEPAY_ACCOUNT_NUMBER` và `SEPAY_ACCOUNT_NAME` đúng với tài khoản đã liên kết trên SePay. Đặt `SEPAY_ENV=production` cho tài khoản thật hoặc `sandbox` cho Test mode.

Trong SePay → **Tích hợp WebHooks**, cấu hình mã thanh toán có tiền tố `FS` và 12 chữ số trong **Công ty → Cấu hình chung**. Tạo webhook nhận tiền vào cho tài khoản cửa hàng, chọn JSON và xác thực bằng API Key. Bật **Dùng để xác thực thanh toán** để SePay đọc verdict trong phản hồi. Để hai bộ lọc mã thanh toán tắt, nhằm vẫn nhận giao dịch cần đối soát thủ công. URL nhận là địa chỉ HTTPS công khai của backend nối với `/api/payments/sepay/webhook`; API Key phải giống `SEPAY_WEBHOOK_API_KEY` ở backend. Với VietinBank, website tự thêm `SEVQR` vào nội dung QR. Có thể đặt thêm `SEPAY_API_TOKEN` ở backend để tra cứu giao dịch khi đang chờ webhook hoặc khi chạy local. Khởi động lại backend sau khi sửa cấu hình. [Hướng dẫn tạo webhook](https://developer.sepay.vn/vi/sepay-webhooks/tao-webhook) · [Cấu hình mã thanh toán](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan)

Checkout dẫn khách tới trang QR theo mã đơn. Backend so khớp tài khoản, ngân hàng, mã đơn và số tiền, rồi cập nhật đơn và giao dịch trong cùng transaction. Nút “Tôi đã chuyển khoản” chỉ kiểm tra lại kết quả.

### Google Sign-In và địa chỉ

- Tạo OAuth Client kiểu Web application, thêm origin frontend vào **Authorized JavaScript origins**, đặt Web Client ID vào `GOOGLE_CLIENT_ID` trong backend rồi khởi động lại backend. Khi chạy F.Style tại cổng 3000, thêm cả `http://localhost` và `http://localhost:3000`. [Hướng dẫn Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- Danh sách giao hàng dùng `GET /api/addresses/locations` và `GET /api/addresses/locations/:provinceCode/wards`. Khi tạo hoặc đổi địa bàn, gửi `province_code` và `ward_code`. API lưu tên chuẩn dựa trên cả hai mã. Dữ liệu địa phương đi kèm backend lấy từ [Province Open API v2](https://provinces.open-api.vn/) theo [Quyết định 19/2025/QĐ-TTg](https://congbao.chinhphu.vn/tai-ve-van-ban-so-19-2025-qd-ttg-45430-57438?format=pdf).

Trang kết quả đọc trạng thái lưu ở backend. Giao dịch cũ vẫn giữ nguyên phương thức và lịch sử để cửa hàng đối soát.


## Nghiệp vụ quản trị: bán hàng, hàng hoàn và kiểm duyệt

- Tổng quan: doanh thu chỉ tính đơn hoàn thành và đã thu tiền; gồm phí giao hàng và đã trừ ưu đãi. Số bán theo sản phẩm/biến thể dùng 30 ngày gần nhất, loại đơn hủy, chờ giao và hoàn về. Đơn cũ chưa có completed_at dùng updated_at làm mốc gần đúng; không tự bịa lại lịch sử.
- Nhập hàng: cảnh báo tồn thấp (≤10) tách khỏi gợi ý nhập. Chỉ gợi ý nhập khi có lượt bán đã giao, tồn ≤10 hoặc đủ bán tối đa 14 ngày; lượng gợi ý bù nhu cầu 30 ngày. Shop cần xét thêm mùa vụ và thời gian nhà cung cấp giao hàng.
- Bán chậm: sản phẩm đã lên ít nhất 30 ngày, còn tồn, bán ≤3/30 ngày hoặc tồn đủ trên 90 ngày. Gợi ý xem lại ảnh, giá, combo/ưu đãi; không tự giảm giá hoặc tự tạo đơn nhập.
- Biến thể: tạo một bảng màu × size, sửa SKU/giá/tồn từng dòng rồi lưu. Mỗi màu có thể có ảnh riêng cho mọi size. Tối đa 200 tổ hợp/lượt; lỗi/trùng một dòng thì không ghi bất kỳ dòng nào.

### Khách từ chối nhận hoặc giao thất bại

1. Đơn đang giao: vào Chi tiết, ghi rõ lý do và biên bản liên hệ. Chỉ lý do khách từ chối nhận mới tính vào lịch sử từ chối của khách; lỗi vận chuyển/không liên hệ được không tự quy thành khách từ chối.
2. Liên hệ thống nhất giao lại hoặc yêu cầu hãng vận chuyển hoàn về shop. Chưa nhập lại tồn kho ở bước này.
3. Khi kiện về, kiểm từng dòng theo số đã gửi: nguyên vẹn + hỏng + thiếu phải khớp. Ghi biên bản và link bằng chứng nếu có. Chỉ nguyên vẹn nhập lại tồn bán được; hàng hỏng vào kho cách ly; hàng thiếu chỉ ghi nhận tổn thất. Transaction và trạng thái đơn ngăn nhận trùng.
4. Hàng hỏng/thiếu: mở biên bản để đối soát với bên vận chuyển/khách; ghi kết quả bồi thường, không tự kết luận lỗi hoặc trừ tiền của khách. Quản trị viên có thể chuyển hàng cách ly sang bán khi đã sửa/kiểm đạt, hoặc xuất hủy/thanh lý với lý do. Nhật ký lưu người xử lý, thời gian và số lượng.
5. COD chưa thu: đơn hoàn không ghi doanh thu. Đơn đã thanh toán: shop thực hiện hoàn qua ngân hàng/cổng thanh toán rồi quản trị viên nhập số tiền đầy đủ, mã giao dịch và xác nhận chứng từ. **Ghi nhận hoàn tiền trong admin không gọi API để tự chuyển tiền.** Giao dịch thu ban đầu được giữ; đơn hiển thị trạng thái đã hoàn tiền.

### Khách hàng và đánh giá

- Khách hàng: bấm số đơn để xem món đã mua, size/màu, số lượng, thanh toán và biên bản từng lần giao thất bại. Chi tiêu chỉ tính đơn đã giao/thu tiền. Không tự khóa người mua chỉ vì giao thất bại.
- Nhân viên được xem hồ sơ khách và xử lý vận hành; không được phân quyền/khóa, xử lý hàng cách ly hoặc ghi nhận hoàn tiền. Tài khoản quản trị được bảo vệ khỏi phân quyền/khóa qua các endpoint này, kể cả người gọi là admin khác. Đổi quyền/khóa thu hồi phiên đăng nhập cũ.
- Đánh giá: không có endpoint xóa. Từ cấm được che bằng dấu * khi trả nội dung công khai, áp dụng cả đánh giá cũ, giữ số sao và phần góp ý còn lại. Admin có thể thêm/tắt từ cấm bổ sung; nhân viên có thể che toàn bộ phần chữ vi phạm hoặc bỏ qua báo cáo. Nội dung gốc chỉ dùng đối chiếu trong quản trị.

Kiểm thử: npm test; npm run typecheck:test; npm run test:integration (dùng DATABASE replica set kiểm thử riêng). Tại frontend, đặt E2E_TEST_MATCH=OPS- rồi chạy npm run test:e2e để kiểm tra các luồng trên ở desktop và mobile bằng database tạm; không dùng dữ liệu bán hàng thật.


### Kích hoạt MoMo nhận tiền của cửa hàng

Cấu hình mẫu hoặc tài khoản sandbox không đại diện cho tài khoản nhận tiền thật của shop. Ảnh QR MoMo cá nhân không thay thế bộ mã tích hợp API. Đăng ký tại https://business.momo.vn, chọn thanh toán trên PC/Mobile website; hoàn tất hồ sơ và các bước kiểm thử/xác thực do MoMo yêu cầu.

Sau khi được cấp quyền Production: nhập Partner Code, Access Key, Secret Key riêng vào biến môi trường backend; dùng MOMO_ENDPOINT=https://payment.momo.vn/v2/gateway/api/create; cấu hình IPN HTTPS công khai /api/payments/momo/ipn và trang return /api/payments/momo/return trên backend. Cấu hình MOMO_RESULT_PAGE_URL đến /payment/result của website và NEXT_PUBLIC_MOMO_PAYMENT_HOST=payment.momo.vn trong frontend, build lại. Chỉ đặt MOMO_ENABLED=true khi cấu hình và tài khoản nhận tiền đã sẵn sàng. Giữ secret ở backend và không đưa vào Git hoặc trình duyệt.

MOMO_ENABLED=false ngăn tạo thanh toán mới và dùng lại URL cũ; không vô hiệu hóa xác minh IPN của các yêu cầu đã phát sinh. Đăng ký mới thường chỉ có quyền Test ban đầu; hoàn tất đăng ký không đồng nghĩa đã có quyền Production. Quy trình chính thức: https://developers.momo.vn/v3/vi/docs/payment/onboarding/merchant-profile/ và https://developers.momo.vn/v3/vi/docs/payment/onboarding/overall/.
