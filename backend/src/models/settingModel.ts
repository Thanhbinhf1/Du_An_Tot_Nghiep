import mongoose, { Document, Schema } from "mongoose";

export interface ISetting extends Document {
  key: string;
  value: Record<string, unknown> | string | number | boolean;
  description?: string;
  updated_at: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: { createdAt: false, updatedAt: "updated_at" } },
);

const Setting = mongoose.model<ISetting>("Setting", settingSchema);
export default Setting;
