import { createHmac, randomInt } from "node:crypto";
import { test, expect, api, state, db, oid, token, emptyCart, add, order, evidence, signIn } from "./helpers.mjs";

const byId = (id) => ({ _id: oid(id) });
const historyOf = (id) => db.collection("orderstatushistories").find({ order_id: oid(id) }).sort({ _id: 1 }).toArray();

async function createAddress(access, provinceCode, wardCode) {
  const response = await api("/addresses", {
    token: access, method: "POST", data: {
      receiver_name: "Khách QA", receiver_phone: "0900000000", province_code: provinceCode,
      ward_code: wardCode, address_detail: "Địa chỉ QA ban đầu",
    },
  });
  expect(response.status).toBe(201);
  return response.body.data._id;
}

async function checkoutState() {
  const user_id = oid(state.users.customer.id);
  const cart = await db.collection("carts").findOne({ user_id });
  const variant = await db.collection("productvariants").findOne(byId(state.products[0].variants[0].id));
  const coupon = await db.collection("coupons").findOne({ code: "QA10" });
  return {
    stock: variant.stock_quantity, stockVersion: variant.__v, couponUses: coupon.used_count,
    cartLines: await db.collection("cartdetails").find({ cart_id: cart._id }).toArray(),
    orders: await db.collection("orders").countDocuments({ user_id }),
    details: await db.collection("orderdetails").countDocuments(),
    payments: await db.collection("payments").countDocuments(),
    history: await db.collection("orderstatushistories").countDocuments(),
  };
}

test("CQA-ADDR rejects a prior quote after the buyer edits the same saved address", async ({ page }) => {
  const access = await token();
  const wards = (await api("/addresses/locations/1/wards")).body.data;
  const address = await createAddress(access, 1, wards[0].code);
  await emptyCart(); await add();
  const data = { address_id: address, shipping_method: "Standard", coupon_code: "QA10" };
  const quote = await api("/orders/quote", { token: access, method: "POST", data });
  expect(quote.status).toBe(200);
  const payload = { ...data, payment_method: "COD", expected_total: quote.body.data.final_amount, expected_cart_snapshot: quote.body.data.cart_snapshot };
  const before = await checkoutState();
  await signIn(page); await page.goto("/checkout");
  await page.locator(`input[name="shipping_address_id"][value="${address}"]`).check();
  await expect(page.locator(".place-order-button")).toBeEnabled();

  const nextAddress = "Địa chỉ QA đã thay đổi";
  const patch = (tokenValue) => api(`/addresses/${address}`, { token: tokenValue, method: "PATCH", data: { address_detail: nextAddress } });
  expect((await patch(await token("other"))).status).toBe(404);
  expect((await patch(access)).status).toBe(200);
  const rejected = await api("/orders", { token: access, method: "POST", data: payload });
  expect(rejected.status).toBe(409);
  expect(await checkoutState()).toEqual(before);

  const firstAttempt = page.waitForResponse((response) => response.url().endsWith("/api/orders") && response.request().method() === "POST");
  await page.locator(".place-order-button").click();
  expect((await firstAttempt).status()).toBe(409);
  await expect(page.locator(".address-card.selected")).toContainText(nextAddress);
  await expect(page.locator(".place-order-button")).toBeEnabled();
  expect(await checkoutState()).toEqual(before);
  await page.locator(".place-order-button").click();
  await expect(page.getByText(/đơn hàng COD của bạn đang chờ xác nhận/i)).toBeVisible();
  const created = await db.collection("orders").findOne({ user_id: oid(state.users.customer.id), shipping_address: { $regex: nextAddress } });
  expect(created).toMatchObject({ order_status: "pending", payment_status: "pending", final_amount: 115000, shipping_fee: 35000 });
  expect((await historyOf(String(created._id))).map(({ status }) => status)).toEqual(["pending"]);
  expect((await checkoutState()).stock).toBe(before.stock - 1);
  expect((await api(`/addresses/${address}`, { token: access, method: "PATCH", data: { address_detail: "Sổ địa chỉ đổi sau khi đặt" } })).status).toBe(200);
  const savedOrder = await api(`/orders/${created._id}`, { token: access });
  expect(savedOrder.body.data.shipping_address).toContain(nextAddress);
  await api(`/addresses/${address}`, { token: access, method: "DELETE" });
});

test("CQA-SHIP refuses unconfigured wards even within the configured province", async () => {
  const access = await token(); const admin = await token("admin");
  const wards = (await api("/addresses/locations/1/wards")).body.data;
  const covered = await createAddress(access, 1, wards[0].code);
  const other = await createAddress(access, 1, wards[1].code);
  await emptyCart(); await add();
  const configure = (data, auth = admin) => api("/admin/settings", { token: auth, method: "PUT", data });
  const config = { express_shipping_province_code: 1, express_shipping_ward_codes: [wards[0].code] };
  const oldSettings = (await api("/admin/settings", { token: admin })).body.data;
  expect((await configure(config, await token("staff"))).status).toBe(403);
  expect((await configure({ ...config, express_shipping_ward_codes: [99999] })).status).toBe(400);
  expect((await configure(config)).status).toBe(200);
  const quote = (address_id, shipping_method = "Express") => api("/orders/quote", { token: access, method: "POST", data: { address_id, shipping_method } });
  try {
    const before = await checkoutState();
    expect((await quote(other)).status).toBe(409);
    expect((await quote(other, "Standard")).body.data).toMatchObject({ express_available: false, shipping_fee: 35000 });
    expect((await quote(covered)).body.data).toMatchObject({ express_available: true, shipping_fee: 45000 });
    expect((await api("/orders", { token: access, method: "POST", data: { address_id: other, shipping_method: "Express", payment_method: "COD" } })).status).toBe(409);
    expect(await checkoutState()).toEqual(before);
  } finally {
    await configure({ express_shipping_province_code: oldSettings.express_shipping_province_code, express_shipping_ward_codes: oldSettings.express_shipping_ward_codes });
    await api(`/addresses/${covered}`, { token: access, method: "DELETE" });
    await api(`/addresses/${other}`, { token: access, method: "DELETE" });
  }
});

test("CQA-QUOTA concurrent checkouts cannot consume the last coupon use twice", async () => {
  const code = `QALAST-${randomInt(100_000, 1_000_000)}`;
  await db.collection("coupons").insertOne({ code, status: true, discount_type: "fixed", discount_value: 20000,
    min_order_value: 80000, usage_limit: 1, used_count: 0, start_date: new Date(Date.now() - 60000), end_date: new Date(Date.now() + 600000) });
  const variantId = state.products[29].variants[0].id;
  const stockBefore = (await db.collection("productvariants").findOne(byId(variantId))).stock_quantity;
  const scope = { coupon_id: (await db.collection("coupons").findOne({ code }))._id };
  const buyers = await Promise.all(["customer", "other"].map(async (role) => {
    const access = await token(role);
    expect((await api("/cart", { token: access, method: "DELETE" })).status).toBe(200);
    expect((await api("/cart/items", { token: access, method: "POST", data: { product_variant_id: variantId, quantity: 1 } })).status).toBe(201);
    const data = { address_id: state.addresses[role], coupon_code: code };
    const quote = await api("/orders/quote", { token: access, method: "POST", data });
    expect(quote.status).toBe(200);
    return { access, payload: { ...data, payment_method: "COD", expected_total: quote.body.data.final_amount, expected_cart_snapshot: quote.body.data.cart_snapshot } };
  }));
  try {
    const created = await Promise.all(buyers.map(({ access, payload }) => api("/orders", { token: access, method: "POST", data: payload })));
    expect(created.filter(({ status }) => status === 201)).toHaveLength(1);
    const lost = created.findIndex(({ status }) => status !== 201);
    expect([400, 409]).toContain(created[lost].status);
    expect((await api("/cart", { token: buyers[lost].access })).body.data.total_quantity).toBe(1);
    const [saved] = await evidence("single-coupon-winner", "orders", scope, { receiver_name: 0, receiver_phone: 0, shipping_address: 0 });
    expect(await db.collection("orders").countDocuments(scope)).toBe(1);
    expect(saved).toMatchObject({ discount_amount: 20000, payment_status: "pending", order_status: "pending" });
    expect(await historyOf(String(saved._id))).toHaveLength(1);
    expect((await db.collection("coupons").findOne({ code })).used_count).toBe(1);
    expect((await db.collection("productvariants").findOne(byId(variantId))).stock_quantity).toBe(stockBefore - 1);
  } finally {
    await Promise.all(buyers.map(({ access }) => api("/cart", { token: access, method: "DELETE" })));
  }
});

test("CQA-CANCEL verifies authorization, status, MongoDB effects and buyer-visible reason", async ({ page }) => {
  const access = await token();
  const rejectedOrder = (await order()).order_id;
  expect((await api(`/admin/orders/${rejectedOrder}/status`, { method: "PATCH", token: await token("staff"), data: { status: "processing" } })).status).toBe(200);
  const cancel = (id, reason, auth = access) => api(`/orders/${id}/cancel`, { method: "PATCH", token: auth, data: { reason } });
  const locked = await checkoutState();
  expect((await cancel(rejectedOrder, "Đổi ý")).status).toBe(409);
  expect((await cancel(rejectedOrder, "Đổi ý", await token("other"))).status).toBe(404);
  expect(await checkoutState()).toEqual(locked);
  expect((await api(`/admin/orders/${rejectedOrder}/status`, { method: "PATCH", token: await token("staff"), data: { status: "shipping" } })).status).toBe(200);
  const shipping = await checkoutState();
  expect((await cancel(rejectedOrder, "Đổi ý")).status).toBe(409);
  expect(await checkoutState()).toEqual(shipping);
  const open = (await order()).order_id;
  const before = await checkoutState();
  expect((await cancel(open, "   ")).status).toBe(400);
  expect(await checkoutState()).toEqual(before);
  expect((await api(`/orders/${open}`, { token: access })).body.data.actions?.cancel).toBe(true);
  const reason = "QA đổi nhầm kích cỡ";
  const results = await Promise.all([cancel(open, reason), cancel(open, reason)]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  const current = (await api(`/orders/${open}`, { token: access })).body.data;
  expect(current).toMatchObject({ order_status: "cancelled", payment_status: "pending", final_amount: 115000, actions: { cancel: false }, cancellation_reason: reason });
  expect((await checkoutState()).stock).toBe(before.stock + 1);
  expect((await historyOf(open)).filter(({ status }) => status === "cancelled")).toHaveLength(1);
  await signIn(page); await page.goto(`/orders/${open}`);
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hủy đơn hàng", exact: true })).toHaveCount(0);
});

test("CQA-IDEMP simultaneous duplicate checkout and retry persist one order only", async () => {
  const access = await token(); await emptyCart(); await add();
  const data = { address_id: state.addresses.customer, coupon_code: "QA10" };
  const quote = await api("/orders/quote", { method: "POST", token: access, data });
  expect(quote.status).toBe(200);
  const before = await checkoutState();
  const payload = { ...data, payment_method: "COD", expected_total: quote.body.data.final_amount, expected_cart_snapshot: quote.body.data.cart_snapshot };
  const place = () => api("/orders", { method: "POST", token: access, data: payload });
  const attempts = await Promise.all([place(), place()]);
  expect(attempts.map(({ status }) => status).sort()).toEqual([200, 201]);
  const first = attempts.find(({ status }) => status === 201);
  const duplicate = await place();
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.data).toEqual(first.body.data);
  expect(attempts.every(({ body }) => body.data.order_id === first.body.data.order_id)).toBe(true);
  expect(await checkoutState()).toEqual({
    ...before, stock: before.stock - 1, stockVersion: before.stockVersion + 1, couponUses: before.couponUses + 1,
    cartLines: [], orders: before.orders + 1, details: before.details + 1, history: before.history + 1,
  });
});

function signedMoMo(created, transId, resultCode = 0) {
  const data = { amount: created.total_amount, extraData: "", message: "QA local callback", orderId: created.order_id,
    orderInfo: `Thanh toan FStyle ${created.order_id}`, orderType: "momo_wallet", partnerCode: "QATEST", payType: "qr",
    requestId: created.order_id, responseTime: Date.now(), resultCode, transId };
  const raw = ["accessKey=qa-test-access", ...Object.entries(data).map(([key, value]) => `${key}=${value}`)].join("&");
  return { ...data, signature: createHmac("sha256", state.momoSecret).update(raw).digest("hex") };
}

test("CQA-MOMO records one provider transaction against at most one order", async () => {
  const access = await token();
  const first = await order("MoMo"), second = await order("MoMo");
  for (const created of [first, second]) {
    expect((await api("/payments/momo/create", { token: access, method: "POST", data: { order_id: created.order_id } })).status).toBe(200);
  }
  const before = await checkoutState();
  const transId = randomInt(1_000_000_000, 9_000_000_000);
  const notify = (created) => api("/payments/momo/ipn", { method: "POST", data: signedMoMo(created, transId) });
  const results = await Promise.all([notify(first), notify(second)]);
  expect(results.map((result) => result.status).sort()).toEqual([204, 409]);
  const winner = results[0].status === 204 ? first : second;
  const loser = winner === first ? second : first;
  expect((await notify(winner)).status).toBe(204);
  const paid = await db.collection("payments").find({ order_id: { $in: [oid(first.order_id), oid(second.order_id)] }, status: "success" }).toArray();
  expect(paid).toHaveLength(1);
  expect((await db.collection("orders").findOne(byId(loser.order_id))).payment_status).toBe("pending");
  expect((await historyOf(winner.order_id)).filter(({ note }) => /MoMo xác nhận đã thu tiền/.test(note))).toHaveLength(1);
  expect(await checkoutState()).toEqual({ ...before, history: before.history + 1 });
  await evidence("momo-one-transaction", "payments", { order_id: { $in: [oid(first.order_id), oid(second.order_id)] } }, { payment_url: 0 });
});

test("CQA-LATE-FAIL records a verified MoMo failure after cancellation without restoring stock again", async () => {
  const created = await order("MoMo");
  const id = created.order_id;
  expect((await api("/payments/momo/create", { method: "POST", token: await token(), data: { order_id: id } })).status).toBe(200);
  expect((await api(`/admin/orders/${id}/cancel`, { method: "PATCH", token: await token("admin"), data: { note: "Đã hủy trước khi giao" } })).status).toBe(200);
  const before = await checkoutState();
  const data = signedMoMo(created, randomInt(1_000_000_000, 9_000_000_000), 1006);
  const send = () => api("/payments/momo/ipn", { method: "POST", data });
  expect((await send()).status).toBe(204);
  expect((await send()).status).toBe(204);
  expect((await db.collection("orders").findOne(byId(id)))).toMatchObject({ order_status: "cancelled", payment_status: "failed", final_amount: created.total_amount });
  expect((await db.collection("payments").findOne({ order_id: oid(id) })).status).toBe("failed");
  expect(await checkoutState()).toEqual({ ...before, history: before.history + 1 });
});

test("CQA-SEPAY journals verified payment exactly once without a new stock or coupon write", async () => {
  const created = await order("SePay");
  expect((await api("/payments/sepay/create", { method: "POST", token: await token(), data: { order_id: created.order_id } })).status).toBe(200);
  const before = await checkoutState();
  const payment = await db.collection("payments").findOne({ order_id: oid(created.order_id) });
  const data = { id: randomInt(1_000_000_000, 9_000_000_000), gateway: payment.sepay_bank_code,
    accountNumber: payment.sepay_account_number, code: payment.sepay_payment_code, content: `SEVQR ${payment.sepay_payment_code}`,
    transferType: "in", transferAmount: created.total_amount, referenceCode: `QA-${payment._id}` };
  const send = () => fetch(`${state.api}/payments/sepay/webhook`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Apikey ${state.sepayKey}` }, body: JSON.stringify(data),
  });
  const deliveries = await Promise.all([send(), send()]);
  for (const response of deliveries) {
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  }
  expect((await db.collection("orders").findOne(byId(created.order_id)))).toMatchObject({ order_status: "pending", payment_status: "success", final_amount: created.total_amount });
  expect((await historyOf(created.order_id)).filter(({ note }) => /SePay xác nhận đã thu tiền/.test(note))).toHaveLength(1);
  expect(await checkoutState()).toEqual({ ...before, history: before.history + 1 });
});

test("CQA-STOCK fails atomically when an existing SKU has fractional stock", async () => {
  const access = await token();
  await emptyCart(); await add();
  const variants = db.collection("productvariants");
  const filter = byId(state.products[0].variants[0].id);
  const original = await variants.findOne(filter);
  await variants.updateOne(filter, { $set: { stock_quantity: 1.5 } });
  try {
    const before = await checkoutState();
    const rejected = await api("/orders", { token: access, method: "POST", data: { address_id: state.addresses.customer, payment_method: "COD", coupon_code: "QA10" } });
    expect(rejected.status).toBe(409);
    expect(await checkoutState()).toEqual(before);
  } finally {
    await variants.updateOne(filter, { $set: { stock_quantity: original.stock_quantity } });
  }
});

test("CQA-COUPON preview rejects invalid VND amounts before reading or reserving use", async () => {
  const before = await db.collection("coupons").findOne({ code: "QA10" });
  for (const order_amount of [120000.5, null, true, [], "120000"]) {
    expect((await api("/coupons/validate", { method: "POST", data: { code: "QA10", order_amount } })).status).toBe(400);
  }
  expect((await api("/coupons/validate", { method: "POST", data: { code: "qa10", order_amount: 120000 } })).body.data).toMatchObject({ discount_amount: 12000 });
  expect(await db.collection("coupons").findOne({ code: "QA10" })).toEqual(before);
});

test("CQA-RETURN checks role, return rollback and exact refund without a second stock movement", async ({ page }) => {
  const buyer = await token(), staff = await token("staff"), admin = await token("admin");
  await emptyCart(); await add(0, 2); await add(1);
  const created = await api("/orders", { token: buyer, method: "POST", data: { address_id: state.addresses.customer, payment_method: "BankTransfer", coupon_code: "QA10" } });
  expect(created.status).toBe(201);
  const id = created.body.data.order_id;
  const total = created.body.data.total_amount;
  const createdPayment = await api("/payments/bank-transfer", { method: "POST", token: buyer, data: { order_id: id } });
  expect(createdPayment.status).toBe(200);
  const paymentId = createdPayment.body.data.payment_id;
  expect((await api(`/payments/${paymentId}/confirm`, { method: "PATCH", token: admin, data: { amount: total, transaction_id: `PAY-${id}` } })).status).toBe(200);
  const adminOrder = `/admin/orders/${id}`;
  for (const status of ["processing", "shipping"]) {
    expect((await api(`${adminOrder}/status`, { method: "PATCH", token: staff, data: { status } })).status).toBe(200);
  }
  const delivery = (action) => api(`${adminOrder}/delivery`, { method: "PATCH", token: staff, data: { action, reason: "refused", note: "Xác nhận qua fixture giao hàng" } });
  expect((await delivery("fail")).status).toBe(200);
  expect((await delivery("return")).status).toBe(200);
  const lines = await db.collection("orderdetails").find({ order_id: oid(id) }).sort({ quantity: -1 }).toArray();
  const inspect = [
    { order_detail_id: String(lines[0]._id), restock_quantity: 1, damaged_quantity: 1, missing_quantity: 0 },
    { order_detail_id: String(lines[1]._id), restock_quantity: 0, damaged_quantity: 0, missing_quantity: 1 },
  ];
  const receive = (access, entries = inspect) => api(`${adminOrder}/return-receipt`, { method: "POST", token: access, data: { lines: entries, note: "QA một nguyên vẹn, một hỏng, một thiếu" } });
  const refund = (access, amount = total) => api(`${adminOrder}/refund`, { method: "POST", token: access, data: { amount, confirmed: true, reference: `REF-${id}`, note: "Đối soát thử nghiệm" } });
  const orderState = async () => {
    const order = await db.collection("orders").findOne(byId(id));
    const variantIds = lines.map(({ product_variant_id }) => product_variant_id);
    return {
      order, history: await historyOf(id),
      variants: await db.collection("productvariants").find({ _id: { $in: variantIds } }).sort({ _id: 1 }).toArray(),
      receipts: await db.collection("orderreturns").find({ order_id: oid(id) }).toArray(),
      movements: await db.collection("inventorymovements").find({ order_id: oid(id) }).toArray(),
      coupon: await db.collection("coupons").findOne({ code: "QA10" }),
    };
  };
  const before = await orderState();
  expect((await receive(buyer)).status).toBe(403);
  expect((await refund(admin)).status).toBe(409);
  expect((await receive(staff, [inspect[0], { ...inspect[1], missing_quantity: 9 }])).status).toBe(400);
  expect(await orderState()).toEqual(before);

  expect((await Promise.all([receive(staff), receive(staff)])).map(({ status }) => status).sort()).toEqual([200, 409]);
  const accepted = await orderState();
  expect(accepted.order).toMatchObject({ order_status: "returned", payment_status: "success", final_amount: total });
  expect(accepted.receipts).toHaveLength(1);
  expect(accepted.receipts[0]).toMatchObject({ claim_status: "pending", lines: [expect.objectContaining({ restock_quantity: 1, damaged_quantity: 1 }), expect.objectContaining({ missing_quantity: 1 })] });
  expect(accepted.coupon.used_count).toBe(before.coupon.used_count - 1);
  expect(accepted.movements).toHaveLength(1);
  const archived = before.variants.find(({ _id }) => String(_id) === String(lines[0].product_variant_id));
  const returned = accepted.variants.find(({ _id }) => String(_id) === String(lines[0].product_variant_id));
  expect(returned.stock_quantity).toBe(archived.stock_quantity + 1);
  expect(returned.quarantine_quantity).toBe((archived.quarantine_quantity ?? 0) + 1);

  expect((await refund(staff)).status).toBe(403);
  expect((await refund(admin, total - 1)).status).toBe(400);
  expect(await orderState()).toEqual(accepted);
  expect((await Promise.all([refund(admin), refund(admin)])).map(({ status }) => status).sort()).toEqual([200, 409]);
  const refunded = await orderState();
  expect(refunded.order).toMatchObject({ order_status: "returned", payment_status: "refunded", final_amount: total, refund: { amount: total } });
  expect(refunded.history).toHaveLength(accepted.history.length + 1);
  expect(refunded.variants).toEqual(accepted.variants);
  expect(refunded.coupon).toEqual(accepted.coupon);
  expect(refunded.movements).toEqual(accepted.movements);
  await evidence("return-receipt", "orderreturns", { order_id: oid(id) });
  await signIn(page); await page.goto(`/orders/${id}`);
  await expect(page.getByText("Số tiền đã hoàn", { exact: false })).toBeVisible();
});
