import { isDeepStrictEqual } from "node:util";
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPayment extends Document {
  order_id: Types.ObjectId;
  payment_method: "PayOS" | "VNPay" | "SePay" | "MoMo" | "BankTransfer";
  transaction_id: string;
  momo_transaction_id?: string;
  sepay_payment_code?: string;
  sepay_bank_code?: string;
  sepay_account_number?: string;
  sepay_account_name?: string;
  sepay_event_id?: string;
  sepay_checked_at?: Date;
  status: "pending" | "success" | "failed";
  payment_url: string;
  paid_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    payment_method: {
      type: String,
      enum: ["PayOS", "VNPay", "SePay", "MoMo", "BankTransfer"],
      required: true,
    },
    transaction_id: { type: String, default: "" },
    momo_transaction_id: String,
    sepay_payment_code: String,
    sepay_bank_code: String,
    sepay_account_number: String,
    sepay_account_name: String,
    sepay_event_id: String,
    sepay_checked_at: Date,
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    // FIX: Không required nữa, mặc định rỗng cho BankTransfer
    payment_url: { type: String, default: "" },
    paid_at: { type: Date, default: null },
  },
  { autoIndex: false, timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);
// Mỗi đơn hàng chỉ có một yêu cầu BankTransfer.
// Mỗi đơn hàng chỉ có một Payment
// cho mỗi phương thức thanh toán.
paymentSchema.index(
  { order_id: 1, payment_method: 1 },
  {
    unique: true,
    name: "unique_order_payment_method",
  },
);
paymentSchema.index(
  { transaction_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      payment_method: "VNPay",
    },
    name: "unique_vnpay_transaction",
  },
);

paymentSchema.index(
  { order_id: 1 },
  {
    unique: true,
    name: "unique_vnpay_order",
    partialFilterExpression: {
      payment_method: "VNPay",
    },
  },
);
paymentSchema.index({ transaction_id: 1 }, {
  unique: true,
  partialFilterExpression: { payment_method: "BankTransfer", status: "success", transaction_id: { $gt: "" } },
  name: "unique_bank_transfer_transaction",
});
paymentSchema.index({ momo_transaction_id: 1 }, {
  unique: true,
  partialFilterExpression: { payment_method: "MoMo", momo_transaction_id: { $type: "string" } },
  name: "unique_momo_provider_transaction",
});
paymentSchema.index({ sepay_payment_code: 1 }, {
  unique: true,
  partialFilterExpression: { payment_method: "SePay", sepay_payment_code: { $type: "string" } },
  name: "unique_sepay_payment_code",
});
paymentSchema.index({ sepay_event_id: 1 }, {
  unique: true,
  partialFilterExpression: { payment_method: "SePay", sepay_event_id: { $type: "string" } },
  name: "unique_sepay_webhook_event",
});
paymentSchema.index({ sepay_bank_code: 1, sepay_account_number: 1, transaction_id: 1 }, {
  unique: true,
  partialFilterExpression: { payment_method: "SePay", status: "success" },
  collation: { locale: "en", strength: 2 },
  name: "unique_sepay_bank_transaction",
});
const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

export async function ensurePaymentIndexes() {
  await Payment.init();
  for (const [keys, options] of paymentSchema.indexes()) {
    try {
      await Payment.collection.createIndex(keys as mongoose.mongo.IndexSpecification, options as mongoose.mongo.CreateIndexesOptions);
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 85) throw error;

      // Dữ liệu cũ có thể dùng tên MongoDB sinh tự động, ví dụ transaction_id_1.
      const indexes = await Payment.collection.listIndexes().toArray();
      const equivalent = indexes.some((existing) =>
        isDeepStrictEqual(Object.entries(existing.key), Object.entries(keys)) &&
        Boolean(existing.unique) === Boolean(options.unique) &&
        Boolean(existing.sparse) === Boolean(options.sparse) &&
        isDeepStrictEqual(existing.partialFilterExpression, options.partialFilterExpression) &&
        (options.collation
          ? Object.entries(options.collation).every(([key, value]) => existing.collation?.[key] === value)
          : !existing.collation),
      );
      if (!equivalent) throw error;
    }
  }
}

export default Payment;
