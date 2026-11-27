import { test, expect, api, state, db, oid, signIn, token, emptyCart, add, order } from "./helpers.mjs";

function transaction(payment, amount) {
  return { id: Date.now(), gateway: "VietinBank", accountNumber: payment.sepay_account_number,
    code: payment.sepay_payment_code, content: "SEVQR " + payment.sepay_payment_code, transferType: "in", transferAmount: amount,
    referenceCode: "QA-" + payment._id };
}

function notify(data) {
  return fetch(state.api + "/payments/sepay/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Apikey " + state.sepayKey },
    body: JSON.stringify(data),
  });
}

test("SEPAY-001 QR đúng tài khoản và số tiền, đơn tự cập nhật khi nhận webhook", async ({ page }) => {
  await emptyCart(); await add(); await signIn(page);
  // Image traffic stays inside the disposable test. Verify the actual encoded URL below.
  let qr;
  await page.route("https://vietqr.app/img?**", route => {
    qr = new URL(route.request().url());
    return route.fulfill({ status: 204 });
  });
  await page.goto("/checkout");
  await page.getByRole("radio", { name: /Thanh toán QR qua SePay/ }).check();
  await page.locator(".place-order-button").click();
  await expect(page).toHaveURL(/\/payment\/sepay\?orderId=[a-f0-9]{24}/);
  const id = new URL(page.url()).searchParams.get("orderId");
  await expect(page.getByText("000123456789", { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(qr)).toBe(true);
  const saved = await db.collection("orders").findOne({ _id: oid(id) });
  const payment = await db.collection("payments").findOne({ order_id: oid(id) });
  const transfer = transaction(payment, saved.final_amount);
  expect(qr.searchParams.get("amount")).toBe(String(saved.final_amount));
  expect(qr.searchParams.get("bank")).toBe("VietinBank");
  expect(qr.searchParams.get("acc")).toBe(transfer.accountNumber);
  expect(qr.searchParams.get("des")).toBe(transfer.content);
  await page.getByRole("button", { name: "Tôi đã chuyển khoản" }).click();
  await expect(page.getByText(/Chưa ghi nhận khoản thanh toán/)).toBeVisible();
  const unmatched = await notify({ ...transfer, code: null });
  expect(await unmatched.json()).toEqual({ success: false });
  expect((await db.collection("orders").findOne({ _id: oid(id) })).payment_status).toBe("pending");
  for (let attempt = 0; attempt < 2; attempt++) {
    const delivered = await notify(transfer);
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toEqual({ success: true });
  }
  await expect(page.getByRole("heading", { name: "Thanh toán thành công" })).toBeVisible({ timeout: 12000 });
  expect(await db.collection("payments").countDocuments({ order_id: oid(id), status: "success" })).toBe(1);
});

test("SEPAY-002 tiền chuyển sau hủy được ghi nhận để hoàn, đơn vẫn đã hủy", async () => {
  const id = (await order("SePay")).order_id;
  const create = access => api("/payments/sepay/create", { token: access, method: "POST", data: { order_id: id } });
  expect((await create(await token("other"))).status).toBe(404);
  expect((await create(await token())).status).toBe(200);
  const admin = await token("admin");
  const payment = await db.collection("payments").findOne({ order_id: oid(id) });
  const saved = await db.collection("orders").findOne({ _id: oid(id) });
  expect((await api("/admin/orders/" + id + "/cancel", { token: admin, method: "PATCH", data: { note: "Khách yêu cầu hủy" } })).status).toBe(200);
  expect((await create(await token())).status).toBe(409);
  const transfer = transaction(payment, saved.final_amount);
  expect((await notify({ ...transfer, id: 0 })).status).toBe(200);
  expect((await db.collection("orders").findOne({ _id: oid(id) })).payment_status).toBe("failed");
  expect((await notify(transfer)).status).toBe(200);
  const refundQueue = await api("/admin/orders?queue=refund_due&search=" + id, { token: admin });
  expect(refundQueue.body.data[0]).toMatchObject({ order_status: "cancelled", payment_status: "success" });
});
