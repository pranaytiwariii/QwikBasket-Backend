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

  // The actual number of packs in stock (e.g., 150). For internal stock management.
  quantityAvailable: {
    type: Number,
    required: true,
  },

  // The display text for the pack size (e.g., "500 gms"). For the customer to see.
  quantity: {
    type: String,
    required: true,
  },
  weightInKg: { type: Number, default: 0 }, //for eg if quantity shown is 500gms then weightInKg will be 0.5
  pricePerKg: { type: Number, required: true },
  info: {
    origin: { type: String },
    hybrid: { type: String },
    sellerFSSAI: { type: String },
    description: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", ProductSchema);
