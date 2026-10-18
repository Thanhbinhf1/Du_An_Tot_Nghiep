import mongoose, { Document, Schema } from "mongoose";
const brandSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    description: {
        type: String,
        default: "",
    },
    logo: {
        type: String,
        default: "",
    },
    status: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
});
const Brand = mongoose.model("Brand", brandSchema);
export default Brand;
//# sourceMappingURL=brandModel.js.map