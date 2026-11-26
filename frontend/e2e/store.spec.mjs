import { openProduct, fillBasic, matrix, image, saveProduct, publishExisting } from "./catalog-ui.mjs";
import { scenario, test, expect, state, api, token, signIn, emptyCart, add, order, db, client, oid, evidence, jwt, unique, mongoose } from "./helpers.mjs";
import { createHmac } from "node:crypto";

const productFile = ["frontend/app/product/[id]/page.tsx", "backend/src/controllers/productController.ts"];
const cartFile = ["frontend/app/cart/page.tsx", "backend/src/controllers/cartController.ts"];
const checkoutFile = ["frontend/components/checkout/BackendCheckout.tsx", "backend/src/controllers/orderController.ts", "backend/src/services/checkoutPricing.ts"];
const paymentFile = ["backend/src/controllers/paymentController.ts", "backend/src/services/vnpaySettlementService.ts", "backend/src/services/momoService.ts"];
const adminFile = ["frontend/app/admin/page.tsx", "backend/src/controllers/adminController.ts"];
const idFilter = (id) => ({ _id: oid(id) });
const customerOrders = () => db.collection("orders").countDocuments({ user_id: oid(state.users.customer.id) });

test("SSR giữ ô tìm kiếm cửa hàng ngoài màn quản trị sản phẩm", async ({ page, request }) => {
  const searchInput = /<input[^>]*id="header-search-query"/;
  expect(await (await request.get("/admin")).text()).not.toMatch(searchInput);
  expect(await (await request.get("/products")).text()).toMatch(searchInput);

  const hydrationErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|did not match/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await signIn(page, "admin");
  await page.goto("/admin#products");
  await page.getByRole("button", { name: "Tạo sản phẩm mới", exact: true }).click();
  await expect(page.getByRole("region", { name: "Workspace sản phẩm" })).toBeVisible();
  await expect(page.locator("#header-search-query")).toHaveCount(0);
  expect(hydrationErrors).toEqual([]);
});

scenario("AUTH-001", "Đăng ký qua form và kiểm tra tài khoản trong DB", "Mở đăng ký; nhập email mới/password/confirmation; đồng ý điều khoản; submit; đọc User", "Chuyển profile; User role customer, mật khẩu hash, không lộ password trong response", ["frontend/app/dang-ky/page.tsx", "backend/src/services/authService.ts"], async ({ page }) => {
  const email = `${unique("register")}@e2e.invalid`;
  await page.goto("/dang-ky"); await page.locator('[name="fullName"]').fill("QA Register");
  await page.locator('[name="emailOrPhone"]').fill(email); await page.locator('[name="password"]').fill(state.password);
  await page.locator('[name="confirmPassword"]').fill(state.password); await page.getByRole("checkbox").check();
  const registration = page.waitForResponse((response) => response.url().endsWith("/auth/register") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng ký tài khoản", exact: true }).click(); expect((await (await registration).json()).data.password).toBeUndefined(); await expect(page).toHaveURL(/\/profile/);
  const saved = await db.collection("users").findOne({ email }); expect(saved.role).toBe("customer"); expect(saved.password).not.toBe(state.password); expect(saved.password).toMatch(/^\$2/);
  await evidence("registration", "users", { email }, { password: 0 });
  expect((await api("/auth/register", { method: "POST", data: { name: "Duplicate", email, password: state.password } })).status).toBe(409);
});

scenario("AUTH-002", "Đăng nhập đúng và đăng xuất qua UI", "Nhập tài khoản QA customer; submit; mở profile; đăng xuất; mở cart", "Profile sau login; sau logout cart yêu cầu đăng nhập", ["frontend/app/dang-nhap/page.tsx", "frontend/app/profile/page.tsx"], async ({ page }) => {
  await page.goto("/dang-nhap"); await page.locator('[name="account"]').fill(state.users.customer.email); await page.locator('[name="password"]').fill(state.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page).toHaveURL(/\/profile/);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click(); await page.goto("/cart");
  await expect(page.getByText("Vui lòng đăng nhập để xem giỏ hàng.", { exact: true })).toBeVisible();
});

scenario("AUTH-003", "Đăng nhập sai mật khẩu", "Nhập đúng email, sai password; submit; kiểm tra lỗi và storage", "Không đăng nhập; thông báo lỗi; không có token", ["frontend/app/dang-nhap/page.tsx", "backend/src/services/authService.ts"], async ({ page }) => {
  await page.goto("/dang-nhap"); await page.locator('[name="account"]').fill(state.users.customer.email); await page.locator('[name="password"]').fill("WrongPassword123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click(); await expect(page.locator("form").filter({ has: page.locator('[name="account"]') }).getByRole("alert")).toContainText(/không|sai/i);
  expect(await page.evaluate(() => localStorage.getItem("bapd-demo-token"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("bapd-demo-token"))).toBeNull();
});

scenario("AUTH-004", "Token hết hạn không đọc được đơn hàng", "Tạo JWT expired bằng secret test; vào orders; kiểm tra API401", "UI hiển thị lỗi, không hiển thị đơn; API401", ["backend/src/middlewares/authMiddleware.ts", "frontend/app/orders/page.tsx"], async ({ page }) => {
  const expired = jwt.sign({ id: state.users.customer.id, role: "customer", sessionVersion: 0 }, state.jwtSecret, { expiresIn: -1 });
  await signIn(page, "customer", expired); const response = page.waitForResponse((response) => response.url().endsWith("/orders/my"));
  await page.goto("/orders"); expect((await response).status()).toBe(401); await expect(page.getByRole("alert").first()).toBeVisible();
  expect((await api("/orders/my", { token: expired })).status).toBe(401);
});

scenario("AUTH-005", "Khách chưa đăng nhập truy cập cart/checkout/admin", "Mở cart và checkout chưa login; mở admin", "Cart/checkout yêu cầu login; admin chuyển đăng nhập; API ghi từ chối401", ["frontend/app/cart/page.tsx", "frontend/components/checkout/BackendCheckout.tsx", "frontend/app/admin/page.tsx"], async ({ page }) => {
  for (const url of ["/cart", "/checkout"]) { await page.goto(url); await expect(page.getByText(/Vui lòng đăng nhập/).first()).toBeVisible(); }
  await page.goto("/admin"); await expect(page).toHaveURL(/dang-nhap/); expect((await api("/admin/orders")).status).toBe(401);
});

scenario("AUTH-006", "Quyền Admin Staff Customer được kiểm tra ở server và UI", "Customer gọi admin; staff đọc orders nhưng tạo product bị chặn; admin được phép; mở admin bằng Staff", "Customer403; Staff đọc200/ghi catalog403; Admin session200; Staff không thấy tab catalog", ["backend/src/middlewares/adminMiddleware.ts", "frontend/app/admin/page.tsx"], async ({ page }) => {
  expect((await api("/admin/orders", { token: await token() })).status).toBe(403);
  expect((await api("/admin/orders", { token: await token("staff") })).status).toBe(200);
  expect((await api("/products", { token: await token("staff"), method: "POST", data: {} })).status).toBe(403);
  expect((await api("/admin/session", { token: await token("admin") })).status).toBe(200);
  await signIn(page, "staff"); await page.goto("/admin"); await expect(page.getByRole("button", { name: "Quản lý đơn hàng", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sản phẩm & Biến thể", exact: true })).toHaveCount(0);
});

scenario("PRD-001", "Danh mục và danh sách sản phẩm", "Mở Nam và /products; chờ catalog; đọc cards", "Có hàng QA đúng danh mục, không hiển thị sản phẩm em bé trong Nam", productFile, async ({ page }) => {
  await page.goto("/nam"); await expect(page.locator(".product-card").first()).toBeVisible(); await expect(page.locator(".product-card").filter({ hasText: "QA Em Bé" })).toHaveCount(0);
  await page.goto("/products"); await expect(page.locator(".product-card").first()).toBeVisible(); expect(await page.locator(".product-card").count()).toBeGreaterThan(0);
});

scenario("PRD-002", "Tìm kiếm có kết quả và không có kết quả", "Tìm QA Áo 01; sau đó tìm chuỗi không có", "Đúng sản phẩm khớp; empty state cho từ khóa không tồn tại", ["frontend/components/product/ProductListing.tsx"], async ({ page }) => {
  await page.goto("/products"); const search = page.getByPlaceholder("Bạn đang tìm áo thun, sơ mi, váy...?");
  await search.fill("QA Áo 01"); await search.press("Enter"); await expect(page.locator(".product-card")).toHaveCount(1); await expect(page.locator(".product-card")).toContainText("QA Áo 01");
  await search.fill("no-match-qa-9999"); await search.press("Enter"); await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chưa tìm thấy sản phẩm phù hợp", exact: true })).toBeVisible();
});

scenario("PRD-003", "Lọc màu size thương hiệu và trạng thái sale", "Mở products; chọn size M, màu Trắng, QA Brand; chọn sale", "Cards phù hợp filter; sale chỉ còn QA Áo 01", ["frontend/components/product/ProductListing.tsx"], async ({ page }) => {
  await page.goto("/products"); await expect(page.locator(".product-card").first()).toBeVisible();
  const filter = page.getByRole("button", { name: /^Bộ lọc/ });
  await filter.click();
  const drawer = page.getByRole("dialog", { name: "Bộ lọc sản phẩm" });
  await expect(drawer).toBeVisible();
  await page.getByRole("combobox", { name: /^Kích cỡ/ }).selectOption("M"); await page.getByRole("combobox", { name: /^Màu sắc/ }).selectOption("Trắng");
  await page.getByRole("combobox", { name: /^Thương hiệu/ }).selectOption("QA Brand"); await page.getByRole("combobox", { name: /^Trạng thái/ }).selectOption("sale");
  await drawer.getByRole("button", { name: "Xem 1 sản phẩm", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(filter).toBeFocused();
  await expect(page.locator(".product-card")).toHaveCount(1); await expect(page.locator(".product-card")).toContainText("QA Áo 01");
});

scenario("PRD-004", "Sắp xếp giá hàng còn kho và phân trang", "Tạo fixture chưa mở bán để kiểm tra loại khỏi filter; lọc còn hàng; chọn giá tăng; sang trang2 rồi quay1", "Card còn hàng rẻ nhất đầu; sản phẩm chưa mở bán bị loại; trang2 khác; quay lại card ban đầu", ["frontend/components/product/ProductListing.tsx"], async ({ page }) => {
  await createProduct(unique("QA Unopened"));
  await page.goto("/products"); await expect(page.locator(".product-card").first()).toBeVisible();
  await page.getByRole("button", { name: /^Bộ lọc/ }).click(); await page.getByRole("combobox", { name: /^Trạng thái/ }).selectOption("instock");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Bộ lọc sản phẩm" })).toBeHidden();
  await expect(page.locator(".product-card-out")).toHaveCount(0);
  await page.getByRole("combobox", { name: /^Sắp xếp/ }).selectOption("price-asc");
  await expect(page.locator(".product-card").first()).toContainText("QA Áo 01"); const first = await page.locator(".product-card").first().innerText();
  const pagination = page.getByRole("navigation", { name: "Phân trang danh sách sản phẩm" });
  const pageTwo = pagination.getByRole("button", { name: "2", exact: true });
  await pageTwo.click();
  await expect(page).toHaveURL(/sort=price-asc&page=2/);
  await expect(pageTwo).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".product-card").first()).not.toHaveText(first);
  await page.reload();
  await expect(pageTwo).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page.locator(".product-card").first()).toContainText("QA Áo 01");
  await page.goForward();
  await expect(pageTwo).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "← Trang trước", exact: true }).click(); await expect(page.locator(".product-card").first()).toContainText("QA Áo 01");
});

scenario("PRD-005", "Chọn màu size và biến thể hết hàng", "Mở detail; chọn Trắng/M rồi Đen; kiểm tra size L; gọi API add variant hết kho", "Màu/SKU đổi; L bị vô hiệu và không mua được; API400", productFile, async ({ page }) => {
  await signIn(page); await page.goto(`/product/${state.products[0].id}`); await expect(page.getByRole("heading", { name: "QA Áo 01", exact: true })).toBeVisible();
  const info = page.getByRole("region", { name: "Thông tin sản phẩm" });
  await info.getByRole("button", { name: "Trắng", exact: true }).click(); await expect(info.getByRole("button", { name: "Trắng", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".product-info")).toContainText("QA-0-M-TRANG");
  await info.getByRole("button", { name: "Đen", exact: true }).click();
  await expect(info.getByRole("button", { name: "L (hết hàng)", exact: true })).toBeDisabled();
  expect((await api("/cart/items", { token: await token(), method: "POST", data: { product_variant_id: state.products[0].variants[2].id, quantity: 1 } })).status).toBe(400);
});

scenario("PRD-006", "Sản phẩm không tồn tại và ID sai", "Mở detail ObjectId không có và ID sai; gọi API", "UI báo không tải được; API404/400, không crash500", productFile, async ({ page }) => {
  const missing = "000000000000000000000001";
  await page.goto(`/product/${missing}`); await expect(page.getByText("Không thể tải dữ liệu sản phẩm", { exact: true })).toBeVisible();
  expect((await api(`/products/${missing}`)).status).toBe(404); expect((await api("/products/not-an-id")).status).toBe(400);
});

scenario("CART-001", "Thêm lặp cùng biến thể và thêm màu khác qua UI", "Mở sản phẩm; thêm Đen 2 lần; đổi Trắng thêm1; mở giỏ; refresh; đọc DB", "Hai dòng khác màu, quantity2/1, tổng260.000; refresh giữ giỏ", cartFile, async ({ page }) => {
  await emptyCart(); await signIn(page); await page.goto(`/product/${state.products[0].id}`);
  const button = page.getByRole("button", { name: "Thêm vào giỏ hàng", exact: true });
  await button.click(); await expect(page.getByText("Đã thêm vào giỏ hàng.", { exact: false })).toBeVisible(); await button.click();
  await expect(button).toBeEnabled(); await page.getByRole("region", { name: "Thông tin sản phẩm" }).getByRole("button", { name: "Trắng", exact: true }).click(); await button.click(); await expect(button).toBeEnabled();
  await page.goto("/cart"); await expect(page.getByRole("heading", { name: "Giỏ hàng (3 sản phẩm)" })).toBeVisible(); await page.reload(); await expect(page.getByRole("heading", { name: "Giỏ hàng (3 sản phẩm)" })).toBeVisible();
  const cart = await db.collection("carts").findOne({ user_id: oid(state.users.customer.id) }); const lines = await evidence("cart-colors", "cartdetails", { cart_id: cart._id });
  expect(lines).toHaveLength(2); expect(lines.map((line) => line.quantity).sort()).toEqual([1, 2]);
  expect((await api("/cart", { token: await token() })).body.data.total_price).toBe(260000);
});

scenario("CART-002", "Tăng giảm và xóa dòng giỏ hàng", "Seed một dòng quantity2 qua API; mở cart; tăng lên3, giảm2; xóa; đọc DB", "UI/DB quantity đúng; xóa không còn dòng", cartFile, async ({ page }) => {
  await emptyCart(); await add(0, 2); await signIn(page); await page.goto("/cart");
  await page.getByRole("button", { name: "Tăng số lượng", exact: true }).click(); await expect(page.getByRole("heading", { name: "Giỏ hàng (3 sản phẩm)" })).toBeVisible();
  await page.getByRole("button", { name: "Giảm số lượng", exact: true }).click(); await expect(page.getByRole("heading", { name: "Giỏ hàng (2 sản phẩm)" })).toBeVisible();
  await page.locator(".cart-remove-btn").click(); await expect(page.getByRole("heading", { name: "Giỏ hàng (0 sản phẩm)" })).toBeVisible();
  const cart = await db.collection("carts").findOne({ user_id: oid(state.users.customer.id) }); expect(await db.collection("cartdetails").countDocuments({ cart_id: cart._id })).toBe(0);
  await evidence("cart-empty", "cartdetails", { cart_id: cart._id });
});

scenario("CART-003", "Giới hạn số lượng và ownership", "Gửi quantity0/-1/1.5/100000; customer khác sửa dòng", "Input sai400; người khác404; DB quantity gốc giữ nguyên", cartFile, async () => {
  await emptyCart(); const line = await add();
  for (const quantity of [0, -1, 1.5, 100000]) expect((await api(`/cart/items/${line._id}`, { token: await token(), method: "PATCH", data: { quantity } })).status).toBe(400);
  expect((await api(`/cart/items/${line._id}`, { token: await token("other"), method: "PATCH", data: { quantity: 2 } })).status).toBe(404);
  expect((await db.collection("cartdetails").findOne(idFilter(line._id))).quantity).toBe(1);
});

scenario("CART-004", "Hai request thêm đồng thời trên Mongo thật", "Giỏ trống; gửi 2 POST cùng variant song song; đọc DB", "Không duplicate dòng, quantity2", cartFile, async () => {
  await emptyCart(); await Promise.all([add(), add()]); const cart = await db.collection("carts").findOne({ user_id: oid(state.users.customer.id) });
  const lines = await evidence("cart-concurrency", "cartdetails", { cart_id: cart._id }); expect(lines).toHaveLength(1); expect(lines[0].quantity).toBe(2);
});

scenario("UI-SEARCH", "Gợi ý tìm kiếm theo tên từ API", "Gõ từ khóa có kết quả rồi đổi sang từ khóa không có; thử Esc và Enter", "Hiện đúng gợi ý, đóng khi Esc và Enter mở trang kết quả", ["frontend/components/layout/SearchSuggestions.tsx"], async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator(".product-card").first()).toBeVisible();
  const toggle = page.getByRole("button", { name: "Mở tìm kiếm", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const query = page.locator("#header-search-query");
  await query.fill("QA Áo 01");
  const suggestions = page.locator("#header-search-results");
  await expect(suggestions.getByRole("link", { name: "QA Áo 01", exact: true })).toBeVisible();
  await query.fill("no-match-qa-9999");
  await expect(suggestions.getByRole("link", { name: "QA Áo 01", exact: true })).toHaveCount(0);
  await expect(suggestions.getByRole("status")).toContainText("Chưa tìm thấy");
  await query.press("Escape");
  await expect(suggestions).toHaveCount(0);
  if (await toggle.isVisible()) await toggle.click();
  await query.fill("QA Áo 01");
  await query.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
});

scenario("CHK-008", "Hai khách mua cùng SKU cuối", "Đặt tồn thử còn 1; hai giỏ giữ cùng SKU; gửi hai checkout cùng lúc; kiểm DB", "Một đơn tạo thành công, yêu cầu còn lại 409, tồn bằng 0, đúng một lượt mã và một lịch sử", checkoutFile, async () => {
  const variants = db.collection("productvariants");
  const variantId = state.products[29].variants[0].id;
  const skuFilter = idFilter(variantId);
  const stockBefore = await variants.findOne(skuFilter);
  const buyerRoles = ["customer", "other"];
  const coupon = await db.collection("coupons").findOne({ code: "QA10" });
  const orderScope = { user_id: { $in: buyerRoles.map((role) => oid(state.users[role].id)) } };
  const countBefore = await db.collection("orders").countDocuments(orderScope);
  await variants.updateOne(skuFilter, { $set: { stock_quantity: 1 }, $inc: { __v: 1 } });

  try {
    const buyers = await Promise.all(buyerRoles.map(async (role) => {
      const access = await token(role);
      expect((await api("/cart", { token: access, method: "DELETE" })).status).toBe(200);
      const line = await api("/cart/items", { token: access, method: "POST", data: { product_variant_id: variantId, quantity: 1 } });
      expect(line.status).toBe(201);
      const data = { address_id: state.addresses[role], coupon_code: "QA10" };
      const quote = await api("/orders/quote", { token: access, method: "POST", data });
      expect(quote.status).toBe(200);
      return { access, lineId: line.body.data._id, data: { ...data, payment_method: "COD", expected_total: quote.body.data.final_amount, expected_cart_snapshot: quote.body.data.cart_snapshot } };
    }));
    const results = await Promise.all(buyers.map(({ access, data }) => api("/orders", { token: access, method: "POST", data })));
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winner = results.find(({ status }) => status === 201);
    const loserIndex = results.findIndex(({ status }) => status === 409);
    const orderId = oid(winner.body.data.order_id);
    expect(await db.collection("orders").countDocuments(orderScope)).toBe(countBefore + 1);
    expect(await db.collection("orderdetails").countDocuments({ order_id: orderId, product_variant_id: oid(variantId), quantity: 1 })).toBe(1);
    expect(await db.collection("orderstatushistories").countDocuments({ order_id: orderId, status: "pending" })).toBe(1);
    expect((await variants.findOne(skuFilter)).stock_quantity).toBe(0);
    expect((await db.collection("coupons").findOne({ code: "QA10" })).used_count).toBe(coupon.used_count + 1);
    expect(await db.collection("cartdetails").countDocuments(idFilter(buyers[loserIndex].lineId))).toBe(1);
    await evidence("last-sku", "productvariants", skuFilter);
  } finally {
    await variants.updateOne(skuFilter, { $set: { stock_quantity: stockBefore.stock_quantity }, $inc: { __v: 1 } });
    await Promise.all(buyerRoles.map(async (role) => api("/cart", { token: await token(role), method: "DELETE" })));
  }
});

scenario("UI-CART-DRAWER", "Giỏ nhanh lấy và xóa dòng từ MongoDB", "Mở nút giỏ, kiểm SKU và tổng, xóa, đối chiếu API, đóng bằng Esc", "Giỏ và badge về 0, bản ghi giỏ được xóa, nút giỏ nhận lại focus", ["frontend/components/cart/CartDrawer.tsx"], async ({ page }) => {
  await emptyCart(); const line = await add(); await signIn(page); await page.goto("/products");
  const toggle = page.getByRole("button", { name: /^Giỏ hàng/ });
  await expect(toggle).toHaveAccessibleName("Giỏ hàng, 1 sản phẩm");
  await toggle.click();
  const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
  await expect(drawer).toContainText("QA-0-M-DEN");
  await expect(drawer.getByRole("link", { name: "Thanh toán" })).toHaveAttribute("href", "/checkout");
  await drawer.getByRole("button", { name: /^Xóa / }).click();
  await expect(drawer).toContainText("Giỏ hàng của bạn đang trống.");
  expect(await db.collection("cartdetails").findOne(idFilter(line._id))).toBeNull();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(toggle).toHaveAccessibleName("Giỏ hàng");
  await expect(toggle).toBeFocused();
});

scenario("RSP-TABLET", "Tìm kiếm và giỏ nhanh trên tablet", "Mở 820px; mở gợi ý tìm kiếm rồi giỏ guest; kiểm rộng trang và hộp thoại", "Gợi ý và hộp thoại trong viewport, guest có đường dẫn đăng nhập", ["frontend/app/storefront.css", "frontend/components/layout/Header.tsx"], async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/products");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Mở tìm kiếm", exact: true }).click();
  const query = page.locator("#header-search-query");
  await expect(query).toBeFocused();
  await query.fill("QA Áo 01");
  await expect(page.locator("#header-search-results").getByRole("link", { name: "QA Áo 01", exact: true })).toBeVisible();
  await query.press("Escape");
  await page.getByRole("button", { name: "Giỏ hàng", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
  await expect(drawer.getByRole("link", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(await drawer.evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

scenario("CHK-001", "Chọn địa chỉ và áp coupon qua UI", "Giỏ một áo80.000; mở checkout; chọn địa chỉQA; áp QA10", "Có địa chỉ, quote giảm8.000 +phí35.000 =107.000", checkoutFile, async ({ page }) => {
  await emptyCart(); await add(); await signIn(page); await page.goto("/checkout");
  await expect(page.locator('[name="shipping_address_id"]')).toBeChecked(); await page.getByLabel("Mã giảm giá", { exact: true }).fill("QA10"); await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(page.locator(".summary-row.total")).toContainText(/107[.,]000/); await expect(page.getByText(/Giảm giá khuyến mãi/)).toBeVisible();
});

scenario("CHK-002", "Đặt COD và nhấn nhanh nhiều lần", "Giỏ1; ghi stock/ordercount; mở checkout; dblclick submit; đọc order/detail/cart/stock", "Chỉ tạo1 đơn, trừ kho1, cart trống, snapshot đúng", checkoutFile, async ({ page }) => {
  await emptyCart(); await add(); const before = await customerOrders(); const stock = await db.collection("productvariants").findOne(idFilter(state.products[0].variants[0].id));
  await signIn(page); await page.goto("/checkout"); const submit = page.getByRole("button", { name: /Đặt hàng|Xác nhận đặt|Hoàn tất/ }).last(); await expect(submit).toBeEnabled();
  await submit.dblclick(); await expect(page.getByText(/Đặt hàng thành công|Đặt đơn thành công/i).first()).toBeVisible();
  expect(await customerOrders()).toBe(before + 1); const current = await db.collection("productvariants").findOne({ _id: stock._id }); expect(current.stock_quantity).toBe(stock.stock_quantity - 1);
  expect((await api("/cart", { token: await token() })).body.data.total_quantity).toBe(0);
  const saved = await db.collection("orders").find({ user_id: oid(state.users.customer.id) }).sort({ created_at: -1 }).limit(1).next(); expect(saved.final_amount).toBe(115000); expect(saved.payment_method).toBe("COD");
  await evidence("cod-order", "orders", idFilter(String(saved._id))); const details = await evidence("cod-details", "orderdetails", { order_id: saved._id }); expect(details[0].price_at_buy).toBe(80000);
});

scenario("CHK-003", "Coupon sai, địa chỉ thiếu/sai ownership, total thay đổi", "Gửi quote coupon sai; tạo đơn thiếu address/địa chỉ người khác/expected_total sai", "400/404/409 phù hợp, không tạo đơn, cart còn nguyên", checkoutFile, async () => {
  await emptyCart(); await add(); const before = await customerOrders(); const access = await token();
  expect((await api("/orders/quote", { token: access, method: "POST", data: { coupon_code: "NOTREAL" } })).status).toBe(400);
  for (const [address_id, expected_total, status] of [[undefined, undefined, 400], [state.addresses.other, undefined, 404], [state.addresses.customer, 1, 409]]) {
    expect((await api("/orders", { token: access, method: "POST", data: { address_id, expected_total, payment_method: "COD" } })).status).toBe(status);
  }
  expect(await customerOrders()).toBe(before); expect((await api("/cart", { token: access })).body.data.total_quantity).toBe(1);
});

scenario("CHK-004", "Tồn kho thay đổi sau khi thêm vào giỏ", "Thêm1 hàng vào giỏ; Admin đặt stock0 qua API version; checkout; khôi phục stock test", "Checkout409, không đơn mới, coupon/cart không mất, stock0", checkoutFile, async () => {
  await emptyCart(); await add(2); const before = await customerOrders(); const variantId = state.products[2].variants[0].id; const stock = await db.collection("productvariants").findOne(idFilter(variantId));
  const patch = (qty, version) => api(`/admin/inventory/${variantId}`, { token: tokensAdmin, method: "PATCH", data: { stock_quantity: qty, expected_version: version } });
  const tokensAdmin = await token("admin"); expect((await patch(0, stock.__v ?? 0)).status).toBe(200);
  try {
    expect((await api("/orders", { token: await token(), method: "POST", data: { address_id: state.addresses.customer, payment_method: "COD" } })).status).toBe(409);
    expect(await customerOrders()).toBe(before); expect((await api("/cart", { token: await token() })).body.data.total_quantity).toBe(1);
    await evidence("insufficient-stock", "productvariants", idFilter(variantId));
  } finally { const latest = await db.collection("productvariants").findOne(idFilter(variantId)); expect((await patch(stock.stock_quantity, latest.__v)).status).toBe(200); }
});

scenario("CHK-005", "Phí giao và phạm vi hỏa tốc", "Báo giá địa chỉ trong/ngoài vùng, đổi địa chỉ trên checkout, đạt ngưỡng miễn phí", "35k Standard, 45k Express trong vùng, ngoài vùng chỉ còn Standard, giảm giá đúng", checkoutFile, async ({ page }) => {
  await emptyCart(); await add(1); const access = await token();
  const admin = await token("admin");
  const ward = (await api("/addresses/locations/1/wards")).body.data[0];
  const configure = (accessToken, code) => api("/admin/settings", { token: accessToken, method: "PUT", data: { express_shipping_province_code: code, express_shipping_ward_codes: [ward.code] } });
  expect((await configure(await token("staff"), 79)).status).toBe(403);
  expect((await configure(admin, 99999)).status).toBe(400);
  expect((await configure(admin, 1)).status).toBe(200);
  const addresses = db.collection("addresses");
  const far = await addresses.insertOne({
    user_id: idFilter(state.users.customer.id)._id, receiver_name: "QA Xa", receiver_phone: "0900000000",
    province: "Thành phố Hồ Chí Minh", province_code: 79, ward: "Phường Test", address_detail: "Địa chỉ kiểm thử", is_default: false,
  });
  try {
    for (const [shipping_method, fee] of [["Standard", 35000], ["Express", 45000]]) {
      expect((await api("/orders/quote", { token: access, method: "POST", data: { shipping_method, address_id: state.addresses.customer } })).body.data.shipping_fee).toBe(fee);
    }
    const outside = { shipping_method: "Express", address_id: String(far.insertedId) };
    expect((await api("/orders/quote", { token: access, method: "POST", data: outside })).status).toBe(409);
    expect((await api("/orders", { token: access, method: "POST", data: { ...outside, payment_method: "COD" } })).status).toBe(409);
    expect((await api("/orders/quote", { token: access, method: "POST", data: { ...outside, address_id: state.addresses.other } })).status).toBe(404);

    await signIn(page); await page.goto("/checkout");
    await page.getByRole("radio", { name: /Giao hàng Hỏa tốc/ }).check();
    await page.getByRole("radio", { name: /QA Xa/ }).check();
    await expect(page.getByRole("radio", { name: /Giao hàng Tiêu chuẩn/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Giao hàng Hỏa tốc/ })).toHaveCount(0);
  } finally { await addresses.deleteOne({ _id: far.insertedId }); }
  await add(1, 4); const quote = await api("/orders/quote", { token: access, method: "POST", data: { coupon_code: "QA10" } }); expect(quote.body.data.shipping_fee).toBe(0); expect(quote.body.data.discount_amount).toBe(50500);
});

scenario("CHK-006", "Đổi SKU cùng giá sau khi checkout đã hiện báo giá", "Mở checkout với áo đen; đổi sang áo trắng cùng giá ở phiên khác; đặt đơn; cập nhật giỏ và đặt lại", "Request cũ trả 409, giữ số tồn và số đơn; giỏ mới hiển thị đúng áo trắng và chỉ tạo đơn sau khi khách bấm lại", checkoutFile, async ({ page }) => {
  await emptyCart();
  await add(1, 1, 0);
  const before = await customerOrders();
  const [black, white] = state.products[1].variants;
  const stock = async (id) => (await db.collection("productvariants").findOne(idFilter(id))).stock_quantity;
  const stocksBefore = [await stock(black.id), await stock(white.id)];
  await signIn(page);
  await page.goto("/checkout");
  const submit = page.locator(".place-order-button");
  const summary = page.locator(".summary-column");
  await expect(submit).toBeEnabled();
  await expect(summary).toContainText("Màu: Đen");
  await page.getByPlaceholder(/Ghi chú về thời gian/).fill("Giao trong giờ hành chính");

  await emptyCart();
  await add(1, 1, 1);
  const rejected = page.waitForResponse((response) => response.url().endsWith("/api/orders") && response.request().method() === "POST");
  await submit.click();
  expect((await rejected).status()).toBe(409);
  await expect(submit).toBeDisabled();
  expect(await customerOrders()).toBe(before);
  expect([await stock(black.id), await stock(white.id)]).toEqual(stocksBefore);

  await page.getByRole("button", { name: "Cập nhật giỏ hàng" }).click();
  await expect(summary).toContainText("Màu: Trắng");
  await expect(page.getByPlaceholder(/Ghi chú về thời gian/)).toHaveValue("Giao trong giờ hành chính");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("heading", { name: "Đặt hàng thành công!" })).toBeVisible();
  expect(await customerOrders()).toBe(before + 1);
  expect([await stock(black.id), await stock(white.id)]).toEqual([stocksBefore[0], stocksBefore[1] - 1]);
  const saved = await db.collection("orders").find({ user_id: oid(state.users.customer.id) }).sort({ created_at: -1 }).limit(1).next();
  const details = await db.collection("orderdetails").find({ order_id: saved._id }).toArray();
  expect(details.map((line) => String(line.product_variant_id))).toEqual([white.id]);
});

scenario("CHK-007", "Gửi lại cùng checkout không tạo thêm đơn", "Chốt báo giá có coupon; gửi hai POST cùng lúc; gửi lại lần ba; đọc MongoDB", "Một Order, một lịch sử mới, một lượt coupon, tồn giảm một", checkoutFile, async () => {
  await emptyCart();
  await add();
  const access = await token();
  const variant = idFilter(state.products[0].variants[0].id);
  const coupon = { code: "QA10" };
  const beforeStock = (await db.collection("productvariants").findOne(variant)).stock_quantity;
  const beforeCoupon = (await db.collection("coupons").findOne(coupon)).used_count;
  const quote = await api("/orders/quote", { token: access, method: "POST", data: { coupon_code: coupon.code, address_id: state.addresses.customer } });
  expect(quote.status).toBe(200);
  const data = {
    address_id: state.addresses.customer, payment_method: "COD", coupon_code: coupon.code,
    expected_cart_snapshot: quote.body.data.cart_snapshot, expected_total: quote.body.data.final_amount,
  };
  const place = () => api("/orders", { token: access, method: "POST", data });
  const [first, second] = await Promise.all([place(), place()]);
  expect([first.status, second.status].sort()).toEqual([200, 201]);
  const replay = await place();
  const id = first.body.data.order_id;
  expect(second.body.data.order_id).toBe(id);
  expect(replay.status).toBe(200);
  expect(replay.body.data.order_id).toBe(id);
  expect(await db.collection("orders").countDocuments({ user_id: oid(state.users.customer.id), checkout_snapshot: data.expected_cart_snapshot })).toBe(1);
  expect(await db.collection("orderstatushistories").countDocuments({ order_id: oid(id), status: "pending" })).toBe(1);
  expect((await db.collection("productvariants").findOne(variant)).stock_quantity).toBe(beforeStock - 1);
  expect((await db.collection("coupons").findOne(coupon)).used_count).toBe(beforeCoupon + 1);
  expect((await api("/cart", { token: access })).body.data.items).toHaveLength(0);
});

scenario("PAY-001", "Hoàn thành COD đồng bộ đã thanh toán", "Tạo COD; Admin chuyển processing/shipping/completed; xem đơn customer và DB", "Order completed/payment success cùng nhau; lịch sử đủ", paymentFile, async ({ page }) => {
  const created = await order(); const admin = await token("admin");
  for (const status of ["processing", "shipping", "completed"]) expect((await api(`/admin/orders/${created.order_id}/status`, { token: admin, method: "PATCH", data: { status } })).status).toBe(200);
  const [saved] = await evidence("completed-cod", "orders", idFilter(created.order_id)); expect(saved.order_status).toBe("completed"); expect(saved.payment_status).toBe("success");
  const history = await db.collection("orderstatushistories").find({ order_id: oid(created.order_id) }).sort({ created_at: 1, _id: 1 }).toArray();
  expect(history.map(({ status }) => status)).toEqual(["pending", "processing", "shipping", "completed"]);
  await signIn(page); await page.goto(`/orders/${created.order_id}`); await expect(page.getByText("Đã thanh toán", { exact: true }).first()).toBeVisible();
});

scenario("PAY-002", "Bank Transfer tạo yêu cầu và Admin xác nhận", "Tạo đơn BankTransfer; tạo payment2 lần; Customer confirm; Admin confirm; đọc DB", "Reuse một payment; Customer403; Admin xác nhận success; đơn success", paymentFile, async ({ page }) => {
  const created = await order("BankTransfer"); const access = await token();
  const first = await api("/payments/bank-transfer", { token: access, method: "POST", data: { order_id: created.order_id } }); expect(first.status).toBe(200);
  const second = await api("/payments/bank-transfer", { token: access, method: "POST", data: { order_id: created.order_id } }); expect(second.body.data.payment_id).toBe(first.body.data.payment_id);
  const path = `/payments/${first.body.data.payment_id}/confirm`, data = { transaction_id: unique("QA-BANK"), amount: first.body.data.amount };
  expect((await api(path, { token: access, method: "PATCH", data })).status).toBe(403);
  expect((await api(path, { token: await token("admin"), method: "PATCH", data: { ...data, amount: data.amount - 1 } })).status).toBe(409);
  expect((await api(path, { token: await token("admin"), method: "PATCH", data })).status).toBe(200);
  const [payment] = await evidence("bank-payment", "payments", idFilter(first.body.data.payment_id)); expect(payment.status).toBe("success");
  expect((await db.collection("orders").findOne(idFilter(created.order_id))).payment_status).toBe("success");
  await signIn(page); await page.goto(`/orders/${created.order_id}`); await expect(page.getByText("Đã thanh toán", { exact: true }).first()).toBeVisible();
});

function signedVNPay(data) {
  const params = new URLSearchParams(); for (const key of Object.keys(data).sort()) params.append(key, data[key]);
  params.set("vnp_SecureHash", createHmac("sha512", state.vnpSecret).update(params.toString()).digest("hex")); return params;
}
async function vnpayOrder() {
  // VNPay is retired for new checkout. Seed a historical transaction so callbacks
  // for existing customers stay covered without bypassing the new API policy.
  const orderId = new mongoose.Types.ObjectId(), paymentId = new mongoose.Types.ObjectId();
  const txnRef = String(paymentId), now = new Date();
  await db.collection("orders").insertOne({ _id: orderId, user_id: oid(state.users.customer.id), total_product_amount: 80000, discount_amount: 0, shipping_fee: 35000, final_amount: 115000, receiver_name: "QA legacy", receiver_phone: "0900000000", shipping_address: "QA historical fixture", shipping_method: "Standard", payment_method: "VNPay", payment_status: "pending", order_status: "pending", created_at: now, updated_at: now, __v: 0 });
  await db.collection("payments").insertOne({ _id: paymentId, order_id: orderId, payment_method: "VNPay", transaction_id: txnRef, payment_url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", status: "pending", paid_at: null, created_at: now, updated_at: now, __v: 0 });
  return { created: { order_id: String(orderId), total_amount: 115000 }, payment: { payment_id: String(paymentId) }, data: { vnp_TmnCode: "QATEST", vnp_TxnRef: txnRef, vnp_Amount: "11500000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: String(Date.now()) } };
}
scenario("PAY-003", "VNPay lịch sử: signed success và callback trùng", "Seed đơn/payment lịch sử vào DB QA; ký IPN bằng secret QA; gọi2 lần; xem DB và customer order", "Lần1 code00, lần2 code02; một payment success, order success, không trừ kho thêm", paymentFile, async ({ page }) => {
  const { created, payment, data } = await vnpayOrder(); const stockId = state.products[0].variants[0].id;
  const before = await db.collection("productvariants").findOne(idFilter(stockId));
  for (const expected of ["00", "02"]) expect((await api(`/payments/vnpay/ipn?${signedVNPay(data)}`)).body.RspCode).toBe(expected);
  const [saved] = await evidence("vnpay-success", "payments", idFilter(payment.payment_id)); expect(saved.status).toBe("success");
  expect((await db.collection("orders").findOne(idFilter(created.order_id))).payment_status).toBe("success");
  expect((await db.collection("productvariants").findOne(idFilter(stockId))).stock_quantity).toBe(before.stock_quantity);
  await signIn(page); await page.goto(`/orders/${created.order_id}`); await expect(page.getByText("Đã thanh toán", { exact: true }).first()).toBeVisible();
});

scenario("PAY-004", "VNPay lịch sử: chữ ký sai hoặc số tiền sai không ghi thanh toán", "Seed đơn/payment lịch sử vào DB QA; gửi invalid signature rồi valid signature/amount sai", "Code97 và04; payment/order vẫn pending", paymentFile, async () => {
  const { created, payment, data } = await vnpayOrder(); const forged = signedVNPay(data); forged.set("vnp_SecureHash", "0".repeat(128));
  expect((await api(`/payments/vnpay/ipn?${forged}`)).body.RspCode).toBe("97");
  expect((await api(`/payments/vnpay/ipn?${signedVNPay({ ...data, vnp_Amount: "100" })}`)).body.RspCode).toBe("04");
  const [saved] = await evidence("vnpay-invalid", "payments", idFilter(payment.payment_id)); expect(saved.status).toBe("pending");
  expect((await db.collection("orders").findOne(idFilter(created.order_id))).payment_status).toBe("pending");
});

scenario("PAY-005", "VNPay lịch sử: thất bại được giữ pending để đối soát", "Seed đơn/payment lịch sử vào DB QA; gửi signed failure99 IPN; đọc DB", "Code99 yêu cầu reconcile; không tự xác nhận success/hủy/hoàn kho khi chưa đối soát", paymentFile, async () => {
  const { created, payment, data } = await vnpayOrder();
  expect((await api(`/payments/vnpay/ipn?${signedVNPay({ ...data, vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })}`)).body.RspCode).toBe("99");
  const [saved] = await evidence("vnpay-needs-reconcile", "payments", idFilter(payment.payment_id)); expect(saved.status).toBe("pending");
  expect((await db.collection("orders").findOne(idFilter(created.order_id))).order_status).toBe("pending");
});

function signedMoMo(created, resultCode = 0) {
  const data = { partnerCode: "QATEST", orderId: created.order_id, requestId: created.order_id, amount: created.total_amount, orderInfo: `Thanh toan FStyle ${created.order_id}`, orderType: "momo_wallet", transId: Date.now(), resultCode, message: "QA local callback", payType: "qr", responseTime: Date.now(), extraData: "" };
  const raw = ["accessKey", "amount", "extraData", "message", "orderId", "orderInfo", "orderType", "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"].map((key) => `${key}=${key === "accessKey" ? "qa-test-access" : data[key]}`).join("&");
  return { ...data, signature: createHmac("sha256", state.momoSecret).update(raw).digest("hex") };
}
async function momoOrder() {
  const created = await order("MoMo"); const payment = await api("/payments/momo/create", { token: await token(), method: "POST", data: { order_id: created.order_id } }); expect(payment.status).toBe(200); return { created, payment: payment.body.data };
}
scenario("PAY-006", "MoMo local stub và signed success/callback trùng", "Tạo MoMo qua stub loopback; IPN success2 lần; đọc DB", "Hai callback204, một payment/order success; không có giao dịch provider thật", paymentFile, async () => {
  const { created, payment } = await momoOrder(); const data = signedMoMo(created);
  for (let index = 0; index < 2; index += 1) expect((await api("/payments/momo/ipn", { method: "POST", data })).status).toBe(204);
  const [saved] = await evidence("momo-success", "payments", idFilter(payment.payment_id)); expect(saved.status).toBe("success"); expect((await db.collection("orders").findOne(idFilter(created.order_id))).payment_status).toBe("success");
});

scenario("PAY-007", "MoMo final failure hoàn kho đúng1 lần", "Tạo MoMo; ghi stock sau order; gửi signed final failure1006 hai lần", "Order cancelled/payment failed; hoàn kho1, không2; history lưu", paymentFile, async () => {
  const { created, payment } = await momoOrder(); const variantId = state.products[0].variants[0].id; const before = await db.collection("productvariants").findOne(idFilter(variantId)); const data = signedMoMo(created, 1006);
  for (let index = 0; index < 2; index += 1) expect((await api("/payments/momo/ipn", { method: "POST", data })).status).toBe(204);
  const [saved] = await evidence("momo-failed", "payments", idFilter(payment.payment_id)); expect(saved.status).toBe("failed");
  const current = await db.collection("orders").findOne(idFilter(created.order_id)); expect(current.order_status).toBe("cancelled"); expect(current.payment_status).toBe("failed");
  expect((await db.collection("productvariants").findOne(idFilter(variantId))).stock_quantity).toBe(before.stock_quantity + 1);
});

scenario("PAY-008", "MoMo invalid callback bị chặn", "Gửi body thiếu trường và signature sai", "400; không thay trạng thái payment", paymentFile, async () => {
  const { created, payment } = await momoOrder();
  for (const data of [{}, { ...signedMoMo(created), signature: "0".repeat(64) }]) expect((await api("/payments/momo/ipn", { method: "POST", data })).status).toBe(400);
  expect((await db.collection("payments").findOne(idFilter(payment.payment_id))).status).toBe("pending");
});

for (const provider of ["SePay", "MoMo"]) scenario(`PAY-LIVE-${provider.toUpperCase()}`, `${provider} provider thật`, "Mở cổng thanh toán, dùng tài khoản QA, nhận callback HTTPS thật và đối chiếu DB", "Provider test xác thực success/failure và callback public end-to-end", paymentFile, async () => {
  test.skip(true, "BLOCKED: chưa có credentials/tài khoản sandbox và callback HTTPS được cấp cho môi trường QA; test local chỉ dùng secret giả. Không sử dụng cấu hình production.");
}, "Cần sandbox merchant/account và HTTPS callback riêng; không dùng đơn hay ngân hàng thật.");

async function openAdmin(page, section) {
  await signIn(page, "admin"); await page.goto("/admin"); await page.getByRole("button", { name: section, exact: true }).click();
}
async function createProduct(name = unique("QA Product")) {
  const result = await api("/products", { token: await token("admin"), method: "POST", data: { name, slug: name.toLowerCase().replaceAll(" ", "-"), category_id: state.category, brand_id: state.brand, gender: "Nam", status: false } }); expect(result.status).toBe(201); return result.body.data;
}

scenario("ADM-001", "Tạo/sửa sản phẩm và biến thể qua Admin UI", "Admin tạo workspace; thêm SKU/ảnh; xuất bản; sửa tên; mở Customer; đọc DB", "Giá/tồn đúng, tên mới đồng bộ Customer", adminFile, async ({page}) => {
 const name=unique("QA UI");await openAdmin(page,"Sản phẩm & Biến thể");await fillBasic(page,name);await matrix(page);await image(page);await saveProduct(page);
 await page.getByRole('button',{name:'Thông tin',exact:true}).click();await page.getByLabel('Tên sản phẩm',{exact:true}).fill(name+' Updated');await saveProduct(page,'Lưu thay đổi');
 const saved=await db.collection('products').findOne({name:name+' Updated'});expect(saved).toBeTruthy();expect((await db.collection('productvariants').findOne({product_id:saved._id})).stock_quantity).toBe(8);await evidence('admin-product','products',{_id:saved._id});
 await page.goto('/product/'+saved._id);await expect(page.getByRole('heading',{name:name+' Updated',exact:true})).toBeVisible();
});

scenario("ADM-002", "Quản lý hình ảnh qua Admin UI và customer gallery", "Draft fixture; thêm SKU và2URL; chọn primary; bỏ ảnh khác; xuất bản; đọc gallery", "Một ảnh chính lưu và hiển thị ở Customer", ["frontend/app/admin/AdminProductWorkspace.tsx","backend/src/services/catalogWorkspace.ts"], async ({page}) => {
 const product=await createProduct();await openProduct(page,product);await page.getByLabel('Mã sản phẩm',{exact:true}).fill(unique('QA').toUpperCase());await matrix(page);await image(page);await image(page,state.web+'/images/products/2.webp');
 await page.getByRole('button',{name:'Đặt ảnh chính',exact:true}).click();await page.getByRole('button',{name:'Bỏ ảnh',exact:true}).first().click();await saveProduct(page);
 const images=await evidence('admin-images','productimages',{product_id:oid(product._id)});expect(images).toHaveLength(1);expect(images[0].is_primary).toBe(true);await page.goto('/product/'+product._id);await expect(page.locator('.product-gallery-grid img').first()).toBeVisible();
});

scenario("ADM-003", "Kho có chứng từ và chặn sửa stock qua metadata", "Draft SKU5; kho set4; SKU stale; metadata không được setstock; kho version đúng set6", "Stale409, metadata stock400, kho6 và movement", ["backend/src/controllers/productVariantController.ts","backend/src/controllers/inventoryOperationsController.ts"], async () => {
 const product=await createProduct(),admin=await token('admin'),path='/products/'+product._id+'/variants';const created=await api(path,{token:admin,method:'POST',data:{sku:unique('QA-V'),size:'M',color:'Đen',price:100000,stock_quantity:5}});expect(created.status).toBe(201);const v=created.body.data;
 expect((await api('/admin/inventory/'+v._id+'/adjustment',{token:admin,method:'POST',data:{mode:'set',quantity:4,expected_version:v.__v,note:'QA kiểm kê'}})).status).toBe(200);
 expect((await api(path+'/'+v._id,{token:admin,method:'PATCH',data:{price:120000,expected_version:v.__v}})).status).toBe(409);
 expect((await api(path+'/'+v._id,{token:admin,method:'PATCH',data:{stock_quantity:6,expected_version:v.__v+1}})).status).toBe(400);
 expect((await api('/admin/inventory/'+v._id+'/adjustment',{token:admin,method:'POST',data:{mode:'set',quantity:6,expected_version:v.__v+1,note:'QA kiểm kê lần2'}})).status).toBe(200);
 const [saved]=await evidence('variant-cas','productvariants',idFilter(v._id));expect(saved.stock_quantity).toBe(6);
});

scenario("ADM-004", "Tạo và sửa danh mục qua UI", "Mở danh sách; thêm qua modal; sửa mô tả có version; kiểm tra DB", "Danh mục tồn tại, mô tả mới được lưu", adminFile, async ({page}) => {
 const name=unique('QA Category');await openAdmin(page,'Danh mục sản phẩm');await page.getByRole('button',{name:'Thêm danh mục',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Tên danh mục',{exact:true}).fill(name);await dialog.getByRole('button',{name:'Lưu danh mục',exact:true}).click();await expect(dialog).not.toBeVisible();await page.getByLabel('Tìm danh mục',{exact:true}).fill(name);await page.getByRole('button',{name:'Sửa danh mục '+name,exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Mô tả',{exact:true}).fill('QA updated category');await dialog.getByRole('button',{name:'Lưu danh mục',exact:true}).click();await expect(dialog).not.toBeVisible();await expect.poll(()=>db.collection('categories').findOne({name}).then(row=>row?.description)).toBe('QA updated category');await evidence('admin-category','categories',{name});
});

scenario("ADM-005", "Tạo coupon qua UI và xác minh checkout", "Admin tạo percent15 coupon, dates hợp lệ; customer quote", "DB coupon15; quote giảm12.000 trên80.000", adminFile, async ({ page }) => {
  const code = unique("QAUI").toUpperCase(); await openAdmin(page, "Mã giảm giá"); await page.getByRole("button", { name: "Tạo mã giảm giá", exact: true }).click(); await page.getByLabel("Mã giảm giá", { exact: true }).fill(code); await page.getByLabel("Giá trị giảm", { exact: true }).fill("15");
  await page.getByLabel("Bắt đầu", { exact: true }).fill("2026-01-01T00:00"); await page.getByLabel("Kết thúc", { exact: true }).fill("2030-01-01T00:00"); await page.getByRole("button", { name: "Tạo mã", exact: true }).click(); await expect(page.getByRole("row").filter({ hasText: code })).toBeVisible();
  await emptyCart(); await add(); const quote = await api("/orders/quote", { token: await token(), method: "POST", data: { coupon_code: code } }); expect(quote.body.data.discount_amount).toBe(12000); await evidence("admin-coupon", "coupons", { code });
});

scenario("ADM-006", "Phân trang đơn cũ và lọc trên server", "Tạo225 fixture archive nếu chưa có; API trang9; UI admin trang sau; tìm Archive224", "Bản ghi sau200 vẫn truy cập được; filter tìm ra đơn cũ", ["frontend/app/admin/AdminOrders.tsx", "backend/src/controllers/adminController.ts"], async ({ page }) => {
  if (!state.oldOrderId) {
    const documents = Array.from({ length: 225 }, (_, index) => ({ user_id: oid(state.users.other.id), receiver_name: `QA Archive ${index}`, receiver_phone: "0900000000", final_amount: 135000, total_product_amount: 100000, shipping_fee: 35000, discount_amount: 0, shipping_address: "Test archive", payment_method: "COD", payment_status: "pending", order_status: "pending", created_at: new Date(Date.now() - (index + 1) * 60000) })); await db.collection("orders").insertMany(documents); state.oldOrderId = String(documents.at(-1)._id);
  }
  const response = await api("/admin/orders?page=9&limit=25", { token: await token("admin") }); expect(response.body.data.length).toBeGreaterThan(0); expect(response.body.pagination.total).toBeGreaterThanOrEqual(225);
  await openAdmin(page, "Quản lý đơn hàng"); const next = page.getByRole("navigation", { name: "Phân trang danh sách" }).getByRole("button", { name: "Trang sau", exact: true }); await expect(next).toBeEnabled(); await next.click(); await expect(page.getByRole("navigation", { name: "Phân trang danh sách" })).toContainText("Trang 2/");
  await page.getByRole("textbox", { name: "Tìm đơn hàng", exact: true }).fill("QA Archive 224"); await expect(page.locator(".admin-table tbody")).toContainText("QA Archive 224");
});

scenario("ADM-007", "Soft delete giữ variants/images/order refs", "Tạo product/variant/image; addcart; DELETE product; đọc3 collections; kiểm tra storefront/cart", "Product/variant inactive; dữ liệu/ảnh/cart ref còn; storefront404, add lại404", ["backend/src/controllers/productController.ts", "backend/src/services/orderStock.ts"], async () => {
  const product = await createProduct(), admin = await token("admin"), access = await token();
  const variant = await api(`/products/${product._id}/variants`, { token: admin, method: "POST", data: { sku: unique("QA-SOFT"), size: "M", color: "Đen", price: 100000, stock_quantity: 5 } }); expect(variant.status).toBe(201);
  await api(`/products/${product._id}/images`, { token: admin, method: "POST", data: { image_url: state.web + "/images/products/1.jpg", display_order: 1, is_primary: true } });
  await publishExisting(product._id);
  const line = await api("/cart/items", { token: access, method: "POST", data: { product_variant_id: variant.body.data._id, quantity: 1 } }); expect(line.status).toBe(201);
  expect((await api(`/products/${product._id}`, { token: admin, method: "DELETE" })).status).toBe(200); expect((await db.collection("products").findOne(idFilter(product._id))).status).toBe(false);
  const [saved] = await evidence("soft-variant", "productvariants", idFilter(variant.body.data._id)); expect(saved.status).toBe(false); expect(await db.collection("productimages").countDocuments({ product_id: oid(product._id) })).toBe(1); expect(await db.collection("cartdetails").countDocuments(idFilter(line.body.data._id))).toBe(1);
  expect((await api(`/products/${product._id}`)).status).toBe(404); expect((await api("/cart/items", { token: access, method: "POST", data: { product_variant_id: variant.body.data._id, quantity: 1 } })).status).toBe(404);
});

scenario("SMART-001", "Smart Size số đo hợp lệ và thiếu/sai", "Chọn QA Áo, nhập170/65 Regular; submit; gửi request thiếu/sai API", "Gợi ý M còn hàng; input sai400", ["frontend/app/tu-van-size/page.tsx", "backend/src/controllers/catalogController.ts"], async ({ page }) => {
  await page.goto(`/tu-van-size?categoryId=${state.category}&productId=${state.products[0].id}`); await page.getByLabel("Chiều cao (cm)", { exact: true }).fill("170"); await page.getByLabel("Cân nặng (kg)", { exact: true }).fill("65"); await page.getByRole("button", { name: "Tìm kích cỡ", exact: true }).click(); await expect(page.locator(".size-suggestions")).toContainText("M");
  for (const query of ["", `categoryId=${state.category}&height=-1&weight=65`, `categoryId=invalid&height=170&weight=65`]) expect((await api(`/catalog/size-recommendations?${query}`)).status).toBe(400);
});

scenario("SMART-002", "Mix & Match chỉ gợi ý cùng đối tượng", "Mở áo Nam; đọc section phối đồ", "Có gợi ý Nam; không có QA Em Bé; mỗi link là sản phẩm hợp lệ", ["frontend/lib/product-recommendations.ts", "frontend/app/product/[id]/page.tsx"], async ({ page }) => {
  await page.goto(`/product/${state.products[0].id}`); const section = page.getByRole("region", { name: "Gợi ý phối đồ" }); await expect(section).toBeVisible(); await expect(section).not.toContainText("QA Em Bé"); await expect(section).toContainText("QA Quần Nam");
  await expect(section.locator(".mix-match-card")).toHaveCount(3);
});

scenario("RSP-001", "Responsive và điều hướng desktop/mobile", "Mở home/products/detail/cart/checkout; đo document width và kiểm tra heading; dùng tab keyboard", "Không overflow ngang viewport, nội dung chính hiển thị, focus có thể đi tới control", ["frontend/app/globals.css", "frontend/app/product/[id]/product.css", "frontend/app/cart/cart.css"], async ({ page }) => {
  await emptyCart(); await add(); await signIn(page);
  for (const path of ["/", "/products", `/product/${state.products[0].id}`, "/cart", "/checkout"]) {
    await page.goto(path); await expect(page.locator("h1").first()).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })); expect(widths.document, `overflow at ${path}`).toBeLessThanOrEqual(widths.viewport + 1);
  }
  await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

scenario("ADM-008", "Outfit create replace delete lưu nhất quán Mongo thật", "Admin tạo outfit1 món; thay thành2 món; đọc header/details; xóa; đọc lại", "Header/detail đúng mỗi bước; xóa không để details orphan", ["backend/src/controllers/adminController.ts", "backend/src/models/outfitDetailModel.ts"], async () => {
  const admin = await token("admin");
  const input = { title: unique("QA Outfit"), image: state.web + "/images/products/1.jpg", product_ids: [state.products[0].id] };
  const created = await api("/admin/outfits", { token: admin, method: "POST", data: input }); expect(created.status).toBe(201); const id = created.body.data._id;
  expect(await db.collection("outfitdetails").countDocuments({ outfit_id: oid(id) })).toBe(1);
  expect((await api(`/admin/outfits/${id}`, { token: admin, method: "PUT", data: { ...input, title: input.title + " Changed", product_ids: [state.products[0].id, state.products[1].id] } })).status).toBe(200);
  const rows = await evidence("outfit-details", "outfitdetails", { outfit_id: oid(id) }); expect(rows).toHaveLength(2);
  expect((await db.collection("outfits").findOne(idFilter(id))).title).toBe(input.title + " Changed");
  expect((await api(`/admin/outfits/${id}`, { token: admin, method: "DELETE" })).status).toBe(200); expect(await db.collection("outfits").countDocuments(idFilter(id))).toBe(0); expect(await db.collection("outfitdetails").countDocuments({ outfit_id: oid(id) })).toBe(0);
});

scenario("DB-001", "MongoDB commit và rollback thực", "Mở transaction; insert probe rồi throw; kiểm tra0; transaction commit probe; kiểm tra1; dọn probe", "Rollback0, commit1 trên replica set test thực, không storage mock", ["backend/src/services/orderStock.ts", "frontend/e2e/run.mjs"], async () => {
  const marker = unique("qa-probe"), session = client.startSession(); const probes = db.collection("qa_transaction_probes");
  try {
    await expect(session.withTransaction(async () => { await probes.insertOne({ marker }, { session }); throw new Error("QA_ROLLBACK"); })).rejects.toThrow("QA_ROLLBACK");
    expect(await probes.countDocuments({ marker })).toBe(0);
    await session.withTransaction(async () => probes.insertOne({ marker }, { session })); expect(await probes.countDocuments({ marker })).toBe(1);
    await evidence("transaction-commit", "qa_transaction_probes", { marker });
  } finally { await session.endSession(); await probes.deleteMany({ marker }); }
});

scenario("PAY-009", "Hủy COD có lý do và hoàn kho/coupon một lần", "Tạo COD QA10; thử thiếu lý do, sai chủ đơn; hủy qua UI rồi gửi lại; đọc stock/coupon/history", "Thiếu lý do 400, sai chủ 404, lần hai 409, hoàn kho/coupon một lần và lưu lý do", ["backend/src/controllers/orderController.ts", "frontend/components/orders/CancelOrderButton.tsx"], async ({ page }) => {
  await emptyCart(); await add(); const variantId = state.products[0].variants[0].id; const before = await db.collection("productvariants").findOne(idFilter(variantId)); const coupon = await db.collection("coupons").findOne({ code: "QA10" });
  const created = await api("/orders", { token: await token(), method: "POST", data: { address_id: state.addresses.customer, payment_method: "COD", coupon_code: "QA10" } }); expect(created.status).toBe(201); const id = created.body.data.order_id;
  const reason = "QA đổi ý trước khi shop xác nhận";
  expect((await api(`/orders/${id}/cancel`, { token: await token("other"), method: "PATCH", data: { reason } })).status).toBe(404);
  expect((await api(`/orders/${id}/cancel`, { token: await token(), method: "PATCH" })).status).toBe(400);
  await signIn(page); await page.goto(`/orders/${id}`);
  await page.getByRole("button", { name: "Hủy đơn hàng", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Xác nhận hủy" })).toBeDisabled();
  await dialog.getByLabel("Lý do hủy đơn").fill(reason);
  await dialog.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(page.getByText("Đã hủy đơn hàng thành công.", { exact: true })).toBeVisible();
  expect((await api(`/orders/${id}/cancel`, { token: await token(), method: "PATCH", data: { reason } })).status).toBe(409);
  expect((await db.collection("productvariants").findOne(idFilter(variantId))).stock_quantity).toBe(before.stock_quantity); expect((await db.collection("coupons").findOne({ code: "QA10" })).used_count).toBe(coupon.used_count);
  const [saved] = await evidence("cancelled-cod", "orders", idFilter(id)); expect(saved.order_status).toBe("cancelled");
  const history = await db.collection("orderstatushistories").find({ order_id: idFilter(id)._id, status: "cancelled" }).toArray();
  expect(history).toHaveLength(1); expect(history[0].note).toContain(reason);
});
