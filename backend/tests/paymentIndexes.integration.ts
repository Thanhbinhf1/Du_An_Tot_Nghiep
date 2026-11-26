import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const requireFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { MongoMemoryReplSet } = requireFrontend("mongodb-memory-server");

async function availablePort() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return address.port;
}

test("server starts with both legacy payment indexes and enforces provider uniqueness", { timeout: 60_000 }, async () => {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: "127.0.0.1", storageEngine: "wiredTiger" } });
  const databaseName = `payment_index_qa_${randomUUID().replaceAll("-", "")}`;
  const uri = repl.getUri(databaseName);
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 3_000 });
  let server: ChildProcess | undefined;
  try {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
    const payments = client.db(databaseName).collection("payments");
    await payments.createIndex({ transaction_id: 1 }, { name: "transaction_id_1", unique: true, partialFilterExpression: { payment_method: "VNPay" } });
    await payments.createIndex({ order_id: 1 }, { name: "order_id_1", unique: true, partialFilterExpression: { payment_method: "BankTransfer" } });
    const existingId = new mongoose.Types.ObjectId();
    const orderId = new mongoose.Types.ObjectId();
    const bankPaymentId = new mongoose.Types.ObjectId();
    await payments.insertMany([
      { _id: existingId, payment_method: "VNPay", order_id: orderId, transaction_id: "legacy-vnpay-qa" },
      { _id: bankPaymentId, payment_method: "BankTransfer", order_id: orderId, transaction_id: "legacy-bank-qa", status: "success" },
    ]);

    const port = await availablePort();
    const workingDirectory = fileURLToPath(new URL("../", import.meta.url));
    server = spawn(process.execPath, ["dist/server.js"], {
      cwd: workingDirectory, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DATABASE: uri, DATABASE_URL: uri, DOTENV_CONFIG_PATH: "unused-fixture-env", HOST: "127.0.0.1", PORT: String(port), NODE_ENV: "production" },
    });
    let logs = "";
    server.stdout?.on("data", (chunk) => { logs += String(chunk); });
    server.stderr?.on("data", (chunk) => { logs += String(chunk); });
    const deadline = Date.now() + 15_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null || logs.includes("Không thể khởi động server")) break;
      const health = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) }).catch(() => null);
      if (health?.ok) { ready = true; break; }
      await delay(100);
    }
    assert.ok(ready, logs);
    assert.equal((await payments.findOne({ _id: existingId }))?.transaction_id, "legacy-vnpay-qa");
    assert.equal((await payments.findOne({ _id: bankPaymentId }))?.transaction_id, "legacy-bank-qa");
    const indexes = await payments.listIndexes().toArray();
    assert.ok(indexes.some((index) => index.name === "transaction_id_1" && index.unique));
    assert.ok(!indexes.some((index) => index.name === "unique_vnpay_transaction"));
    assert.deepEqual(indexes.find((index) => index.name === "order_id_1")?.partialFilterExpression, { payment_method: "BankTransfer" });
    const vnpayOrderIndex = indexes.find((index) => index.name === "unique_vnpay_order");
    assert.equal(vnpayOrderIndex?.unique, true);
    assert.deepEqual(vnpayOrderIndex?.key, { order_id: 1 });
    assert.deepEqual(vnpayOrderIndex?.partialFilterExpression, { payment_method: "VNPay" });
    assert.ok(indexes.some((index) => index.name === "unique_bank_transfer_transaction" && index.unique));
    assert.ok(indexes.some((index) => index.name === "unique_momo_provider_transaction" && index.unique));
    await assert.rejects(payments.insertOne({ payment_method: "VNPay", order_id: new mongoose.Types.ObjectId(), transaction_id: "legacy-vnpay-qa" }), { code: 11000 });
    await assert.rejects(payments.insertOne({ payment_method: "BankTransfer", order_id: new mongoose.Types.ObjectId(), transaction_id: "legacy-bank-qa", status: "success" }), { code: 11000 });
    await payments.insertOne({ payment_method: "MoMo", order_id: new mongoose.Types.ObjectId(), transaction_id: "request-1", momo_transaction_id: "provider-qa" });
    await assert.rejects(payments.insertOne({ payment_method: "MoMo", order_id: new mongoose.Types.ObjectId(), transaction_id: "request-2", momo_transaction_id: "provider-qa" }), { code: 11000 });
  } finally {
    if (server && server.exitCode === null) server.kill();
    await client.close();
    await repl.stop();
  }
});
