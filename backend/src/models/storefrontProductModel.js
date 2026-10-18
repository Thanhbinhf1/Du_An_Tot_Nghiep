import mongoose, { Schema, Types } from "mongoose";
const storefrontProductSchema = new Schema({
    category_id: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true },
    color: { type: String, required: true, trim: true },
    sizes: { type: [String], required: true, default: [] },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true, trim: true },
    rating: { type: Number, default: 5, min: 0, max: 5 },
}, { timestamps: true });
const StorefrontProduct = mongoose.model("StorefrontProduct", storefrontProductSchema);
export default StorefrontProduct;
//# sourceMappingURL=storefrontProductModel.js.map