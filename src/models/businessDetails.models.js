import {model, Schema} from "mongoose";

const businessDetailsSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    name: {type: String, required: true},
    email: {type: String, required: true},
    businessName: {type: String, required: true},
    businessType: {
        type: String,
        required: true,
        enum: ['restaurant', 'hotel', 'cafeteria'],
        // lowercase: true,
        // trim: true
    },
    gstNumber: {type: String, required: true},
    fssaiLicense: {type: String}
}, {
    timestamps: true
});

const BusinessDetails = model('businessDetails', businessDetailsSchema);

export default BusinessDetails;