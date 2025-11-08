import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
    },
    lateFee: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["PAID", "UNPAID", "PENDING", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    method: {
      type: String,
      enum: ["UPI", "Credit Card", "Debit Card", "Net Banking", "Cash on Delivery", "Credit"],
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: null, 
    },
    paymentDetails: {
      utrNumber: String,
      screenshot: String,
      notes: String,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ transactionId: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;