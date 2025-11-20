import mongoose from "mongoose";
import { model, Schema } from "mongoose";
// A sub schema for items within an order
const OrderItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.001, // Allow fractional quantities (in kg/ltr)
  },
  price: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});
// A sub schema for tracking the order history
const OrderStatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      // If customer delayed delivery
      type: String,
    },
  },
  { _id: false }
);

const PickupPointSnapshotSchema = new Schema(
  {
    pickupPointId: {
      type: Schema.Types.ObjectId,
      ref: "PickupPoint",
      required: true,
    },
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [OrderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    fulfillmentType: {
      type: String,
      enum: ["DELIVERY", "PICKUP"],
      default: "DELIVERY",
    },
    shippingAddress: {
      completeAddress: {
        type: String,
        required: function () {
          return this.fulfillmentType === "DELIVERY";
        },
      },
      city: {
        type: String,
        required: function () {
          return this.fulfillmentType === "DELIVERY";
        },
      },
      pincode: {
        type: String,
        required: function () {
          return this.fulfillmentType === "DELIVERY";
        },
      },
      state: {
        type: String,
        required: function () {
          return this.fulfillmentType === "DELIVERY";
        },
      },
      landmark: { type: String },
    },
    pickupPoint: {
      type: PickupPointSnapshotSchema,
      default: null,
    },
    shippingMethod: {
      type: String,
      default: "Standard Delivery",
    },
    paymentDetails: {
      paymentMethod: {
        type: String,
        required: true,
        enum: ["Credit Card", "UPI", "Cash on Delivery", "Net Banking"],
      },
      paymentId: { type: String },
      paymentStatus: {
        type: String,
        required: true,
        enum: ["Pending", "Completed", "Failed", "Refunded"],
        default: "Pending",
      },
      paymentInfo: {
        type: String,
      },
      cardLast4: { type: String },
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Confirmed",
        "Shipped",
        "Out for delivery",
        "Delivered",
        "Cancelled",
        "In Transit",
      ],
      default: "Pending",
    },
    orderProgress: [OrderStatusHistorySchema],
    invoiceUrl: {
      type: String,
    },
    deliveryOtp: {
      type: String,
      required: true,
    },
    deliveryAgentId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryAgent",
      default: null,
    },
  },
  { timestamps: true }
);
export default mongoose.model("Order", OrderSchema);
