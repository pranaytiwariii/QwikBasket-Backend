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

  //This is the price for the business user per packet
  price: { type: Number, default: 0, required: true },
  
  //This is the MRP price for the product
  mrpPrice: { type: Number, default: 0, required: true },

  showToCustomer: { type: Boolean, default: false },
  priceForCustomer: { type: Number, required: true },
  // Stock of packets in the warehouse
  stockInPackets: { type: Number, required: true },

  //Quantity per package
  packagingQuantity: { type: Number, required: true },
  unit: {
    type: String,
    enum: ["gms", "kg", "ltr"],
    required: true,
  },
  //pack text = {packagingQuantity} {unit}

  origin: { type: String, required: true },
  hybrid: { type: String, required: true },
  sellerFssai: { type: String, required: true },
  description: { type: String, required: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", ProductSchema);
