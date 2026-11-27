import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.resolve(frontend, "../backend");
const runtime = path.join(frontend, "e2e/.runtime");
await mkdir(runtime, { recursive: true });
const requireBackend = createRequire(path.join(backend, "package.json"));
const mongoose = requireBackend("mongoose");
const bcrypt = requireBackend("bcrypt");
const children = [];
const logs = [];
let repl, gateway;
const nextEnvPath = path.join(frontend, "next-env.d.ts");
const nextEnvBefore = await readFile(nextEnvPath).catch(() => null);
const env = { ...process.env, E2E_MODE: "1", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: "http://127.0.0.1:5100/api", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", DOTENV_CONFIG_PATH: path.join(runtime, "unused-env-file"), NODE_ENV: "production" };
env.HOST = "127.0.0.1";
env.CHAT_OPENAI_API_KEY = "";
env.CHAT_OPENAI_MODEL = "";
env.UPLOAD_DIRECTORY = path.join(runtime, "uploads");
const state = { api: "http://127.0.0.1:5100/api", web: "http://127.0.0.1:3101", password: `QaTest!${randomUUID()}`, jwtSecret: randomUUID(), vnpSecret: randomUUID(), momoSecret: randomUUID(), sepayKey: randomUUID() };

function start(label, cwd, args, overrides = {}) {
  const log = createWriteStream(path.join(runtime, `${label}.log`)); logs.push(log);
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...overrides }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log); child.stderr.pipe(log); children.push(child);
  return child;
}
async function finished(child) {
  return new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Child exited ${code}; inspect e2e/.runtime logs`))); });
}
async function ready(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before ready: ${url}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server readiness timeout: ${url}`);
}
async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
try {
  await Promise.all([5100, 5101, 3101].map(assertPortFree));
  console.log("Building backend source for isolated E2E...");
  await finished(start("backend-build", backend, ["node_modules/typescript/bin/tsc"]));
  console.log("Starting a temporary loopback MongoDB replica set...");
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: "127.0.0.1", storageEngine: "wiredTiger" } });
  const dbName = `fstyle_e2e_${randomUUID().replaceAll("-", "")}`;
  state.mongoUri = repl.getUri(dbName);
  if (!/^mongodb:\/\/127\.0\.0\.1:/.test(state.mongoUri) || !state.mongoUri.includes(dbName)) throw new Error("Unsafe E2E database URI");
  await mongoose.connect(state.mongoUri);
  for (const file of await readdir(path.join(backend, "dist/models"))) {
    if (file.endsWith("Model.js")) await import(new URL(`../../backend/dist/models/${file}`, import.meta.url));
  }
  const models = mongoose.models;
  await Promise.all(Object.values(models).map((model) => model.init()));
  state.users = {};
  for (const role of ["admin", "staff", "customer", "other"]) {
    const user = await models.User.create({ name: `QA ${role}`, email: `qa-${role}@e2e.invalid`, password: await bcrypt.hash(state.password, 10), role: role === "other" ? "customer" : role });
    state.users[role] = { id: String(user._id), email: user.email };
  }
  const men = await models.Category.create({ name: "Nam", slug: "nam" });
  const shirts = await models.Category.create({ name: "QA Áo", slug: "qa-ao", parent_id: men._id });
  await models.SizeRecommendation.create({ category_id: shirts._id, size: "M", fit_type: "Regular",
    min_height: 165, max_height: 175, min_weight: 58, max_weight: 70 });
  const trousers = await models.Category.create({ name: "QA Quần", slug: "qa-quan", parent_id: men._id });
  const baby = await models.Category.create({ name: "Em bé", slug: "em-be" });
  const brand = await models.Brand.create({ name: "QA Brand", slug: "qa-brand" });
  state.category = String(shirts._id); state.brand = String(brand._id); state.products = [];
  for (let index = 0; index < 30; index += 1) {
    const product = await models.Product.create({ name: `QA Áo ${String(index + 1).padStart(2, "0")}`, slug: `qa-ao-${index + 1}`, category_id: shirts._id, brand_id: brand._id, gender: "Nam", is_featured: index === 0 });
    const variants = await models.ProductVariant.create([
      { product_id: product._id, sku: `QA-${index}-M-DEN`, size: "M", color: "Đen", price: 100000 + index * 1000, sale_price: index === 0 ? 80000 : null, stock_quantity: 100 },
      { product_id: product._id, sku: `QA-${index}-M-TRANG`, size: "M", color: "Trắng", price: 100000 + index * 1000, stock_quantity: 100 },
      { product_id: product._id, sku: `QA-${index}-L-DEN`, size: "L", color: "Đen", price: 100000 + index * 1000, stock_quantity: 0 },
    ]);
    await models.ProductImage.create({ product_id: product._id, image_url: "http://127.0.0.1:3101/images/products/1.jpg", display_order: 1, is_primary: true });
    state.products.push({ id: String(product._id), name: product.name, variants: variants.map((variant) => ({ id: String(variant._id), size: variant.size, color: variant.color })) });
  }
  for (const [name, category, gender] of [["QA Quần Nam", trousers, "Nam"], ["QA Em Bé", baby, "Em bé"]]) {
    const product = await models.Product.create({ name, slug: gender === "Nam" ? "qa-quan-nam" : "qa-em-be", category_id: category._id, brand_id: brand._id, gender });
    await models.ProductVariant.create({ product_id: product._id, sku: `QA-EXTRA-${gender}`, size: "M", color: "Đen", price: 120000, stock_quantity: 100 });
  }
  state.addresses = {};
  const { getProvince } = await import(new URL("../../backend/dist/services/addressLocations.js", import.meta.url));
  const deliveryProvince = getProvince(1);
  const deliveryWard = deliveryProvince.wards[0];
  for (const role of ["customer", "other"]) {
    const address = await models.Address.create({ user_id: state.users[role].id, receiver_name: `QA ${role}`, receiver_phone: "0900000000", province: deliveryProvince.name, province_code: deliveryProvince.code, ward: deliveryWard.name, ward_code: deliveryWard.code, address_detail: "Địa chỉ kiểm thử", is_default: true });
    state.addresses[role] = String(address._id);
  }
  await models.Coupon.create({ code: "QA10", discount_type: "percent", discount_value: 10, usage_limit: 10000, start_date: new Date(Date.now() - 86400000), end_date: new Date(Date.now() + 86400000 * 365) });
  await models.Setting.create({ key: "store_config", value: { standard_shipping_fee: 35000, express_shipping_fee: 45000, express_shipping_province_code: 1, express_shipping_ward_codes: [deliveryWard.code], free_shipping_threshold: 500000 } });
  const olderOrders = await models.Order.create(Array.from({ length: 225 }, (_, index) => ({ user_id: state.users.other.id, total_product_amount: 100000, discount_amount: 0, shipping_fee: 35000, final_amount: 135000, receiver_name: `QA Archive ${index}`, receiver_phone: "0900000000", shipping_address: "Test archive", shipping_method: "Standard", payment_method: "COD", payment_status: "pending", order_status: "pending", created_at: new Date(Date.now() - (index + 1) * 60000) })));
  state.oldOrderId = String(olderOrders.at(-1)._id);
  await mongoose.disconnect();
  Object.assign(env, { DATABASE: state.mongoUri, DATABASE_URL: state.mongoUri, JWT_SECRET: state.jwtSecret, PORT: "5100", GOOGLE_CLIENT_ID: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", BANK_NAME: "QA TEST BANK", BANK_ACCOUNT_NUMBER: "TEST000000", BANK_ACCOUNT_NAME: "QA TEST ONLY", VNP_TMN_CODE: "QATEST", VNP_HASH_SECRET: state.vnpSecret, VNP_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", VNP_RETURN_URL: `${state.api}/payments/vnpay/return`, VNP_RESULT_PAGE_URL: `${state.web}/payment/result`, VNP_API_URL: "http://127.0.0.1:5101/query", MOMO_ENABLED: "true", MOMO_PARTNER_CODE: "QATEST", MOMO_ACCESS_KEY: "qa-test-access", MOMO_SECRET_KEY: state.momoSecret, MOMO_ENDPOINT: "http://127.0.0.1:5101/momo", MOMO_REDIRECT_URL: `${state.api}/payments/momo/return`, MOMO_IPN_URL: `${state.api}/payments/momo/ipn`, MOMO_RESULT_PAGE_URL: `${state.web}/payment/result`, SEPAY_ENV: "sandbox", SEPAY_BANK_CODE: "VietinBank", SEPAY_ACCOUNT_NAME: "QA SHOP", SEPAY_API_TOKEN: "", SEPAY_WEBHOOK_API_KEY: state.sepayKey, SEPAY_ACCOUNT_NUMBER: "000123456789" });
  gateway = createServer(async (req, res) => {
    let text = ""; for await (const chunk of req) text += chunk;
    const data = JSON.parse(text || "{}");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ partnerCode: "QATEST", orderId: data.orderId, requestId: data.requestId, resultCode: 0, payUrl: `https://test-payment.momo.vn/qa-only/${data.orderId}` }));
  });
  await new Promise((resolve) => gateway.listen(5101, "127.0.0.1", resolve));
  await writeFile(path.join(runtime, "state.json"), JSON.stringify(state, null, 2));
  const api = start("backend", backend, ["dist/server.js"]); await ready("http://127.0.0.1:5100", api);
  if (process.env.E2E_DB_CHECKS === "1") {
    const probeUri = new URL(state.mongoUri); probeUri.pathname = "/fstyle_test";
    console.log("Running existing MongoDB integration suites on the temporary server...");
    await finished(start("mongodb-integration", runtime, [path.join(backend, "node_modules/tsx/dist/cli.mjs"), "--test", path.join(backend, "tests/mongodbTransaction.integration.ts"), path.join(backend, "tests/productVariants.integration.ts")], { MONGO_TEST_URI: probeUri.toString() }));
  }
  const useDevServer = process.env.E2E_NEXT_DEV === "1";
  if (!useDevServer && process.env.E2E_REUSE_BUILD !== "1") {
    console.log("Building a separate .next-e2e frontend against the temporary API...");
    await finished(start("frontend-build", frontend, ["node_modules/next/dist/bin/next", "build"]));
  }
  const web = start("frontend", frontend, ["node_modules/next/dist/bin/next", useDevServer ? "dev" : "start", "--hostname", "127.0.0.1", "--port", "3101"], {
    NODE_ENV: useDevServer ? "development" : "production",
  });
  await ready(state.web, web);
  console.log("Isolated frontend/API/database ready; running desktop and mobile tests...");
  await finished(start("playwright", frontend, ["node_modules/@playwright/test/cli.js", "test", ...(process.env.E2E_TEST_MATCH ? ["--grep", process.env.E2E_TEST_MATCH] : [])]));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) { child.kill(); await new Promise((resolve) => child.once("exit", resolve)); }
  if (gateway) await new Promise((resolve) => gateway.close(resolve));
  await mongoose.disconnect();
  if (repl) await repl.stop();
  if (nextEnvBefore && (await readFile(nextEnvPath, "utf8").catch(() => "")).includes(".next-e2e/")) await writeFile(nextEnvPath, nextEnvBefore);
  for (const log of logs) log.end();
  console.log("Stopped E2E-owned servers and temporary MongoDB.");
}
