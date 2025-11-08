import { model, Schema } from "mongoose";

const pincodeSchema = new Schema(
  {
    pincode: {
      type: String,
      match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
      required: true,
      unique: true,
      trim: true,
    },
    service: {
      type: Boolean,
      default: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Pincode = model("Pincode", pincodeSchema);

export default Pincode;
