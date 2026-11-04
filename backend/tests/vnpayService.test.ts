import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createVNPayUrl,
  verifyVNPaySignature,
} from "../src/services/vnpayService.js";

// Cấu hình giả chỉ sử dụng trong unit test.
process.env.VNP_TMN_CODE = "TESTMERCHANT";
process.env.VNP_HASH_SECRET = "test-secret-not-for-production";
process.env.VNP_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNP_RETURN_URL = "http://localhost:5000/api/payments/vnpay/return";

function generateTestURL() {
  return createVNPayUrl({
    amount: 250000,
    txnRef: "TEST123456",
    orderInfo: "Test payment",
    ipAddr: "127.0.0.1",
  }).payment_url;
}

// Test 1: Tạo URL có đầy đủ thông tin
test("VNPay tạo URL thanh toán hợp lệ về cấu trúc", () => {
  const url = new URL(generateTestURL());

  assert.equal(url.searchParams.get("vnp_Amount"), "25000000");

  assert.equal(url.searchParams.get("vnp_TxnRef"), "TEST123456");

  assert.equal(url.searchParams.get("vnp_Version"), "2.1.0");

  assert.ok(url.searchParams.get("vnp_SecureHash"));
});

// Test 2: Chữ ký do Service tạo phải xác minh được
test("VNPay xác minh chữ ký hợp lệ", () => {
  const url = new URL(generateTestURL());

  const query = Object.fromEntries(url.searchParams.entries());

  assert.equal(verifyVNPaySignature(query), true);
});

// Test 3: Thay đổi số tiền phải làm chữ ký sai
test("VNPay từ chối dữ liệu bị chỉnh sửa", () => {
  const url = new URL(generateTestURL());

  const query = Object.fromEntries(url.searchParams.entries());

  query.vnp_Amount = "99999900";

  assert.equal(verifyVNPaySignature(query), false);
});

// Test 4: Thiếu chữ ký phải bị từ chối
test("VNPay từ chối request thiếu chữ ký", () => {
  const url = new URL(generateTestURL());

  const query = Object.fromEntries(url.searchParams.entries());

  delete query.vnp_SecureHash;

  assert.equal(verifyVNPaySignature(query), false);
});
