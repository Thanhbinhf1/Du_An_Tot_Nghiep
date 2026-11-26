import { test, expect, api, state, unique, token, signIn } from "./helpers.mjs";

async function registerBuyer() {
  const email = unique("account") + "@e2e.invalid";
  const result = await api("/auth/register", { method: "POST", data: { name: "Khách kiểm thử", email, password: state.password } });
  expect(result.status).toBe(201);
  return { email, token: result.body.data.token };
}

test("ACCOUNT-UI lưu hồ sơ, quản lý địa chỉ và đổi mật khẩu qua API thật", async ({ page }) => {
  const buyer = await registerBuyer();
  await page.goto("/dang-nhap");
  await page.getByRole("textbox", { name: "Email tài khoản" }).fill(buyer.email);
  await page.locator('[name="password"]').fill(state.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto("/profile/edit");
  await page.getByLabel("Họ và tên").fill("Khách sau cập nhật");
  await page.getByLabel("Số điện thoại").fill("+84912345678");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ.");
  await page.reload();
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("0912345678");
  await expect(page.getByLabel("Email")).toHaveValue(buyer.email);
  const profile = (await api("/auth/me", { token: buyer.token })).body.data;
  expect(profile).toMatchObject({ name: "Khách sau cập nhật", phone: "0912345678", email: buyer.email });

  const addresses = () => api("/addresses", { token: buyer.token }).then((response) => response.body.data);
  await page.goto("/profile/address");
  for (const receiver of ["Người nhận A", "Người nhận B"]) {
    await page.getByRole("button", { name: "Thêm địa chỉ" }).click();
    await page.getByLabel("Người nhận", { exact: true }).fill(receiver);
    await page.getByLabel("Số điện thoại").fill("0912345678");
    await page.getByLabel("Số nhà, tên đường").fill("12 Đường kiểm thử");
    const province = page.getByLabel("Tỉnh / Thành phố");
    await expect(province.locator("option").nth(1)).toBeAttached();
    await province.selectOption({ index: 1 });
    const ward = page.getByLabel("Phường / Xã / Đặc khu");
    await expect(ward).toBeEnabled();
    await ward.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Lưu địa chỉ" }).click();
    await expect(page.getByText(receiver, { exact: true })).toBeVisible();
  }
  const second = page.getByRole("article").filter({ hasText: "Người nhận B" });
  await second.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Số nhà, tên đường").fill("34 Đường mới");
  await page.getByRole("button", { name: "Lưu địa chỉ" }).click();
  await expect(second).toContainText("34 Đường mới");
  await second.getByRole("button", { name: "Đặt mặc định" }).click();
  await expect(second.getByText("Mặc định", { exact: true })).toBeVisible();
  expect((await addresses()).filter((row) => row.is_default).map((row) => row.receiver_name)).toEqual(["Người nhận B"]);
  page.once("dialog", (dialog) => dialog.dismiss());
  await second.getByRole("button", { name: "Xóa" }).click();
  expect(await addresses()).toHaveLength(2);
  page.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "Xóa" }).click();
  await expect(second).toHaveCount(0);
  expect((await addresses()).map((row) => [row.receiver_name, row.is_default])).toEqual([["Người nhận A", true]]);

  await page.goto("/profile/password");
  const replacement = "Updated-" + state.password;
  await page.getByLabel("Mật khẩu hiện tại").fill(state.password);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(replacement);
  await page.getByLabel("Nhập lại mật khẩu mới").fill(replacement);
  await page.getByRole("button", { name: "Cập nhật mật khẩu", exact: true }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?passwordChanged=1/);
  expect((await api("/auth/me", { token: buyer.token })).status).toBe(401);
  expect((await api("/auth/login", { method: "POST", data: { email: buyer.email, password: replacement } })).status).toBe(200);
});

test("ACCOUNT-DB thêm địa chỉ đồng thời giữ một mặc định", async () => {
  const { token } = await registerBuyer();
  const province = (await api("/addresses/locations")).body.data[0].code;
  const ward = (await api(`/addresses/locations/${province}/wards`)).body.data[0].code;
  const create = (name) => api("/addresses", { token, method: "POST", data: {
    receiver_name: name, receiver_phone: "0912345678", address_detail: "14 Đường kiểm thử", province_code: province, ward_code: ward,
  } });
  const results = await Promise.all([create("Địa chỉ A"), create("Địa chỉ B")]);
  expect(results.map((result) => result.status)).toEqual([201, 201]);
  const rows = (await api("/addresses", { token })).body.data;
  expect(rows).toHaveLength(2);
  expect(rows.filter((row) => row.is_default)).toHaveLength(1);
});

test("ACCOUNT-WISHLIST lưu, tải lại và xóa sản phẩm của tài khoản", async ({ page }) => {
  const { token: buyer } = await registerBuyer();
  await signIn(page, "customer", buyer);
  await page.goto("/products");
  const card = page.locator(".product-card").first();
  const productUrl = await card.locator('a[href^="/product/"]').first().getAttribute("href");
  const id = productUrl.split("/").at(-1).split("?")[0];
  await card.getByRole("button", { name: "Thêm vào yêu thích" }).click();
  await expect(card.getByRole("button", { name: "Bỏ khỏi yêu thích" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/wishlist");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card a").first()).toHaveAttribute("href", new RegExp(id));
  expect((await api("/wishlist", { token: buyer })).body.data).toContain(id);
  await page.getByRole("button", { name: "Bỏ khỏi yêu thích" }).click();
  await expect(page.getByRole("heading", { name: "Danh sách yêu thích đang trống" })).toBeVisible();
  expect((await api("/wishlist", { token: buyer })).body.data).toEqual([]);
});

test("ACCOUNT-REVIEWS chỉ hiện nhận xét của chủ tài khoản, liên kết tới sản phẩm", async ({ page }) => {
  const { token: buyer } = await registerBuyer();
  const product = state.products[27];
  const staff = await token("admin");
  const { province_code, ward_code } = (await api("/addresses", { token: await token() })).body.data[0];
  const address = await api("/addresses", { token: buyer, method: "POST", data: {
    receiver_name: "Người mua", receiver_phone: "0912345678", address_detail: "25 Đường kiểm thử", province_code, ward_code,
  } });
  expect(address.status).toBe(201);
  expect([200, 201]).toContain((await api("/cart/items", { token: buyer, method: "POST", data: { product_variant_id: product.variants[0].id, quantity: 1 } })).status);
  const checkout = await api("/orders", { token: buyer, method: "POST", data: { address_id: address.body.data._id, payment_method: "COD" } });
  expect(checkout.status).toBe(201);
  for (const status of ["processing", "shipping", "completed"]) {
    expect((await api(`/admin/orders/${checkout.body.data.order_id}/status`, { token: staff, method: "PATCH", data: { status } })).status).toBe(200);
  }
  const comment = unique("Nhận xét");
  expect((await api(`/reviews/${product.id}`, { token: buyer, method: "POST", data: { rating: 4, comment } })).status).toBe(200);
  const mine = await api("/reviews/account/mine", { token: buyer });
  expect(mine.body.data).toMatchObject([{ productId: product.id, rating: 4, comment }]);
  expect((await api("/reviews/account/mine", { token: await token("other") })).body.data.some((row) => row.comment === comment)).toBe(false);
  await signIn(page, "customer", buyer);
  await page.goto("/profile/reviews");
  await expect(page.getByText(comment)).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem đánh giá trên sản phẩm" })).toHaveAttribute("href", `/product/${product.id}#product-reviews`);
});
