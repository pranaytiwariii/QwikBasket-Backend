import { model, Schema } from "mongoose";

const businessDetailsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
    businessName: { type: String, required: function() { 
      // Only required if user is a business customer
      return this.userId && this.userId.customerType === 'business';
    }},
    businessType: {
      type: String,
      required: function() { 
        return this.userId && this.userId.customerType === 'business';
      },
      enum: ["restaurant", "canteen", "retailer", "business", "others", "hotel"],
      // lowercase: true,
      // trim: true
    },
    gstNumber: { type: String, required: function() { 
      return this.userId && this.userId.customerType === 'business';
    }},
    fssaiLicense: { type: String },
  },
  {
    timestamps: true,
  }
);

const BusinessDetails = model("businessDetails", businessDetailsSchema);

export default BusinessDetails;
