import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  expires_at: { type: Date, required: true },
}, { versionKey: false });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PasswordResetLimit", schema);
