import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/order.models.js"
import Address from "../models/address.models.js"
import Cart from "../models/cart.models.js"
import Product from "../models/product.models.js"

// 2. ENDPOINT: Verify Payment & Create *Your* Order

export const verifyPaymentAndCreateOrder=async(req,res)=>{
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        userId,
        addressId,
        paymentMethod,
        paymentSummary} = req.body;

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');
      
        if (generated_signature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
    const session=await mongoose.startSession();
    session.startTransaction();
    try {
        const cart=await Cart.findOne({user:userId}).populate("items.productId").session(session);
        const address=await Address.findById(addressId).session(session);
        if (!cart || cart.items.length === 0) throw new Error("Cart is empty");
        if (!address) throw new Error("Address not found");
        const stockIssues=[];
        const orderItems=cart.items.map(item=>{
            const product=item.productId;
            if (!product) throw new Error(`Product not found`);
            if (product.quantityAvailable < item.quantity) {
                stockIssues.push(`${product.name} only has ${product.quantityAvailable} in stock.`);
              }
            const unitPrice = product.weightInKg * product.pricePerKg;
            return {
                productId: product._id,
                quantity: item.quantity,
                price: unitPrice, 
                name: product.name,
              };
        });
        if (stockIssues.length > 0) {
            throw new Error(`Stock issue: ${stockIssues.join(", ")}`);
          }
          const shippingAddress = {
            completeAddress: address.completeAddress,
            city: address.city,
            pincode: address.pincode,
            state: address.state,
            landmark: address.landmark,
          };
          const paymentDetails = {
            paymentMethod: mapPaymentMethod(paymentMethod),
            paymentId: razorpay_payment_id,
            paymentStatus: "Completed",
            paymentInfo: razorpay_order_id
          };
          const newOrder = new Order({
            orderId: await generateOrderId(),
            userId: userId,
            items: orderItems,
            totalAmount: paymentSummary.totalAmount,
            shippingAddress: shippingAddress,
            paymentDetails: paymentDetails,
            status: "Confirmed",
            orderProgress: [
              { status: "Pending", notes: "Order placed by customer" },
              { status: "Confirmed", notes: "Payment received" }
            ],
          });
          await newOrder.save({ session });
          const stockUpdates = cart.items.map(item => ({
            updateOne: {
              filter: { _id: item.productId._id },
              update: { $inc: { quantityAvailable: -item.quantity } },
            },
          }));
          await Product.bulkWrite(stockUpdates, { session });
          await Cart.deleteOne({ user: userId }, { session });
          await session.commitTransaction();
          res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order: newOrder,
          });
    } catch (error) {
    await session.abortTransaction();
    console.error("Error in verifyPaymentAndCreateOrder:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
    }
    finally{
        session.endSession();
    }

}