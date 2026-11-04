import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import { config } from "dotenv";

// Chỉ đọc cấu hình kiểm thử
config({ path: ".env.test" });

test("MongoDB transaction commit và rollback", async () => {
  const uri = process.env.MONGO_TEST_URI;

  if (!uri) {
    throw new Error("Thiếu MONGO_TEST_URI trong .env.test");
  }

  // Kết nối độc lập, không dùng connection của Backend
  const conn = await mongoose
    .createConnection(uri, {
      serverSelectionTimeoutMS: 10000,
    })
    .asPromise();

  try {
    // Bảo vệ database chính
    if (conn.name !== "fstyle_test") {
      throw new Error(`Từ chối kiểm thử trên database: ${conn.name}`);
    }

    const schema = new mongoose.Schema({
      marker: {
        type: String,
        required: true,
      },
    });

    const Probe = conn.model(
      "VNPayTransactionProbe",
      schema,
      "vnpay_transaction_probe_tests",
    );

    const marker = randomUUID();

    try {
      // TEST 1: Commit thành công
      await conn.transaction(async (session) => {
        await Probe.create([{ marker }], { session });
      });

      assert.equal(
        await Probe.countDocuments({ marker }),
        1,
        "Commit phải lưu dữ liệu",
      );

      // Xóa dữ liệu vừa commit
      await Probe.deleteMany({ marker });

      // TEST 2: Rollback khi xảy ra lỗi
      await assert.rejects(
        conn.transaction(async (session) => {
          await Probe.create([{ marker }], { session });

          // Giả lập lỗi nghiệp vụ
          throw new Error("ROLLBACK_TEST");
        }),
        /ROLLBACK_TEST/,
      );

      assert.equal(
        await Probe.countDocuments({ marker }),
        0,
        "Rollback không được lưu dữ liệu",
      );
    } finally {
      // Dọn dữ liệu thuộc lần test này
      await Probe.deleteMany({ marker });
    }
  } finally {
    await conn.close();
  }
});
