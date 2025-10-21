import mongoose from "mongoose";
import { model,Schema } from "mongoose";
// A sub schema for items within an order
const OrderItemSchema=new Schema({
    productId:{
        type:Schema.Types.ObjectId,
        ref:"Product",
        required:true,
    },
    quantity:{
        type:Number,
        required:true,
        min:1,
    },
    price:{
        type:Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    }
});
// A sub schema for tracking the order history
const OrderStatusHistorySchema=new Schema({
    status:{
        type:String,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    notes:{ // If customer delayed delivery
        type:String,
    }
}, { _id: false });

const OrderSchema=new Schema({
    orderId:{
        type:String,
        required:true,
        unique:true,
    },
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    items:[OrderItemSchema],
    totalAmount:{
        type:Number,
        required:true,
    },
    shippingAddress: {
        completeAddress: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true },
        state: { type: String, required: true },
        landmark: { type: String },
    },
    paymentDetails:{
        paymentMethod:{
            type:String,
            required:true,
            enum:["Credit Card", "UPI", "Cash on Delivery", "Net Banking"],
        },
        paymentId:{type:String},
        paymentStatus:{
            type:String,
            required:true,
            enum: ["Pending", "Completed", "Failed", "Refunded"],
            default:"Pending"
        },
    },
    status:{
        type:String,
        required:true,
        enum:[
            "Pending",
            "Confirmed",
            "Shipped",
            "Out for delivery",
            "Delivered",
            "Cancelled",
        ],
        default:"Pending",
    },
    orderProgress:[OrderStatusHistorySchema],
    invoiceUrl:{
        type:String,
    }
},{timestamps:true});
export default mongoose.model("Order",OrderSchema);