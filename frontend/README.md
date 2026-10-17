# UNIQLO-inspired frontend demo (Next.js App Router + TypeScript)

## Chạy dự án
1. Giải nén thư mục.
2. Chép các thư mục `app`, `components`, `data`, `types`, `public` vào thư mục `frontend` hiện tại (nếu đã có file cùng tên, hãy sao lưu trước).
3. Đảm bảo `package.json` có Next.js, React, React DOM và TypeScript như dự án hiện tại.
4. Mở terminal tại thư mục frontend và chạy `npm install`, sau đó `npm run dev`.
5. Mở `http://localhost:3000/` để xem trang chủ.

## Các trang
- `/` trang chủ
- `/cart` giỏ hàng
- `/checkout` thanh toán
- `/wishlist` yêu thích
- `/product/458824` chi tiết sản phẩm

CSS dùng chung nằm ở `app/globals.css`; CSS bổ sung theo trang nằm tại `app/home.css`, `app/cart/cart.css`, `app/checkout/checkout.css`, `app/wishlist/wishlist.css`, `app/product/[id]/product.css`.

Đây là giao diện demo, chưa kết nối API/backend. Hình ảnh sản phẩm trong `public/images` được tạo cho mục đích minh họa, không phải ảnh sản phẩm chính thức của UNIQLO. Một số ảnh banner trang chủ lấy từ URL Unsplash và cần kết nối Internet để tải.
