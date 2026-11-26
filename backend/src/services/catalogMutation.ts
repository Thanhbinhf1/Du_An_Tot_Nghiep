import { createHash } from "node:crypto";
import mongoose, { type ClientSession, type Types } from "mongoose";
import Mutex from "../models/catalogMutexModel.js";
import Receipt from "../models/catalogWriteReceiptModel.js";
import { AppError } from "../middlewares/AppError.js";

export async function lockCategoryTree(session: ClientSession) {
  await Mutex.findOneAndUpdate({ _id: "categories" }, { $inc: { revision: 1 } }, { upsert: true, session, returnDocument: "after" });
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export async function catalogMutation(input: { actor: Types.ObjectId; kind: "product" | "category"; key: unknown; body: unknown }, work: (session: ClientSession) => Promise<Types.ObjectId>) {
  if (typeof input.key !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(input.key)) throw new AppError("Cần mã yêu cầu lưu hợp lệ để chống gửi trùng.", 400);
  const filter = { actor_id: input.actor, kind: input.kind, request_key: input.key };
  const hash = createHash("sha256").update(JSON.stringify(canonical(input.body))).digest("hex");
  const match = (receipt: { payload_hash: string; resource_id: Types.ObjectId }) => {
    if (receipt.payload_hash !== hash) throw new AppError("Mã yêu cầu đã dùng với nội dung khác. Kiểm tra kết quả cũ trước khi tạo yêu cầu mới.", 409);
    return { id: receipt.resource_id, replayed: true };
  };
  try {
    return await mongoose.connection.transaction(async (session) => {
      const receipt = await Receipt.findOne(filter).session(session).lean();
      if (receipt) return match(receipt);
      const id = await work(session);
      await Receipt.create([{ ...filter, payload_hash: hash, resource_id: id }], { session });
      return { id, replayed: false };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const receipt = await Receipt.findOne(filter).lean();
      if (receipt) return match(receipt);
    }
    throw error;
  }
}
