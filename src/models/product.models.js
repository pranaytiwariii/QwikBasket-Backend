import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }],
  imageColour: { type: String },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubCategory",
  },

  // Unit type.If the default unit is in gms then only the conversion from gms to kg will be allowed.Kg to gms will not be allowed.
  defaultUnit: {
    type: String,
    enum: ["gms", "kg", "ltr"],
    required: true,
  },

  //Price per kg or price per ltr
  pricePerKg: { type: Number, default: 0, required: true },

  // Stock in KG (for solids) or liters (for liquids)
  stockQuantity: { type: Number, required: true },

//This will be the minimum packaging quantity.User can choose to buy more than this quantity.For eg if the packaging quantity is 500 gms, user can buy 1000 gms, 1500 gms, 2000 gms, etc.
  packagingQuantity: { type: Number, required: true },

  origin: { type: String, required: true },
  hybrid: { type: String, required: true },
  sellerFssai: { type: String, required: true },
  description: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", ProductSchema);
