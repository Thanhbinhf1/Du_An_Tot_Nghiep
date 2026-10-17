# Tích hợp giao diện UNIQLO vào nhánh main mà không ghi đè globals/layout

## Cấu trúc
- `features/uniqlo/pages/`: code giao diện 5 trang (Home, Cart, Checkout, Wishlist, Product detail).
- `features/uniqlo/styles/`: CSS riêng cho từng trang.
- `integration/app/`: các file `page.tsx` mỏng để nối URL Next.js với component giao diện.
- `components/`, `data/`, `types/`, `public/images/`: dùng chung cho giao diện.

## Cách ghép vào dự án đang có
1. Sao chép thư mục `features/uniqlo/` vào thư mục gốc frontend của bạn.
2. Sao chép các thư mục `components/`, `data/`, `types/` và các ảnh trong `public/images/` nếu dự án chưa có các file này. Nếu đã có thì so sánh trước, không ghi đè file đang dùng.
3. Trong `integration/app/` có các route mẫu. Chép nội dung tương ứng vào các route hiện có trong `app/`:
   - `integration/app/page.tsx` → `app/page.tsx` (URL `/`)
   - `integration/app/cart/page.tsx` → `app/cart/page.tsx`
   - `integration/app/checkout/page.tsx` → `app/checkout/page.tsx`
   - `integration/app/wishlist/page.tsx` → `app/wishlist/page.tsx`
   - `integration/app/product/[id]/page.tsx` → `app/product/[id]/page.tsx`
   Các file route mẫu đều rất ngắn, chỉ import CSS tương ứng và render component trong `features/uniqlo/pages/`.
4. **Không thay `app/globals.css` và `app/layout.tsx` hiện có.** `layout.tsx` hiện tại cần tiếp tục import `./globals.css` và render Header/Footer theo cấu trúc dự án của bạn.
5. CSS trang được import từ route tương ứng; `globals.css` giữ vai trò style chung. Vì CSS trang hiện dùng class global, nếu main có class trùng tên thì kiểm tra `features/uniqlo/styles/*.css` và đổi tên selector để tránh xung đột.
6. Chạy `npm run dev`, sau đó kiểm tra `/`, `/cart`, `/checkout`, `/wishlist`, `/product/458824`.

## Lưu ý
- Các route mẫu trong `integration/app/` là file tham khảo để chép vào `app/`, không chép nguyên thư mục `integration` thành route chạy trực tiếp.
- Trang chi tiết hiện đang dùng sản phẩm mẫu đầu tiên; dữ liệu có thể nối với API/backend sau.
