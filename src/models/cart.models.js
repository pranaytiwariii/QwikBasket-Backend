import mongoose from "mongoose";
import Product from "./product.models.js";

const CartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    // Quantity in packets (number of packets)
    type: Number,
    required: true,
  },
  price: {
    // Price per packet * quantity in packets (calculated and stored when item is added)
    type: Number,
    required: true,
  },
});

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Each user has only one cart
    },
    items: [CartItemSchema],
    totalItems: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Cart", CartSchema);
