import mongoose from "mongoose";
import Order from "../models/order.models.js"
import Address from "../models/address.models.js"
import Cart from "../models/cart.models.js"
import Product from "../models/product.models.js"

// Helper to generate a unique Order ID
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


// Endpoint 3: POST /api/orders
export const createOrder = async (req, res) => {
  const { userId, addressId, paymentMethod, paymentSummary } = req.body;

  if (!userId || !addressId || !paymentMethod || !paymentSummary) {
    return res.status(400).json({ success: false, message: "Missing required order details" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Cart and Address
    const cart = await Cart.findOne({ user: userId }).populate("items.productId").session(session);
    const address = await Address.findById(addressId).session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }
    if (!address) {
      throw new Error("Address not found");
    }

    // 2. Re-validate stock one last time
    const stockIssues = [];
    const orderItems = cart.items.map(item => {
      const product = item.productId;
      if (!product) throw new Error(`Product with ID ${item.productId} not found`);
      if (product.stockQuantity < item.quantity) {
        stockIssues.push(`${product.name} only has ${product.stockQuantity} in stock.`);
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
      paymentStatus: (paymentMethod === 'credit' ? "Pending" : "Completed"), // 'Pending' for COD/Credit
    };
    
    // 4. Create the new Order
    const newOrder = new Order({
      orderId: await generateOrderId(),
      userId: userId,
      items: orderItems,
      totalAmount: paymentSummary.totalAmount, // Use total from validated summary
      shippingAddress: shippingAddress,
      paymentDetails: paymentDetails,
      status: "Pending", // Initial status
      orderProgress: [{ status: "Pending", notes: "Order placed by customer" }],
    });

    await newOrder.save({ session });

    // 5. Decrement Product stock (using bulkWrite for efficiency)
    const stockUpdates = cart.items.map(item => ({
      updateOne: {
        filter: { _id: item.productId._id },
        update: { $inc: { stockQuantity: -item.quantity } },
      },
    }));

    await Product.bulkWrite(stockUpdates, { session });

    // 6. Clear the user's cart
    await Cart.deleteOne({ user: userId }, { session });

    // 7. Commit the transaction
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: { order: newOrder },
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

// Endpoint: GET /api/orders/user/:userId
export const getUserOrders = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  try {
    // Fetch all orders for the user, sorted by creation date (newest first)
    const orders = await Order.find({ userId })
      .populate('items.productId', 'name imageUrl') // Optionally populate product details
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

// Endpoint: GET /api/orders/:orderId
export const getOrderById = async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Order ID is required" });
  }

  try {
    const order = await Order.findById(orderId)
      .populate('items.productId', 'name imageUrl pricePerKg weightInKg');

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error in getOrderById:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};