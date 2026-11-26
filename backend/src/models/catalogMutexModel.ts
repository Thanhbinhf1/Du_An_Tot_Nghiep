import mongoose, { Schema } from "mongoose";
const schema = new Schema<{ _id: string; revision: number }>({ _id: { type: String, required: true }, revision: { type: Number, default: 0 } }, { versionKey: false });
export default mongoose.model("CatalogMutex", schema);
