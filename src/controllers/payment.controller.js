import mongoose from "mongoose";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../models/order.models.js"
import Address from "../models/address.models.js"
import Cart from "../models/cart.models.js"
import Product from "../models/product.models.js"
import Payment from "../models/payment.models.js";
import dotenv from "dotenv";
dotenv.config();


const generateOrderId = async () => {
  
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const count = await Order.countDocuments({
      createdAt: { $gte: new Date(yyyy, mm - 1, dd) }
    });
    const sequentialId = String(count + 1).padStart(4, '0');
  
    return `ORD-${yyyy}${mm}${dd}-${sequentialId}`;
  };
  const mapPaymentMethod = (frontendKey) => {
    const map = {
      'credit': 'Credit Card', 
      'gpay': 'UPI',
      'paytm': 'UPI',
      'hdfcUpi': 'UPI',
      'newUpi': 'UPI',
      'netbanking': 'Net Banking',
    };
    return map[frontendKey] || 'Cash on Delivery'; 
  };
  const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

 // 1. ENDPOINT: Create Razorpay Order
export const createRazorpayOrder=async(req,res)=>{
    const { amount, currency } = req.body;
    const options = {
        amount: amount, 
        currency: currency,
        receipt: `receipt_order_${new Date().getTime()}`
      };
      try {
        const order = await razorpayInstance.orders.create(options);
        if (!order) {
          return res.status(500).json({ success: false, message: 'Razorpay order creation failed' });
        }
        
        res.json({ success: true, order }); 
      } catch (error) {
        console.error('Razorpay Create Order Error:', error);
        res.status(500).json({ success: false, message: "Could not create Razorpay order" });
      }
}


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
// 3. Create Pending Order (for UPI payments awaiting verification)
export const createPendingOrder = async (req, res) => {
  const { orderId, userId, addressId, paymentSummary, paymentMethod } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: userId }).populate("items.productId").session(session);
    const address = await Address.findById(addressId).session(session);
    const user = await User.findById(userId).session(session);

    if (!cart || cart.items.length === 0) throw new Error("Cart is empty");
    if (!address) throw new Error("Address not found");
    if (!user) throw new Error("User not found");

    const orderItems = cart.items.map(item => {
      const product = item.productId;
      const unitPrice = product.weightInKg * product.pricePerKg;
      return {
        productId: product._id,
        quantity: item.quantity,
        price: unitPrice,
        name: product.name,
      };
    });

    const shippingAddress = {
      completeAddress: address.completeAddress,
      city: address.city,
      pincode: address.pincode,
      state: address.state,
      landmark: address.landmark,
    };

    const newOrder = new Order({
      orderId: await generateOrderId(),
      userId: userId,
      items: orderItems,
      totalAmount: paymentSummary.totalAmount,
      shippingAddress: shippingAddress,
      paymentDetails: {
        paymentMethod: mapPaymentMethod(paymentMethod),
        paymentStatus: "Pending",
      },
      status: "Pending",
      orderProgress: [
        { status: "Pending", notes: "Awaiting payment verification" }
      ],
    });

    await newOrder.save({ session });

    // Create pending payment
    const newPayment = new Payment({
      orderId: newOrder._id,
      userId: userId,
      transactionId: await generatePaymentId(),
      amount: paymentSummary.totalAmount,
      status: "PENDING",
      method: mapPaymentMethod(paymentMethod),
      date: new Date(),
    });

    await newPayment.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      order: newOrder,
      payment: newPayment,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in createPendingOrder:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};

// 4. Get All Payments (For Admin)
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'userId',
        select: 'name email phone'
      })
      .populate({
        path: 'orderId',
        select: 'orderId items'
      })
      .sort({ createdAt: -1 });

    const formattedPayments = payments.map(payment => {
      const user = payment.userId;
      const order = payment.orderId;
      
      // Get product name from first item in order
      const productName = order?.items?.[0]?.name || 'N/A';
      const unitPrice = order?.items?.[0]?.price || 0;

      return {
        id: payment._id.toString(),
        transactionId: payment.transactionId,
        orderId: order?.orderId || 'N/A',
        customerName: user?.name || 'Unknown',
        email: user?.email || 'N/A',
        phone: user?.phone || 'N/A',
        amount: payment.amount,
        creditAmount: payment.creditAmount || 0,
        lateFee: payment.lateFee || 0,
        status: payment.status,
        method: payment.method,
        date: payment.date.toLocaleDateString('en-GB'),
        time: payment.date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        dueDate: payment.dueDate ? payment.dueDate.toLocaleDateString('en-GB') : 'N/A',
        productName: productName,
        unitPrice: unitPrice,
      };
    });

    res.json({
      success: true,
      payments: formattedPayments,
    });
  } catch (error) {
    console.error("Error in getAllPayments:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch payments",
    });
  }
};

// 5. Get Payment By ID (For Admin Detail View)
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate({
        path: 'userId',
        select: 'name email phone'
      })
      .populate({
        path: 'orderId',
        select: 'orderId items'
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const user = payment.userId;
    const order = payment.orderId;
    const productName = order?.items?.[0]?.name || 'N/A';
    const unitPrice = order?.items?.[0]?.price || 0;

    const formattedPayment = {
      id: payment._id.toString(),
      transactionId: payment.transactionId,
      orderId: order?.orderId || 'N/A',
      customerName: user?.name || 'Unknown',
      email: user?.email || 'N/A',
      phone: user?.phone || 'N/A',
      amount: payment.amount,
      creditAmount: payment.creditAmount || 0,
      lateFee: payment.lateFee || 0,
      status: payment.status,
      method: payment.method,
      date: payment.date.toLocaleDateString('en-GB'),
      time: payment.date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      dueDate: payment.dueDate ? payment.dueDate.toLocaleDateString('en-GB') : 'N/A',
      productName: productName,
      unitPrice: unitPrice,
    };

    res.json({
      success: true,
      payment: formattedPayment,
    });
  } catch (error) {
    console.error("Error in getPaymentById:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch payment details",
    });
  }
};

// 6. Get Payment Summary (For Admin Dashboard)
export const getPaymentSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Aggregate payment data
    const summary = await Payment.aggregate([
      {
        $facet: {
          pendingAmount: [
            { $match: { status: "UNPAID" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          paidToday: [
            {
              $match: {
                status: "PAID",
                date: { $gte: today, $lt: tomorrow }
              }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          overdue: [
            {
              $match: {
                status: "UNPAID",
                dueDate: { $lt: today }
              }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ],
          totalRevenue: [
            { $match: { status: "PAID" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ]
        }
      }
    ]);

    const result = {
      pendingAmount: summary[0].pendingAmount[0]?.total || 0,
      paidToday: summary[0].paidToday[0]?.total || 0,
      overdue: summary[0].overdue[0]?.total || 0,
      totalRevenue: summary[0].totalRevenue[0]?.total || 0,
    };

    res.json({
      success: true,
      summary: result,
    });
  } catch (error) {
    console.error("Error in getPaymentSummary:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch payment summary",
    });
  }
};

// 7. Update Payment Status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["PAID", "UNPAID", "PENDING", "FAILED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const payment = await Payment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Update related order if payment is now PAID
    if (status === "PAID") {
      await Order.findByIdAndUpdate(payment.orderId, {
        "paymentDetails.paymentStatus": "Completed",
        status: "Confirmed"
      });
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
      payment,
    });
  } catch (error) {
    console.error("Error in updatePaymentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Could not update payment status",
    });
  }
};

// 8. Delete Payment
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePayment:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete payment",
    });
  }
};

// 9. Check Credit Status (For Outstanding Payment Modal)
export const checkCreditStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date();

    const overduePayment = await Payment.findOne({
      userId: userId,
      status: "UNPAID",
      dueDate: { $lt: today }
    });

    if (overduePayment) {
      // Calculate late fee (example: 2% of amount per day overdue)
      const daysOverdue = Math.floor((today - overduePayment.dueDate) / (1000 * 60 * 60 * 24));
      const lateFee = Math.round(overduePayment.amount * 0.02 * daysOverdue);

      res.json({
        success: true,
        isOverdue: true,
        amount: overduePayment.amount,
        lateFee: lateFee,
        paymentId: overduePayment._id,
      });
    } else {
      res.json({
        success: true,
        isOverdue: false,
        amount: 0,
        lateFee: 0,
      });
    }
  } catch (error) {
    console.error("Error in checkCreditStatus:", error);
    res.status(500).json({
      success: false,
      message: "Could not check credit status",
    });
  }
};

// 10. Complete Credit Payment (Pay overdue)
export const completeCreditPayment = async (req, res) => {
  const { paymentId, razorpay_payment_id, razorpay_order_id } = req.body;

  try {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.status = "PAID";
    payment.transactionId = razorpay_payment_id;
    payment.razorpayOrderId = razorpay_order_id;
    await payment.save();

    // Update order status
    await Order.findByIdAndUpdate(payment.orderId, {
      "paymentDetails.paymentStatus": "Completed",
      "paymentDetails.paymentId": razorpay_payment_id,
      status: "Confirmed"
    });

    res.json({
      success: true,
      message: "Credit payment completed successfully",
      payment,
    });
  } catch (error) {
    console.error("Error in completeCreditPayment:", error);
    res.status(500).json({
      success: false,
      message: "Could not complete credit payment",
    });
  }
};