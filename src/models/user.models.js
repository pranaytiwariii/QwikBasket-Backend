import { model , Schema} from "mongoose";

const userSchema = new Schema({
    phone : {
        type: String,
        required: true,
        unique: true,
        // match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"]
    },
    isVerified : {
        type: Boolean,
        default: false
    },
    userType: {
        type: String,
        enum: ["user", "admin" , "Delivery"],
        default: "user"
    },
    customerType: {
        type: String,
        enum: ["normal", "business"],
        default: null
    },
    refreshToken : {
        type: String,
    },
    status : {
        type: String,
        enum: [ 'new' , 'exists' ,'pending', "approved" , "rejected"],
        default: 'new'
    },
    discount: {
        type: Number,
        default: 0
    },
    creditDays : {
        type: Number,
        default: 0
    },
    cart: {
        type: Schema.Types.ObjectId,
        ref: "Cart"
    },
}, {
    timestamps: true
});

const User = model('User' , userSchema);

export default User;