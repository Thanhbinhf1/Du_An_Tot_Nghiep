import mongoose, { Schema, type Types } from "mongoose";

interface InventoryMovementData {
  variant_id: Types.ObjectId; order_id?: Types.ObjectId | null; actor_id: Types.ObjectId;
  kind: "return_inspection" | "quarantine_release" | "quarantine_disposal" | "adjustment" | "initial_stock";
  stock_delta: number; quarantine_delta?: number; note: string; created_at?: Date;
}

export default mongoose.model<InventoryMovementData>("InventoryMovement", new Schema<InventoryMovementData>({
  variant_id: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true, index: true },
  order_id: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  actor_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  kind: { type: String, enum: ["return_inspection", "quarantine_release", "quarantine_disposal", "adjustment", "initial_stock"], required: true },
  stock_delta: { type: Number, required: true },
  quarantine_delta: { type: Number, default: 0 },
  note: { type: String, required: true, maxlength: 2000 },
}, { timestamps: { createdAt: "created_at", updatedAt: false } }));
