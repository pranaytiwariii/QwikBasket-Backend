import { model,Schema} from "mongoose";

const deliveryAddressSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        completeAddress: {
            type: String,
            required: true,
            trim: true,
        },
        landmark: {
            type: String,
            trim: true,
        },
        pincode: {
            type: String,
            required: true,
            match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: String,
            required: true,
            trim: true,
        },
        addressNickname: {
            type: String,
            enum: ["Home", "Office", "Other"],
            default: "Home",
        },
        location: {
            latitude: { type: Number },
            longitude: { type: Number },
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default model("Address", deliveryAddressSchema);
