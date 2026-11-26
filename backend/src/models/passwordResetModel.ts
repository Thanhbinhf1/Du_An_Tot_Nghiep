import mongoose, { Schema, Types } from "mongoose";

interface IPasswordReset {
  _id: string;
  request_id: string;
  code_hash: string;
  user_id: Types.ObjectId | null;
  session_version: number;
  attempts: number;
  requested_at: Date;
  expires_at: Date;
}

const schema = new Schema<IPasswordReset>({
  _id: { type: String, required: true },
  request_id: { type: String, required: true },
  code_hash: { type: String, required: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
  session_version: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  requested_at: { type: Date, required: true },
  expires_at: { type: Date, required: true },
}, { versionKey: false });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IPasswordReset>("PasswordReset", schema);
