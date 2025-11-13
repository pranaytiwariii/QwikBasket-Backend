import mongoose from "mongoose";
import Order from "../models/order.models.js";
import Address from "../models/address.models.js";
import Cart from "../models/cart.models.js";
import Product from "../models/product.models.js";
<<<<<<< HEAD
import Payment from "../models/payment.models.js";

=======
import BusinessDetails from "../models/businessDetails.models.js";
import User from "../models/user.models.js";
>>>>>>> ec93d60b1e7218f23377fd0cb72bc1b785292f90
// Helper to generate a unique Order ID
const generateOrderId = async () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  const count = await Order.countDocuments({
    createdAt: { $gte: new Date(yyyy, mm - 1, dd) },
  });
  const sequentialId = String(count + 1).padStart(4, "0");

  return `ORD-${yyyy}${mm}${dd}-${sequentialId}`;
};
const generatePaymentId = async () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  
  const datePrefix = `PAY-${yyyy}${mm}${dd}`;
  
  const latestPayment = await Payment.findOne({ 
    transactionId: { $regex: `^${datePrefix}` } 
  })
  .sort({ transactionId: -1 })
  .select('transactionId');
  
  let sequentialId = 1;
  
  if (latestPayment) {
    const lastSequence = parseInt(latestPayment.transactionId.split('-').pop());
    sequentialId = lastSequence + 1;
  }
  
  return `${datePrefix}-${String(sequentialId).padStart(4, '0')}`;
};
// Helper to generate a 6-digit OTP
const generateDeliveryOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const mapPaymentMethod = (frontendKey) => {
  const map = {
    credit: "Credit Card",
    gpay: "UPI",
    paytm: "UPI",
    hdfcUpi: "UPI",
    newUpi: "UPI",
    netbanking: "Net Banking",
  };
  return map[frontendKey] || "Cash on Delivery";
};

// Endpoint 3: POST /api/orders
export const createOrder = async (req, res) => {
  const { userId, addressId, paymentMethod, paymentSummary } = req.body;

  if (!userId || !addressId || !paymentMethod || !paymentSummary) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required order details" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Cart and Address
    const cart = await Cart.findOne({ user: userId })
      .populate("items.productId")
      .session(session);
    const address = await Address.findById(addressId).session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }
    if (!address) {
      throw new Error("Address not found");
    }

    // 2. Re-validate stock one last time
    const stockIssues = [];
    const orderItems = cart.items.map((item) => {
      const product = item.productId;
      if (!product)
        throw new Error(`Product with ID ${item.productId} not found`);
      if (product.stockInPackets < item.quantity) {
        stockIssues.push(
          `${product.name} only has ${product.stockInPackets} in stock.`
        );
      }
      // Match the OrderItemSchema
      return {
        productId: product._id,
        quantity: item.quantity,
        price: item.price,
        name: product.name,
      };
    });

    if (stockIssues.length > 0) {
      throw new Error(`Stock issue: ${stockIssues.join(", ")}`);
    }

    // 3. Prepare Order document data
    // Match the shippingAddress sub-schema
    const shippingAddress = {
      completeAddress: address.completeAddress,
      city: address.city,
      pincode: address.pincode,
      state: address.state,
      landmark: address.landmark,
    };

    // Match the paymentDetails sub-schema
    const paymentDetails = {
      paymentMethod: mapPaymentMethod(paymentMethod),
      paymentStatus: paymentMethod === "credit" ? "Pending" : "Completed", // 'Pending' for COD/Credit
    };

    // 4. Generate delivery OTP
    const deliveryOtp = generateDeliveryOtp();

    // 5. Create the new Order
    const newOrder = new Order({
      orderId: await generateOrderId(),
      userId: userId,
      items: orderItems,
      totalAmount: paymentSummary.totalAmount, // Use total from validated summary
      shippingAddress: shippingAddress,
      paymentDetails: paymentDetails,
      status: "Pending", // Initial status
      orderProgress: [{ status: "Pending", notes: "Order placed by customer" }],
      deliveryOtp: deliveryOtp,
    });

    await newOrder.save({ session });
    if (mapPaymentMethod(paymentMethod) === "Cash on Delivery") {
      const newPayment = new Payment({
        orderId: newOrder._id,
        userId,
        transactionId: await generatePaymentId(),
        amount: paymentSummary.totalAmount,
        status: "PENDING", 
        method: "Cash on Delivery",
        date: new Date(),
      });
    
      await newPayment.save({ session });
    }

    // 6. Decrement Product stock (using bulkWrite for efficiency)
    const stockUpdates = cart.items.map((item) => ({
      updateOne: {
        filter: { _id: item.productId._id },
        update: { $inc: { stockInPackets: -item.quantity } },
      },
    }));

    await Product.bulkWrite(stockUpdates, { session });

    // 7. Clear the user's cart
    await Cart.deleteOne({ user: userId }, { session });

    // 8. Commit the transaction
    await session.commitTransaction();

    // Create response object without OTP in the order data (for security)
    const orderResponse = newOrder.toObject();
    delete orderResponse.deliveryOtp;

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: {
        order: orderResponse,
        deliveryOtp: deliveryOtp, // OTP only visible to user in response
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    console.error("Error in createOrder:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
// GET all orders (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "phone customerType")
      .sort({ createdAt: -1 });
    const formattedOrders = orders.map((order) => ({
      id: order.orderId,
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      customerPhone: order.userId?.phone || "N/A",
      customerType: order.userId?.customerType || "N/A",
      items: order.items.length,
      amount: order.totalAmount,
      paymentMethod: order.paymentDetails.paymentMethod,
      status: order.status,
      invoiceUrl: order.invoiceUrl || null,
      shippingMethod: order.shippingMethod,
      cardLast4: order.paymentDetails.cardLast4 || "1234",
      productName: order.items[0]?.name || "Multiple Products",
      unitPrice: order.items[0]?.price || 0,
    }));
    res.status(200).json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error("Error getting in all orders", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

// GET single order by ID
export const getOrderById = async (req, res) => {
  try {
    console.log("==============getOrderById==========");
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId })
      .populate("items.productId") // Populate product details for each item
      .populate(
        "deliveryAgentId",
        "name phone email status vehicleType vehicleNumber rating totalDeliveries"
      ); // Populate delivery agent details

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const businessDetails = await BusinessDetails.findOne({
      userId: order.userId,
    });
    const userDetails = await User.findOne({ _id: order.userId });
    
    // Format items with product details
    console.log("==============userDetails==========", userDetails);
    const formattedItems = order.items.map((item) => ({
      productId: item.productId?._id || null,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      productDetails: item.productId
        ? {
            images: item.productId.images || [],
            price: item.productId.price,
            mrpPrice: item.productId.mrpPrice,
            priceForCustomer: item.productId.priceForCustomer,
            unit: item.productId.unit,
          }
        : null,
    }));

    const formattedOrder = {
      id: order.orderId,
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      customerName: businessDetails?.name || "N/A",
      customerEmail: businessDetails?.email || "N/A",
      customerPhone: userDetails?.phone || "N/A",
      customerType: userDetails?.customerType || "N/A",
      items: formattedItems,
      totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
      amount: order.totalAmount,
      paymentMethod: order.paymentDetails.paymentMethod,
      status: order.status,
      invoiceUrl: order.invoiceUrl || null,
      shippingMethod: order.shippingMethod,
      cardLast4: order.paymentDetails.cardLast4 || "1234",
      shippingAddress: order.shippingAddress,
      orderProgress: order.orderProgress,
      deliveryOtp: order.deliveryOtp,
      deliveryAgent: order.deliveryAgentId
        ? {
            id: order.deliveryAgentId._id,
            name: order.deliveryAgentId.name,
            phone: order.deliveryAgentId.phone,
            status: order.deliveryAgentId.status,
            vehicleType: order.deliveryAgentId.vehicleType,
            vehicleNumber: order.deliveryAgentId.vehicleNumber,
            rating: order.deliveryAgentId.rating,
            totalDeliveries: order.deliveryAgentId.totalDeliveries,
          }
        : null,
    };
    console.log("formattedOrder:", formattedOrder);
    res.status(200).json({ success: true, data: formattedOrder });
  } catch (error) {
    console.error("Error in getting order by id:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch order details" });
  }
};
// UPDATE order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    if (!["Pending", "In Transit", "Delivered", "Cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    order.status = status;
    order.orderProgress.push({
      status,
      notes: notes || `Status updated to ${status}`,
      timestamp: new Date(),
    });
    await order.save();
    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Error in order status", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};
// DELETE order
export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOneAndDelete({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteOrder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
    });
  }
};
// UPDATE invoice URL
export const updateOrderInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { invoiceUrl } = req.body;
    if (!invoiceUrl) {
      return res.status(400).json({
        success: false,
        message: "Invoice URL is required",
      });
    }
    const order = await Order.findOneAndUpdate(
      { orderId },
      { invoiceUrl },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Error in updateOrderInvoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update invoice",
    });
  }
};

// Endpoint: GET /api/orders/user/:userId
export const getUserOrders = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "User ID is required" });
  }

  try {
    // Fetch all orders for the user, sorted by creation date (newest first)
    const orders = await Order.find({ userId })
      .populate("items.productId", "name imageUrl") // Optionally populate product details
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error in getUserOrders:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
