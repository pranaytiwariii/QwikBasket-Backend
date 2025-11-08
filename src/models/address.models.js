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
            enum: ["Home", "Work", "Other"],
            default: "Home",
        },
        location: {
            latitude: { type: Number },
            longitude: { type: Number },
        },
        isDefault: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default model("Address", deliveryAddressSchema);
