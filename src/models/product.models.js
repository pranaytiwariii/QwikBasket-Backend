import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "Black Pepper"
  images: [{ type: String }],
  imageColour: { type: String },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // Links to a 'Category' document
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory", // Links to 'SubCategory' document
  },

  quantityAvailable: { type: Number, required: true },
  quantity: { type: String, required: true },
  weightInKg: { type: Number, default: 0 },
  pricePerKg: { type: Number, required: true },
  info: {
    origin: { type: String },
    hybrid: { type: String },
    sellerFSSAI: { type: String },
    description: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", ProductSchema);