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
    refreshToken : {
        type: String,
    },
    status : {
        type: String,
        enum: [ 'new' , 'exists' ,'pending', "approved"],
        default: 'new'
    },
    cart: {
        type: Schema.Types.ObjectId,
        ref:"Cart"
    },
},{
    timestamps: true
});

const User = model('User' , userSchema);

export default User;