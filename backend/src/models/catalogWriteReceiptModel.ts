import mongoose, { Schema, type Types } from "mongoose";
interface Receipt { actor_id: Types.ObjectId; kind: "product" | "category"; request_key: string; payload_hash: string; resource_id: Types.ObjectId; created_at?: Date }
const schema = new Schema<Receipt>({ actor_id: { type: Schema.Types.ObjectId, required: true }, kind: { type: String, enum: ["product", "category"], required: true }, request_key: { type: String, required: true, maxlength: 100 }, payload_hash: { type: String, required: true }, resource_id: { type: Schema.Types.ObjectId, required: true } }, { timestamps: { createdAt: "created_at", updatedAt: false } });
schema.index({ actor_id: 1, kind: 1, request_key: 1 }, { unique: true });
export default mongoose.model<Receipt>("CatalogWriteReceipt", schema);
