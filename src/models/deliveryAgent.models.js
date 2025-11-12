import { model, Schema } from "mongoose";

const deliveryAgentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\+91\d{10}$/, "Please enter a valid 10-digit phone number"],
    },
    loginId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["available", "delivery_assigned", "offline"],
      default: "available",
    },
    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    assignedOrders: [
      {
        orderId: {
          type: Schema.Types.ObjectId,
          ref: "Order",
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        completedAt: {
          type: Date,
        },
        status: {
          type: String,
          enum: ["assigned", "picked_up", "in_transit", "delivered", "cancelled"],
          default: "assigned",
        },
      },
    ],
    vehicleType: {
      type: String,
      enum: ["bike", "scooter", "bicycle", "car", "van"],
      default: "bike",
    },
    vehicleNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
  },
  { 
    timestamps: true 
  }
);

// Index for faster queries
deliveryAgentSchema.index({ phone: 1 });
deliveryAgentSchema.index({ status: 1 });
deliveryAgentSchema.index({ loginId: 1 })
deliveryAgentSchema.index({ isActive: 1 });

const DeliveryAgent = model("DeliveryAgent", deliveryAgentSchema);

export default DeliveryAgent;
