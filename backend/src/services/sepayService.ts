import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { getSePayConfig } from "../config/sepayConfig.js";
import { AppError } from "../middlewares/AppError.js";
import Order, { type IOrder } from "../models/orderModel.js";
import Payment from "../models/paymentModel.js";

type SePayTransfer = {
  eventId?: string;
  paymentCode: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  reference: string;
};

function paymentCode(code: unknown, content: unknown) {
  const codes = new Set(typeof content === "string"
    ? Array.from(content.toUpperCase().matchAll(/(?:^|[^A-Z0-9])(FS[0-9]{12})(?=$|[^A-Z0-9])/g), (match) => match[1])
    : []);
  if (typeof code === "string" && /^FS[0-9]{12}$/i.test(code)) codes.add(code.toUpperCase());
  return codes.size === 1 ? Array.from(codes)[0] : undefined;
}

export async function createSePayCheckout(order: IOrder) {
  const config = getSePayConfig();
  if (!Number.isSafeInteger(order.final_amount) || order.final_amount <= 0) {
    throw new AppError("Số tiền thanh toán SePay không hợp lệ.", 400);
  }
  const filter = { order_id: order._id, payment_method: "SePay" as const };
  const payment = await Payment.findOneAndUpdate(filter, {
    $setOnInsert: {
      sepay_payment_code: `FS${randomInt(100_000_000_000, 1_000_000_000_000)}`,
      sepay_bank_code: config.bankCode,
      sepay_account_number: config.accountNumber,
      sepay_account_name: config.accountName,
      status: "pending",
    },
  }, { upsert: true, returnDocument: "after", runValidators: true }).catch(async (error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const existing = await Payment.findOne(filter);
      if (existing) return existing;
      throw new AppError("Chưa thể tạo mã thanh toán. Vui lòng thử lại trên đơn này.", 409);
    }
    throw error;
  });
  if (payment.status !== "pending") throw new AppError("Yêu cầu thanh toán đã được xử lý.", 409);
  if (!payment.sepay_payment_code || !payment.sepay_bank_code || !payment.sepay_account_number || !payment.sepay_account_name) {
    throw new AppError("Thông tin thanh toán SePay của đơn hàng chưa đầy đủ.", 409);
  }
  // VietinBank chỉ đồng bộ các giao dịch bắt đầu bằng SEVQR.
  const transferContent = payment.sepay_bank_code.toLowerCase() === "vietinbank"
    ? `SEVQR ${payment.sepay_payment_code}`
    : payment.sepay_payment_code;
  const qr = new URL("https://qr.sepay.vn/img");
  qr.search = new URLSearchParams({
    acc: payment.sepay_account_number,
    bank: payment.sepay_bank_code,
    amount: String(order.final_amount),
    des: transferContent,
    template: "qronly",
  }).toString();
  return {
    payment_id: String(payment._id),
    order_id: String(order._id),
    amount: order.final_amount,
    payment_method: "SePay",
    qr_url: qr.href,
    transfer_content: transferContent,
    bank: {
      bank_name: payment.sepay_bank_code,
      account_number: payment.sepay_account_number,
      account_name: payment.sepay_account_name,
    },
  };
}

async function confirmSePayTransfer(transfer: SePayTransfer) {
  try {
    return await mongoose.connection.transaction(async (session) => {
      const payment = await Payment.findOne({
        payment_method: "SePay",
        sepay_payment_code: transfer.paymentCode,
      }).session(session);
      if (!payment || payment.sepay_account_number !== transfer.accountNumber ||
          payment.sepay_bank_code?.toUpperCase() !== transfer.bankCode.toUpperCase()) return;

      const order = await Order.findById(payment.order_id).session(session);
      if (!order || order.payment_method !== "SePay" || order.final_amount !== transfer.amount ||
          payment.status !== "pending" || order.payment_status !== "pending" || order.order_status !== "pending") return;

      // API v2 dùng UUID, webhook dùng ID số. Mã tham chiếu ngân hàng nối hai luồng này.
      const transactionId = transfer.reference || `SEPAY-${transfer.eventId}`;
      const updated = await Payment.updateOne({
        _id: payment._id, status: "pending",
      }, {
        $set: {
          status: "success",
          transaction_id: transactionId,
          paid_at: new Date(),
          ...(transfer.eventId ? { sepay_event_id: transfer.eventId } : {}),
        },
      }, { session });
      if (updated.matchedCount !== 1) throw new Error("Trạng thái thanh toán SePay đã thay đổi.");
      const updatedOrder = await Order.updateOne({
        _id: order._id, order_status: "pending", payment_status: "pending",
      }, {
        $set: { payment_status: "success", transaction_id: transactionId },
      }, { session });
      if (updatedOrder.matchedCount !== 1) throw new Error("Trạng thái đơn hàng đã thay đổi.");
    });
  } catch (error) {
    // Unique index ngăn một giao dịch ngân hàng thanh toán cho hai đơn khác nhau.
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return;
    throw error;
  }
}

export async function receiveSePayWebhook(authorization: string | undefined, body: unknown) {
  const config = getSePayConfig();
  if (!config.webhookApiKey) {
    throw new AppError("Cửa hàng chưa bật xác thực webhook SePay.", 503);
  }
  const suppliedKey = authorization?.match(/^Apikey (.+)$/i)?.[1] ?? "";
  const digest = (key: string) => createHash("sha256").update(key).digest();
  if (!suppliedKey || !timingSafeEqual(digest(suppliedKey), digest(config.webhookApiKey))) {
    throw new AppError("Xác thực webhook SePay không hợp lệ.", 401);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Dữ liệu webhook SePay không hợp lệ.", 400);
  }
  const data = body as Record<string, unknown>;
  if (typeof data.id !== "number" || !Number.isSafeInteger(data.id) || data.id <= 0 ||
      typeof data.transferAmount !== "number" || !Number.isSafeInteger(data.transferAmount) || data.transferAmount <= 0 ||
      typeof data.accountNumber !== "string" || typeof data.gateway !== "string" ||
      typeof data.content !== "string" || !["in", "out"].includes(String(data.transferType)) ||
      typeof data.referenceCode !== "string") {
    throw new AppError("Thông tin giao dịch SePay không hợp lệ.", 400);
  }
  if (data.transferType !== "in") return;
  const code = paymentCode(data.code, data.content);
  if (!code) return;
  await confirmSePayTransfer({
    eventId: String(data.id),
    paymentCode: code,
    amount: data.transferAmount,
    bankCode: data.gateway,
    accountNumber: data.accountNumber,
    reference: data.referenceCode.trim(),
  });
}

export async function reconcileSePayOrder(order: IOrder) {
  const config = getSePayConfig();
  if (!config.apiToken || order.payment_method !== "SePay" || order.payment_status !== "pending") return;
  const payment = await Payment.findOneAndUpdate({
    order_id: order._id,
    payment_method: "SePay",
    status: "pending",
    $or: [
      { sepay_checked_at: { $exists: false } },
      { sepay_checked_at: { $lte: new Date(Date.now() - 15_000) } },
    ],
  }, { $set: { sepay_checked_at: new Date() } });
  if (!payment?.sepay_payment_code) return;

  const url = new URL(`${config.apiBaseUrl}/transactions`);
  url.search = new URLSearchParams({
    transaction_content: payment.sepay_payment_code,
    transfer_type: "in",
    amount_in_min: String(order.final_amount),
    amount_in_max: String(order.final_amount),
    per_page: "100",
  }).toString();
  let transactions: unknown[];
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiToken}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json();
    if (!response.ok || result.status !== "success" || !Array.isArray(result.data)) throw new Error("Invalid SePay response");
    transactions = result.data;
  } catch {
    throw new AppError("SePay chưa phản hồi kiểm tra giao dịch. Vui lòng thử lại sau.", 502);
  }
  for (const data of transactions) {
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const transaction = data as Record<string, unknown>;
    const code = paymentCode(transaction.code, transaction.transaction_content);
    if (code !== payment.sepay_payment_code || transaction.transfer_type !== "in" ||
        typeof transaction.id !== "string" || !transaction.id ||
        transaction.amount_out !== 0 || typeof transaction.amount_in !== "number" || !Number.isSafeInteger(transaction.amount_in) ||
        transaction.amount_in !== order.final_amount || typeof transaction.account_number !== "string" ||
        typeof transaction.bank_brand_name !== "string" ||
        typeof transaction.reference_number !== "string" || !transaction.reference_number.trim()) continue;
    await confirmSePayTransfer({
      paymentCode: code,
      amount: transaction.amount_in,
      bankCode: transaction.bank_brand_name,
      accountNumber: transaction.account_number,
      reference: transaction.reference_number.trim(),
    });
  }
}
