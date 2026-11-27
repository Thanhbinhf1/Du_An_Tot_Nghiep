import { test, expect, api, db, oid, state, token, signIn, emptyCart, unique } from "./helpers.mjs";
import { resolve } from "node:path";

const chat = async (message, options = {}) => {
  const result = await api("/chat", { method: "POST", token: options.token,
    data: { message, context: options.context, productId: options.productId } });
  expect(result.status, result.body.message).toBe(200);
  return result.body.data;
};

let fixture;
test.beforeAll(async () => {
  const suffix = unique("chatqa").split("-")[1];
  const shirt = oid();
  const pants = oid();
  const wornOut = oid();
  const outfit = oid();
  const couponExpired = ("chatold" + suffix).toUpperCase();
  const couponMin = ("chatmin" + suffix).toUpperCase();
  const order = oid();
  const other = oid();
  const now = new Date();
  const productName = `Áo thun Chat QA ${suffix}`;
  const bottom = `Quần jean Chat QA ${suffix}`;
  const replacement = `Quần jean mới Chat QA ${suffix}`;
  const common = { status: true, created_at: now, updated_at: now };
  await db.collection("products").insertMany([
    { ...common, _id: shirt, name: productName, slug: `chat-shirt-${suffix}`, category_id: oid(state.category), material: "100% cotton", care_instructions: "Giặt với nước mát.", description: "Áo thun mặc đi học.", is_featured: true },
    { ...common, _id: pants, name: replacement, slug: `chat-jean-${suffix}`, description: "Quần jean đi học." },
    { ...common, _id: wornOut, name: bottom, slug: `chat-old-${suffix}`, description: "Quần jean đi học." },
  ]);
  await db.collection("productimages").insertOne({ product_id: shirt, image_url: "/images/products/1.jpg", is_primary: true, display_order: 1 });
  const denim = oid();
  const black = oid();
  const white = oid();
  const sku = (key, product_id, size, color, price, stock_quantity) => ({ ...common, product_id, size, color, price, stock_quantity, sku: `CHAT-${suffix}-${key}` });
  await db.collection("productvariants").insertMany([
    { ...sku("black", shirt, "L", "Đen", 290000, 0), _id: black },
    { ...sku("white", shirt, "L", "Trắng", 275000, 12), _id: white, sale_price: 269000 },
    sku("white2", shirt, "L", "White", 279000, 8),
    sku("red", shirt, "L", "Đỏ", 300000, 10),
    sku("blackM", shirt, "M", "Đen", 240000, 15),
    { ...sku("denim", pants, "M", "Xanh", 220000, 12), _id: denim },
    sku("old", wornOut, "M", "Xanh", 250000, 0),
  ]);
  await db.collection("productsizecharts").insertOne({
    product_id: shirt, size: "M", fit_type: "Regular", min_height: 163, max_height: 175, min_weight: 53, max_weight: 62,
  });
  await db.collection("outfits").insertOne({ _id: outfit, title: `Bộ phối đi học ${suffix}`, occasion: "Đi học", image: "/images/products/1.jpg", is_active: true, created_at: now });
  await db.collection("outfitdetails").insertMany([
    { outfit_id: outfit, product_id: shirt, display_order: 1 },
    { outfit_id: outfit, product_id: wornOut, display_order: 2 },
  ]);
  const coupon = { status: true, used_count: 0, usage_limit: 5, discount_type: "percent", discount_value: 20, min_order_value: 500000, start_date: new Date(Date.now() - 7200000) };
  await db.collection("coupons").insertMany([
    { ...coupon, code: couponExpired, end_date: new Date(Date.now() - 3600000) },
    { ...coupon, code: couponMin, max_discount: 90000, end_date: new Date(Date.now() + 3600000) },
  ]);
  await db.collection("orders").insertMany([
    { _id: order, user_id: oid(state.users.customer.id), order_status: "shipping", payment_method: "BankTransfer", payment_status: "pending", final_amount: 290000, created_at: now, updated_at: now,
      receiver_name: "QA PRIVATE BUYER", receiver_phone: "0000000000", shipping_address: "QA PRIVATE ADDRESS" },
    { _id: other, user_id: oid(state.users.other.id), order_status: "pending", payment_method: "MoMo", payment_status: "pending", final_amount: 290000, created_at: now, updated_at: now },
  ]);
  fixture = { suffix, shirt, pants, wornOut, outfit, couponExpired, couponMin, order, other, productName, replacement, black, white };
});

test.afterAll(async () => {
  if (!fixture) return;
  const ids = [fixture.shirt, fixture.pants, fixture.wornOut];
  await emptyCart();
  await Promise.all([
    db.collection("products").deleteMany({ _id: { $in: ids } }),
    db.collection("productvariants").deleteMany({ product_id: { $in: ids } }),
    db.collection("productimages").deleteMany({ product_id: { $in: ids } }),
    db.collection("productsizecharts").deleteMany({ product_id: { $in: ids } }),
    db.collection("outfits").deleteOne({ _id: fixture.outfit }),
    db.collection("outfitdetails").deleteMany({ outfit_id: fixture.outfit }),
    db.collection("coupons").deleteMany({ code: { $in: [fixture.couponExpired, fixture.couponMin] } }),
    db.collection("orders").deleteMany({ _id: { $in: [fixture.order, fixture.other] } }),
  ]);
});

test("CHAT-001 giữ bộ lọc và kiểm tra SKU, size, phối đồ, so sánh", async () => {
  const start = await chat("tim ao thun den size L duoi 300k");
  expect(start.aiStatus).toBe("unconfigured");
  expect(start.text).toMatch(/hết hàng/i);
  expect(start.cards.find((card) => card.id === String(fixture.shirt)).variants).toEqual([
    expect.objectContaining({ id: String(fixture.black), available: false }),
  ]);
  const follow = await chat("có mẫu trắng không?", { context: start.context });
  expect(follow.context.filters).toMatchObject({ query: "ao thun", color: "trang", size: "l", maxPrice: 300000, exclusive: true });
  expect(follow.cards.find((card) => card.id === String(fixture.shirt)).variants[0]).toMatchObject({ id: String(fixture.white), price: 269000, available: true });
  const mixed = await chat("Áo thun size L dưới 300k và phí giao hàng đơn 200k?");
  expect(mixed.text).toContain("35.000");
  expect(mixed.cards.some((card) => card.id === String(fixture.shirt))).toBe(true);
  const size = await chat("Em cao 1m68, nặng 57kg, áo này mặc size gì?", { productId: String(fixture.shirt) });
  expect(size.text).toContain("size M");
  expect(size.context).not.toHaveProperty("height");
  expect(size.context).not.toHaveProperty("weight");
  expect(size.cards[0].id).toBe(String(fixture.shirt));
  const outfit = await chat("phối đồ đi học với quần jean, tổng dưới 700k");
  const replaced = outfit.cards.find((card) => card.kind === "outfit" && card.replaced);
  expect(replaced.replaced).toContain(fixture.replacement);
  expect(replaced.total).toBe(460000);
  expect(replaced.products.every((card) => card.variants.every((variant) => variant.available))).toBe(true);
  const comparison = await chat(`So sánh ${fixture.productName} và ${fixture.replacement}`);
  expect(comparison.cards).toHaveLength(2);
  expect(comparison.text).toContain("100% cotton");
  expect(comparison.text).toContain("chưa có thông tin chất liệu");
});

test("CHAT-002 quyền xem đơn, thanh toán đang chờ, ưu đãi và phí giao", async () => {
  const guest = await chat("Đơn của tôi tới đâu rồi?");
  expect(guest.links[0].href).toContain("/dang-nhap");
  const access = await token();
  const list = await chat("Đơn của tôi tới đâu rồi?", { token: access });
  expect(list.cards.some((row) => row.id === String(fixture.order))).toBe(true);
  expect(list.cards.some((row) => row.id === String(fixture.other))).toBe(false);
  const selected = await chat(`Tra đơn #${String(fixture.order).slice(-8)}`, { token: access });
  expect(selected.cards[0]).toMatchObject({ status: "shipping", paymentStatus: "pending", paymentMethod: "BankTransfer",
    actions: { cancel: false, pay: false, returnRequest: false } });
  expect(JSON.stringify(selected)).not.toContain("QA PRIVATE");
  for (const id of [fixture.other, oid()]) {
    const blocked = await chat(`Tra đơn #${id}`, { token: access });
    expect(blocked.cards).toEqual([]);
    expect(blocked.text).toContain("không thể mở đơn này");
  }
  const methods = await chat("Có COD, chuyển khoản, VNPay hay MoMo?");
  expect(methods.text).toContain("VNPay đã ngừng");
  expect(methods.text).toContain("Chuyển khoản ngân hàng —");
  expect(methods.text).toContain("MoMo —");
  expect(methods.text).toContain("SePay —");
  const expired = await chat(`Mã giảm giá ${fixture.couponExpired} cho đơn 600k`);
  expect(expired.text).toContain("hết hạn");
  const below = await chat(`Mã giảm giá ${fixture.couponMin} cho đơn 100k`);
  expect(below.text).toContain("500.000");
  const discount = await chat("Đơn 600k", { context: below.context });
  expect(discount.text).toContain("90.000");
  expect((await db.collection("coupons").findOne({ code: fixture.couponMin })).used_count).toBe(0);
  const shipping = await chat("Phí giao hàng tiêu chuẩn cho đơn 200k");
  expect(shipping.text).toContain("35.000");
  const outsideExpress = await chat("Giao hỏa tốc đến Quảng Ngãi, xã Bình Sơn");
  expect(outsideExpress.text).toMatch(/chưa hỗ trợ|phường, xã/);
  const oversized = await api("/chat", { method: "POST", data: { message: "g".repeat(501) } });
  expect(oversized.status).toBe(400);
});

test("CHAT-003 giao diện, giỏ chống bấm lặp, mất mạng, đăng xuất và viewport nhỏ", async ({ page }, info) => {
  await emptyCart();
  const access = await signIn(page);
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`/product/${fixture.shirt}`);
  await page.getByRole("button", { name: "Trắng", exact: true }).click();
  const launcher = page.getByRole("button", { name: "Trợ lý VSC_BAPD" });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: "Trợ lý VSC_BAPD" });
  const input = dialog.getByRole("textbox", { name: "Tin nhắn cho trợ lý" });
  async function send(message) {
    await input.fill(message);
    await dialog.getByRole("button", { name: "Gửi tin nhắn" }).click();
  }
  await send("1m68, 57kg");
  await expect(dialog.getByText(/mình gợi ý size M/i)).toBeVisible();
  await expect(dialog.getByText(/màu trắng size M hiện chưa có biến thể/i)).toBeVisible();
  await send("Tìm áo thun trắng size L dưới 300k");
  const card = dialog.locator(".vsc-chat-product").filter({ hasText: fixture.productName }).filter({ has: page.getByLabel("Chọn size và màu") });
  const add = card.getByRole("button", { name: "Thêm vào giỏ" });
  await expect(add).toBeDisabled();
  await card.getByLabel("Chọn size và màu").selectOption(String(fixture.white));
  await add.evaluate((button) => { button.click(); button.click(); });
  await expect(card.getByText("Đã thêm 1 sản phẩm vào giỏ.")).toBeVisible();
  expect((await api("/cart", { token: access })).body.data.total_quantity).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await expect(page.getByRole("button", { name: "Giỏ hàng, 1 sản phẩm" })).toBeVisible();
  await launcher.click();
  const screenshot = process.env.CHAT_SCREENSHOT_DIRECTORY;
  if (screenshot) await page.screenshot({ path: resolve(screenshot, info.project.name.startsWith("mobile") ? "VSC_BAPD-chat-mobile.png" : "VSC_BAPD-chat-desktop.png") });
  const originalViewport = page.viewportSize();
  if (info.project.name.startsWith("mobile")) {
    await input.focus();
    await page.setViewportSize({ width: 390, height: 500 });
    const form = await input.boundingBox();
    expect(form.y + form.height).toBeLessThanOrEqual(500);
    await page.setViewportSize(originalViewport);
  }
  await page.route("**/api/chat", (route) => route.abort(), { times: 1 });
  await send("Cho mình thông tin thanh toán");
  await expect(dialog.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await dialog.getByRole("button", { name: "Thử lại" }).click();
  await expect(dialog.getByText(/VNPay đã ngừng/)).toBeVisible();
  await send(`Tra đơn #${fixture.order}`);
  await expect(dialog.getByText("Đang giao", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) if (key.startsWith("bapd-demo-")) storage.removeItem(key);
    }
    window.dispatchEvent(new Event("bapd-demo-auth-change"));
  });
  await expect(dialog).not.toBeVisible();
  await launcher.click();
  await expect(dialog.getByText("Đang giao", { exact: true })).toHaveCount(0);
  expect(consoleErrors.filter((error) => /hydrat/i.test(error))).toEqual([]);
});


test("CHAT-004 lời chào và phản hồi cũ không ghi đè lượt kế tiếp", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (typeof url !== "string" || !url.endsWith("/api/chat")) return originalFetch(url, options);
      const body = JSON.parse(options.body);
      if (!["Câu A", "Câu B"].includes(body.message)) return originalFetch(url, options);
      return new Promise((resolve) => {
        const key = body.message === "Câu A" ? "resolveChatA" : "resolveChatB";
        if (body.message === "Câu A") window.chatSignalA = options.signal;
        window[key] = () => resolve(Response.json({ status: "success", data: {
          text: body.message === "Câu A" ? "Phản hồi cũ A" : "Phản hồi mới B",
          cards: [], links: [], suggestions: [], context: { filters: { query: body.message } }, aiStatus: "unconfigured",
        } }));
      });
    };
  });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Trợ lý VSC_BAPD" });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: "Trợ lý VSC_BAPD" });
  const greeting = dialog.getByText("Xin chào! Mình là trợ lý VSC_BAPD. Hôm nay bạn muốn mình giúp gì?");
  const input = dialog.getByRole("textbox");
  const stop = dialog.getByRole("button", { name: "Dừng trả lời" });
  const send = dialog.getByRole("button", { name: "Gửi tin nhắn" });
  await expect(greeting).toBeVisible();
  for (const label of ["Tìm sản phẩm", "Tư vấn size", "Phối đồ", "Tra đơn hàng"]) {
    await expect(dialog.getByRole("button", { name: label })).toBeVisible();
  }
  await input.fill("xin chào");
  await send.click();
  await expect(dialog.getByText(/Chào bạn! Bạn có thể thử lượt tìm/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Tìm quần jean đen size L dưới 500k" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Liên hệ VSC_BAPD" })).toHaveCount(0);
  await expect(greeting).toHaveCount(1);
  const showScrollbar = await input.evaluate((node) => node.scrollHeight > node.clientHeight);
  expect(showScrollbar).toBe(false);

  await input.fill("Câu A");
  await send.click();
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(dialog.getByText("Đã dừng trả lời.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.chatSignalA?.aborted)).toBe(true);
  await input.fill("Câu B");
  await send.click();
  await page.waitForFunction(() => typeof window.resolveChatA === "function" && typeof window.resolveChatB === "function");
  await page.evaluate(() => window.resolveChatA());
  await expect(stop).toBeVisible();
  await page.evaluate(() => window.resolveChatB());
  await expect(dialog.getByText("Phản hồi mới B")).toBeVisible();
  await expect(dialog.getByText("Phản hồi cũ A")).toHaveCount(0);
  await expect(send).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await launcher.click();
  await expect(dialog.getByText("Phản hồi mới B")).toBeVisible();
  await dialog.getByRole("button", { name: "Ẩn kết quả" }).click();
  await expect(dialog.getByText("Đã ẩn câu trả lời vừa rồi.")).toBeVisible();
  await expect(dialog.getByText("Phản hồi mới B")).toHaveCount(0);
  await expect(dialog.getByText("Câu B", { exact: true })).toBeVisible();
});

