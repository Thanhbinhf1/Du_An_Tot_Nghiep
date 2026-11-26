import { mkdir } from "node:fs/promises";
import path from "node:path";
import { api, db, emptyCart, expect, oid, signIn, state, test, token, unique } from "./helpers.mjs";

let fixture;
const asset = (name) => `${state.web}/images/products/${name}`;
const garment = { length: 68, shoulder: 45, width: 51 };

async function product(name, categoryId, image, variantRows, status = true) {
  const id = oid();
  await db.collection("products").insertOne({ _id: id, name, slug: unique("fashion-qa"), category_id: categoryId,
    gender: "Nam", status, is_featured: true, description: name, created_at: new Date() });
  await db.collection("productimages").insertOne({ product_id: id, image_url: asset(image), is_primary: true, display_order: 1 });
  const variants = variantRows.map(([size, color, price, quantity, sale_price = null]) => ({
    _id: oid(), product_id: id, size, color, price, sale_price, stock_quantity: quantity, sku: unique("FASHION-QA"), status: true,
  }));
  await db.collection("productvariants").insertMany(variants);
  return { id, name, variants };
}

async function outfit(title, style, products) {
  const id = oid();
  await db.collection("outfits").insertOne({ _id: id, title, style, occasion: "Dạo phố cuối tuần", image: "",
    description: "Phối các thiết kế tông trung tính dễ mặc theo từng lớp.", is_active: true, created_at: new Date() });
  await db.collection("outfitdetails").insertMany(products.map((item, index) => ({ outfit_id: id, product_id: item.id, display_order: index + 1 })));
  return id;
}

test.beforeAll(async () => {
  const ids = { tee: oid(), trousers: oid(), jacket: oid() };
  await db.collection("categories").insertMany([
    { _id: ids.tee, name: "Áo thun", slug: unique("ao-thun"), status: true, image: asset("7.webp") },
    { _id: ids.trousers, name: "Quần dài", slug: unique("quan-dai"), status: true, image: asset("4.webp") },
    { _id: ids.jacket, name: "Áo khoác", slug: unique("ao-khoac"), status: true, image: asset("2.webp") },
  ]);
  const tee = await product("Áo thun cotton dáng suông", ids.tee, "7.webp", [
    ["M", "Đen", 290000, 7, 249000], ["L", "Đen", 300000, 0], ["M", "Xanh rêu", 310000, 5],
  ]);
  const trousers = await product("Quần dài phom đứng", ids.trousers, "4.webp", [["M", "Xám", 479000, 1]]);
  const jacket = await product("Áo khoác nhẹ màu kem", ids.jacket, "2.webp", [["M", "Kem", 549000, 5]]);
  const hidden = await product("Áo đã ngừng bán", ids.tee, "8.jpg", [["M", "Đen", 249000, 4]], false);
  const products = [tee, trousers, jacket, hidden];
  const weekend = await outfit("Tông trầm cuối tuần", "Casual", [tee, trousers, hidden]);
  const neutral = await outfit("Lớp áo trung tính", "Minimalist", [jacket, tee]);
  await db.collection("outfits").updateOne({ _id: weekend }, { $set: { gallery: [asset("4.webp")] } });
  const core = { fit_type: "Regular", min_height: 164, max_height: 177, min_weight: 57, max_weight: 73, min_chest: 85, max_chest: 99 };
  await db.collection("sizerecommendations").insertOne({ category_id: ids.tee, size: "L", ...core });
  await db.collection("productsizecharts").insertMany([
    { product_id: tee.id, size: "M", ...core, garment },
    { product_id: tee.id, size: "L", ...core, min_height: 174, max_height: 186, garment: { length: 71, shoulder: 47, width: 54 } },
    { product_id: tee.id, size: "M", ...core, fit_type: "Slim", min_chest: 82, max_chest: 94, garment },
    { product_id: tee.id, size: "L", ...core, fit_type: "Oversize", garment: { length: 71, shoulder: 47, width: 54 } },
  ]);
  fixture = { ids, tee, trousers, jacket, products, weekend, neutral };
});

test.afterAll(async () => {
  if (!fixture) return;
  const products = { $in: fixture.products.map((item) => item.id) };
  const variants = { $in: fixture.products.flatMap((item) => item.variants.map((variant) => variant._id)) };
  const outfits = { $in: [fixture.weekend, fixture.neutral] };
  const categories = { $in: Object.values(fixture.ids) };
  await Promise.all([
    db.collection("cartdetails").deleteMany({ product_variant_id: variants }),
    db.collection("outfitdetails").deleteMany({ outfit_id: outfits }),
    db.collection("outfits").deleteMany({ _id: outfits }),
    db.collection("productvariants").deleteMany({ _id: variants }),
    db.collection("productimages").deleteMany({ product_id: products }),
    db.collection("productsizecharts").deleteMany({ product_id: products }),
    db.collection("sizerecommendations").deleteMany({ category_id: categories }),
    db.collection("products").deleteMany({ _id: products }),
    db.collection("categories").deleteMany({ _id: categories }),
  ]);
});

async function capture(page, name, { fullPage = false } = {}) {
  const folder = process.env.E2E_FASHION_EVIDENCE_DIR;
  if (!folder) return;
  await mkdir(folder, { recursive: true });
  const device = page.viewportSize().width === 390 ? "mobile" : "desktop";
  if (fullPage) await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: path.join(folder, `${name}-${device}.png`), fullPage, animations: "disabled" });
}

async function fillMeasurements(page) {
  await page.getByLabel("Chiều cao (cm)", { exact: true }).fill("170");
  await page.getByLabel("Cân nặng (kg)", { exact: true }).fill("65");
  await page.getByLabel("Vòng ngực (cm)", { exact: true }).fill("92");
}

test("REC-CATALOG-001 xếp hạng bán chạy chỉ từ đơn hoàn tất, đã trả tiền trong 30 ngày", async ({ page }) => {
  const { tee, trousers, jacket } = fixture;
  const now = new Date();
  const older = new Date(now.getTime() - 32 * 86400000);
  const cases = [
    [tee, 10, "completed", "success", now],
    [trousers, 7, "completed", "success", now],
    [jacket, 20, "completed", "pending", now],
    [jacket, 20, "cancelled", "success", now],
    [jacket, 20, "completed", "success", older],
  ];
  const ids = cases.map(() => oid());
  try {
    await db.collection("orders").insertMany(cases.map(([, , status, payment, date], index) => ({
      _id: ids[index], order_status: status, payment_status: payment, completed_at: date, updated_at: date,
    })));
    await db.collection("orderdetails").insertMany(cases.map(([product, quantity], index) => ({
      order_id: ids[index], product_id: product.id, product_variant_id: product.variants[0]._id,
      product_name: product.name, price_at_buy: 100000, quantity,
    })));
    const response = await api("/catalog/best-sellers");
    expect(response.status).toBe(200);
    const ranked = response.body.data;
    expect(ranked).toContain(String(tee.id));
    expect(ranked.indexOf(String(trousers.id))).toBeGreaterThan(ranked.indexOf(String(tee.id)));
    expect(ranked).not.toContain(String(jacket.id));
    await page.goto("/");
    const rail = page.locator("#ban-chay");
    await expect(rail.locator(".product-name").filter({ hasText: tee.name })).toBeVisible();
    const headings = await page.locator("main h1[id], main h2[id]").evaluateAll((items) => items.map((item) => item.id));
    const expected = ["home-title", "home-category-title", "san-pham-moi-title", "ban-chay-title", "home-collections-heading", "khuyen-mai-title", "home-lookbook-title"];
    expect(headings.filter((id) => expected.includes(id))).toEqual(expected);
    await expect(rail.locator(".product-name").filter({ hasText: jacket.name })).toHaveCount(0);
    await rail.evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
    await capture(page, "ban-chay");
  } finally {
    await db.collection("orderdetails").deleteMany({ order_id: { $in: ids } });
    await db.collection("orders").deleteMany({ _id: { $in: ids } });
  }
});

test("REC-CATALOG-002 giữ bộ lọc và phân trang danh mục khi tải lại và quay lại", async ({ page }) => {
  await page.goto("/categories/qa-ao?color=%C4%90en&size=M&nhom=nam");
  await page.getByRole("combobox", { name: "Sắp xếp" }).selectOption("price-asc");
  const second = page.getByRole("navigation", { name: "Phân trang danh mục" }).getByRole("button", { name: "2", exact: true });
  await second.click();
  await page.reload();
  await expect(second).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Sắp xếp" })).toHaveValue("price-asc");
  await page.goBack();
  await expect(page.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-current", "page");
  const sidebar = page.getByRole("complementary", { name: "Bộ lọc sản phẩm" });
  const docked = await sidebar.isVisible();
  if (!docked) await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  const drawer = docked ? sidebar : page.getByRole("dialog", { name: "Bộ lọc sản phẩm" });
  await drawer.locator("summary").filter({ hasText: "Màu sắc" }).click();
  await expect(drawer.getByRole("checkbox", { name: "Đen" })).toBeChecked();
  await capture(page, "loc-danh-muc");
  await drawer.getByRole("button", { name: "Xóa bộ lọc" }).click();
  expect(new URL(page.url()).searchParams.get("nhom")).toBe("nam");
  await expect(drawer.getByRole("checkbox", { name: "Đen" })).not.toBeChecked();
});

test("REC-CATALOG-003 ảnh theo màu trên thẻ sản phẩm, đăng nhập giữ nguyên SKU", async ({ page }) => {
  const { tee } = fixture;
  const color = "Xanh rêu";
  const photo = asset("4.webp");
  const image = await db.collection("productimages").insertOne({
    product_id: tee.id, image_url: photo, color, is_primary: false, display_order: 2,
  });
  try {
    await page.goto(`/search?q=${encodeURIComponent(tee.name)}`);
    const card = page.locator(".product-card").filter({ hasText: tee.name }).first();
    await card.getByRole("button", { name: color, exact: true }).click();
    await expect(card.locator(".product-card-media img")).toHaveAttribute("src", photo);
    await card.getByRole("link", { name: tee.name, exact: true }).first().click();
    await page.getByRole("link", { name: "Đăng nhập để mua hàng" }).click();
    await page.locator('input[name="account"]').fill(state.users.customer.email);
    await page.locator('input[name="password"]').fill(state.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const info = page.getByRole("region", { name: "Thông tin sản phẩm" });
    await expect(info.getByRole("button", { name: color, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(info.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(info.getByRole("button", { name: "Thêm vào giỏ hàng" })).toBeEnabled();
    await capture(page, "bien-the-sau-dang-nhap");
  } finally {
    await db.collection("productimages").deleteOne({ _id: image.insertedId });
  }
});

test("FASHION-001 bảng kích cỡ, phom, API hợp lệ và tồn kho độc lập", async ({ page }) => {
  const { tee, ids } = fixture;
  await page.goto(`/product/${tee.id}`);
  const trigger = page.getByRole("button", { name: "Bảng kích cỡ", exact: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Hướng dẫn đo kích cỡ" });
  await expect(drawer.getByRole("cell", { name: "68", exact: true })).toBeVisible();
  await capture(page, "bang-size");
  await drawer.getByText("So sánh với trang phục của bạn", { exact: true }).click();
  await drawer.getByRole("spinbutton", { name: /Dài trang phục/ }).fill("65");
  await expect(drawer.getByText("Chênh lệch: +3 cm", { exact: true })).toBeVisible();
  await drawer.getByRole("radio", { name: "Inch" }).check();
  await expect(drawer.getByRole("cell", { name: "26,8", exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Số đo cơ thể", exact: true }).click();
  await expect(drawer.getByRole("columnheader", { name: "Vòng ngực (in)" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole("link", { name: /Tư vấn kích cỡ/ }).click();
  await fillMeasurements(page);
  await page.getByRole("button", { name: "Tìm kích cỡ", exact: true }).click();
  await expect(page.locator(".size-suggestions strong")).toHaveText("M");
  const recommended = page.getByRole("region", { name: "Sản phẩm còn kích cỡ M" });
  await expect(recommended.getByText(tee.name, { exact: true })).toBeVisible();
  await expect(recommended.getByRole("link", { name: "Xem chi tiết" })).toHaveAttribute("href", /\?size=M$/);
  await page.getByText("Xem bảng kích cỡ", { exact: true }).click();
  await page.locator(".size-hero").scrollIntoViewIfNeeded();
  await capture(page, "smart-size", { fullPage: true });

  const route = "/catalog/size-recommendations";
  const values = { fit: "Regular", height: 170, weight: 65, chest: 92 };
  const general = await api(route, { method: "POST", data: { ...values, categoryId: String(ids.tee) } });
  expect(general.body.data).toEqual(["L"]);
  expect(general.body.recommendation.productIds).toEqual([]);
  const scoped = { ...values, productId: String(tee.id) };
  for (const value of [-1, "170", [], {}, null]) {
    expect((await api(route, { method: "POST", data: { ...scoped, height: value } })).status).toBe(400);
  }
  expect((await api(route, { method: "POST", data: { ...scoped, categoryId: String(ids.trousers) } })).status).toBe(404);
  const medium = { product_id: tee.id, size: "M" };
  await db.collection("productvariants").updateMany(medium, { $set: { stock_quantity: 0 } });
  try {
    const sold = await api(route, { method: "POST", data: scoped });
    expect(sold.body.recommendation.source).toBe("product");
    expect(sold.body.data).toEqual(["M"]);
    expect(sold.body.recommendation.productIds).toEqual([]);
    await page.getByRole("button", { name: "Tìm kích cỡ", exact: true }).click();
    await expect(recommended.getByText("Hiện chưa có sản phẩm phù hợp còn kích cỡ này.")).toBeVisible();
  } finally {
    await Promise.all(tee.variants.filter((item) => item.size === "M").map((item) =>
      db.collection("productvariants").updateOne({ _id: item._id }, { $set: { stock_quantity: item.stock_quantity } })));
  }
});

test("FASHION-002 lọc lookbook, chọn SKU, cập nhật giá và xử lý giỏ hàng một phần", async ({ page }) => {
  const { weekend, tee, trousers, jacket } = fixture;
  await emptyCart();
  const access = await signIn(page);
  await page.goto("/outfit");
  await page.getByRole("button", { name: "Minimalist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lớp áo trung tính" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tông trầm cuối tuần" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await page.getByRole("link", { name: "Khám phá Tông trầm cuối tuần" }).click();
  await expect(page).toHaveURL(new RegExp(String(weekend)));
  const shop = page.locator("#shop-the-look");
  const top = shop.getByRole("article", { name: tee.name });
  const bottom = shop.getByRole("article", { name: trousers.name });
  const total = shop.locator(".outfit-total dd");
  await expect(top.getByRole("button", { name: "L", exact: true })).toBeDisabled();
  await expect(top.getByRole("link", { name: /Tư vấn size/ })).toBeVisible();
  await expect(shop.getByText("1 món đã ngừng bán hoặc không còn hiển thị.")).toBeVisible();
  await expect(total).toHaveText(/728\.000/);
  const photos = shop.getByRole("group", { name: "Ảnh bộ phối" });
  await photos.getByRole("button", { name: "Ảnh phụ 1" }).click();
  await expect(shop.getByRole("img", { name: "Ảnh phụ của bộ phối Tông trầm cuối tuần" })).toBeVisible();
  await photos.getByRole("button", { name: "Ảnh chính" }).click();
  await capture(page, "mix-match", { fullPage: true });
  await top.getByRole("button", { name: "Xanh rêu", exact: true }).click();
  await expect(total).toHaveText(/789\.000/);
  await bottom.getByRole("checkbox").uncheck();
  await expect(total).toHaveText(/310\.000/);
  await bottom.getByRole("checkbox").check();
  const wrong = await api("/cart/items", { token: access, method: "POST", data: {
    source_outfit_id: String(weekend), product_id: String(tee.id), product_variant_id: String(jacket.variants[0]._id), quantity: 1,
  } });
  expect(wrong.status).toBe(400);
  const removed = await api("/cart/items", { token: access, method: "POST", data: {
    source_outfit_id: String(weekend), product_id: String(jacket.id), product_variant_id: String(jacket.variants[0]._id), quantity: 1,
  } });
  expect(removed.status).toBe(409);
  const stocked = await api("/cart/items", { token: access, method: "POST", data: {
    product_variant_id: String(trousers.variants[0]._id), quantity: 1,
  } });
  expect(stocked.status).toBe(201);
  const add = shop.getByRole("button", { name: "Thêm sản phẩm đã chọn vào giỏ" });
  await add.evaluate((button) => { button.click(); button.click(); });
  await expect(shop.getByText(`Đã thêm vào giỏ: ${tee.name}.`)).toBeVisible();
  await expect(shop.getByRole("alert")).toContainText(`${trousers.name}: Tổng số lượng trong giỏ vượt quá tồn kho`);
  const cart = (await api("/cart", { token: access })).body.data;
  expect(cart.items.map((item) => [item.product_variant_id._id, item.quantity]).sort())
    .toEqual([[String(tee.variants[2]._id), 1], [String(trousers.variants[0]._id), 1]].sort());
});

test("FASHION-003 ba banner, chuyển ảnh và responsive 1440/1280/1024/768/390", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sản phẩm nổi bật" })).toBeVisible();
  const home = page.getByRole("region", { name: "banner trang chủ", exact: true });
  await expect(home.getByRole("button", { name: "Ảnh 2 của banner trang chủ", exact: true })).toHaveAttribute("aria-current", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(home.getByRole("button", { name: "Tự động chuyển ảnh banner trang chủ" })).toBeVisible();
  for (const name of ["banner trang chủ", "banner sản phẩm mới", "banner sản phẩm nổi bật"]) {
    const banner = page.getByRole("region", { name, exact: true });
    await expect(banner.getByRole("button", { name: `Ảnh 3 của ${name}`, exact: true })).toBeVisible();
    await banner.getByRole("button", { name: `Ảnh 1 của ${name}`, exact: true }).click();
    await banner.getByRole("button", { name: `Ảnh tiếp theo của ${name}` }).click();
    await expect(banner.getByRole("button", { name: `Ảnh 2 của ${name}`, exact: true })).toHaveAttribute("aria-current", "true");
    const area = await banner.boundingBox();
    expect(Math.abs(area.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(area.width - page.viewportSize().width)).toBeLessThanOrEqual(1);
    if (name !== "banner trang chủ") {
      await expect(banner.getByRole("link", { name: "Xem chi tiết" })).toHaveAttribute("href", /^\/product\//);
      await banner.getByRole("button", { name: `Ảnh 1 của ${name}`, exact: true }).click();
      await banner.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
      await capture(page, name.includes("nổi bật") ? "banner-noi-bat" : "banner-hang-moi");
    }
  }
  await page.getByRole("button", { name: "Ảnh 1 của banner trang chủ", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, "trang-chu");
  const routes = ["/", `/tu-van-size?productId=${fixture.tee.id}`, `/outfit?bo-phoi=${fixture.weekend}`, `/product/${fixture.tee.id}`];
  const widths = testInfo.project.name.startsWith("mobile") ? [390] : [1440, 1280, 1024, 768];
  for (const route of routes) {
    await page.goto(route);
    if (route.startsWith("/tu-van-size")) await expect(page.getByLabel("Chiều cao (cm)", { exact: true })).toBeVisible();
    if (route.startsWith("/outfit")) await expect(page.locator("#shop-the-look")).toBeVisible();
    if (route.startsWith("/product")) await page.getByRole("button", { name: "Bảng kích cỡ" }).click();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const body = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
      expect(body.scroll, `${route} @ ${width}`).toBeLessThanOrEqual(body.width + 1);
      if (route.startsWith("/product")) {
        const x = await page.getByRole("dialog").boundingBox();
        expect(x.x).toBeGreaterThanOrEqual(0);
        expect(x.x + x.width).toBeLessThanOrEqual(width + 1);
      }
    }
  }
});

test("FASHION-004 trạng thái thiếu bảng, bộ phối ngừng bán và lỗi API có thể thử lại", async ({ page }) => {
  await page.goto(`/tu-van-size?productId=${fixture.jacket.id}`);
  await expect(page.getByText(/Cửa hàng chưa có bảng kích cỡ cho lựa chọn này/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tìm kích cỡ", exact: true })).toHaveCount(0);
  await page.goto(`/outfit?bo-phoi=${oid()}`);
  await expect(page.getByText("Bộ phối này không còn hiển thị.")).toBeVisible();
  await page.route("**/api/catalog/outfits", (route) => route.abort("failed"), { times: 1 });
  await page.goto("/outfit");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tông trầm cuối tuần" })).toBeVisible();
  await page.route("**/api/catalog/size-chart?*", (route) => route.abort("failed"), { times: 1 });
  await page.goto(`/product/${fixture.tee.id}`);
  await page.getByRole("button", { name: "Bảng kích cỡ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Hướng dẫn đo kích cỡ" });
  await dialog.getByRole("button", { name: "Thử lại" }).click();
  await expect(dialog.getByRole("cell", { name: "68", exact: true })).toBeVisible();
});

test("FASHION-005 quản trị tạo, sửa và gỡ bảng kích cỡ riêng", async () => {
  const admin = await token("admin");
  const endpoint = "/admin/size-recommendations";
  const productId = String(fixture.jacket.id);
  const row = { product_id: productId, size: "M", fit_type: "Regular", min_chest: 85, max_chest: 99, garment: { length: 73 } };
  const created = await api(endpoint, { token: admin, method: "POST", data: row });
  expect(created.status).toBe(201);
  const id = created.body.data._id;
  const customerChart = `/catalog/size-chart?productId=${productId}`;
  try {
    const listed = (await api(endpoint, { token: admin })).body.data.find((item) => item._id === id);
    expect(listed).toMatchObject({ scope: "product", product_id: { _id: productId, name: fixture.jacket.name } });
    expect((await api(customerChart)).body.data).toMatchObject({ source: "product", rows: [{ min_chest: 85, garment: { length: 73 } }] });
    const revised = await api(`${endpoint}/${id}`, { token: admin, method: "PUT", data: {
      product_id: productId, size: "M", fit_type: "Regular", min_height: 160, max_height: 175,
    } });
    expect(revised.status).toBe(200);
    const modified = (await api(customerChart)).body.data.rows[0];
    expect(modified.min_height).toBe(160);
    expect(modified).not.toHaveProperty("min_chest");
    expect(modified).not.toHaveProperty("garment");
  } finally {
    expect((await api(`${endpoint}/${id}`, { token: admin, method: "DELETE" })).status).toBe(200);
  }
  expect((await api(customerChart)).body.data).toMatchObject({ source: "unavailable", rows: [] });
});
