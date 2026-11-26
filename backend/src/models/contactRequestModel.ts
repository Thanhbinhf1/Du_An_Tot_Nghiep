import mongoose, { Schema } from "mongoose";

export const contactTopics = ["don-hang", "san-pham", "doi-tra", "tai-khoan", "khac"] as const;

const contactRequestSchema = new Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254 },
  topic: { type: String, required: true, enum: contactTopics },
  message: { type: String, required: true, maxlength: 3000 },
  status: { type: String, enum: ["new", "resolved"], default: "new" },
  handled_by: { type: Schema.Types.ObjectId, ref: "User" },
  handled_at: Date,
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

contactRequestSchema.index({ created_at: -1, _id: -1 });
contactRequestSchema.index({ status: 1, created_at: -1, _id: -1 });
export default mongoose.model("ContactRequest", contactRequestSchema);
