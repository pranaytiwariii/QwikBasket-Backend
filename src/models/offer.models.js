import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, "Offer image is required"],
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: "Please provide a valid image URL",
      },
    },
    date: {
      type: Date,
      required: [true, "Offer date is required"],
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: [true, "Offer expiry date is required"],
      validate: {
        validator: function (v) {
          return v > this.date;
        },
        message: "Expiry date must be after the offer date",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
OfferSchema.index({ date: -1 });
OfferSchema.index({ expiryDate: 1 });

// Virtual to check if offer is currently active
OfferSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  return this.expiryDate > now;
});

// Method to check if offer is expired
OfferSchema.methods.isExpired = function () {
  const now = new Date();
  return this.expiryDate <= now;
};

// Static method to get active offers
OfferSchema.statics.getActiveOffers = function () {
  const now = new Date();
  return this.find({
    expiryDate: { $gt: now },
  }).sort({ date: -1 });
};

// Static method to get expired offers
OfferSchema.statics.getExpiredOffers = function () {
  const now = new Date();
  return this.find({
    expiryDate: { $lte: now },
  }).sort({ date: -1 });
};

export default mongoose.model("Offer", OfferSchema);
