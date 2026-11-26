import { test as base, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const requireBackend = createRequire(new URL("../../backend/package.json", import.meta.url));
export const mongoose = requireBackend("mongoose");
export const jwt = requireBackend("jsonwebtoken");
export const state = JSON.parse(await readFile(process.env.RECOVERY_QA_STATE ?? new URL("./.runtime/state.json", import.meta.url), "utf8"));
if (!/^mongodb:\/\/127\.0\.0\.1:/.test(state.mongoUri) || !state.mongoUri.includes("fstyle_e2e_")) throw new Error("E2E refuses non-disposable database");
if (state.api !== "http://127.0.0.1:5100/api" || state.web !== "http://127.0.0.1:3101") throw new Error("E2E refuses non-loopback app URLs");
export const client = new mongoose.mongo.MongoClient(state.mongoUri, { serverSelectionTimeoutMS: 5000 });
export const db = client.db();
// Fixtures register for every spec, even when this module is cached between files.
const test = base.extend({
  qaDatabase: [async ({}, provide) => {
    await client.connect();
    try { await provide(); } finally { await client.close(); }
  }, { scope: "worker", auto: true }],
  qaNetwork: [async ({ page }, provide) => {
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return [state.web, "http://127.0.0.1:5100", "http://127.0.0.1:5101"].includes(url.origin) || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort("blockedbyclient");
    });
    await provide();
  }, { auto: true }],
});
export const oid = (value) => new mongoose.Types.ObjectId(value);
const tokens = {};
export const unique = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;
export async function api(path, { token, method = "GET", data } = {}) {
  const response = await fetch(state.api + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(20000) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
export async function token(role = "customer") {
  if (!tokens[role]) {
    const response = await api("/auth/login", { method: "POST", data: { email: state.users[role].email, password: state.password } });
    expect(response.status).toBe(200); tokens[role] = response.body.data.token;
  }
  return tokens[role];
}
export async function signIn(page, role = "customer", overrideToken) {
  const access = overrideToken ?? await token(role);
  await page.addInitScript(({ email, role, access }) => {
    localStorage.setItem("bapd-demo-authenticated", "true"); localStorage.setItem("bapd-demo-account", email);
    localStorage.setItem("bapd-demo-role", role); localStorage.setItem("bapd-demo-token", access);
  }, { email: state.users[role].email, role: role === "other" ? "customer" : role, access });
  return access;
}
export async function emptyCart() {
  const access = await token();
  expect((await api("/cart", { token: access, method: "DELETE" })).status).toBe(200);
}
export async function add(index = 0, quantity = 1, variantIndex = 0) {
  const result = await api("/cart/items", { token: await token(), method: "POST", data: { product_variant_id: state.products[index].variants[variantIndex].id, quantity } });
  expect([200, 201]).toContain(result.status); return result.body.data;
}
export async function order(method = "COD", index = 0) {
  await emptyCart(); await add(index);
  const result = await api("/orders", { token: await token(), method: "POST", data: { address_id: state.addresses.customer, payment_method: method } });
  expect(result.status).toBe(201); return result.body.data;
}
export async function evidence(name, collection, filter, projection = {}) {
  const values = await db.collection(collection).find(filter, { projection }).toArray();
  const target = test.info().outputPath(`${name}.json`);
  await writeFile(target, JSON.stringify(values, null, 2));
  await test.info().attach(`DB: ${name}`, { path: target, contentType: "application/json" });
  return values;
}
export function scenario(id, title, steps, expected, files, run, preconditions = "Local replica set tạm; fixtures QA riêng; không dùng dữ liệu ứng dụng. Đăng nhập bằng API fixture trừ ca kiểm tra form login/register.") {
  const apiOnly = ["CART-003", "CART-004", "CHK-003", "CHK-004", "CHK-005", "CHK-007", "PAY-004", "PAY-005", "PAY-006", "PAY-007", "PAY-008", "ADM-003", "ADM-007", "ADM-008", "DB-001", "PAY-009"].includes(id);
  const layer = apiOnly ? "API → Backend → MongoDB thật; không thao tác UI cho scenario này" : "Browser UI kết hợp API/DB theo steps; các fixture login/seed qua API được nêu trong preconditions";
  test(`${id} ${title}`, { annotation: { type: "case", description: JSON.stringify({ id, title, steps, expected, files, preconditions, layer }) } }, async ({ page, request }) => {
    await run({ page, request });
    test.info().annotations.push({ type: "actual", description: `Đã xác minh bằng assertions: ${expected}. Evidence DB được đính kèm khi có thao tác quan trọng.` });
  });
}
export { test, expect };
