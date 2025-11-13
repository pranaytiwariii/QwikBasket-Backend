import DeliveryAgent from "../models/deliveryAgent.models.js";
import Order from "../models/order.models.js";
import { generateAccessToken, generateRefreshToken } from "../utils/JWT.js";

// Agent Login - Verify agent by phone number
export const agentLogin = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Find agent by phone number
    const agent = await DeliveryAgent.findOne({ phone, isActive: true });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found or inactive",
      });
    }

    // Generate tokens for the agent
    const payload = {
      agentId: agent._id,
      phone: agent.phone,
      name: agent.name,
      userType: "agent",
      status: agent.status,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      success: true,
      message: "Agent logged in successfully",
      accessToken,
      refreshToken,
      agent: {
        id: agent._id,
        name: agent.name,
        phone: agent.phone,
        email: agent.email,
        status: agent.status,
        vehicleType: agent.vehicleType,
        vehicleNumber: agent.vehicleNumber,
        totalDeliveries: agent.totalDeliveries,
        rating: agent.rating,
      },
    });
  } catch (error) {
    console.error("Error during agent login:", error);
    return res.status(500).json({
      success: false,
      message: "Error during agent login",
      error: error.message,
    });
  }
};

// Get all delivery agents
export const getAllDeliveryAgents = async (req, res) => {
  try {
    const { status, isActive, search } = req.query;

    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Search by name or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const agents = await DeliveryAgent.find(query)
      .populate("currentOrderId", "orderId totalAmount")
      .sort({ createdAt: -1 });
    console.log("==============agents==========", agents);
    return res.status(200).json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (error) {
    console.error("Error fetching delivery agents:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching delivery agents",
      error: error.message,
    });
  }
};

// Get available delivery agents
export const getAvailableAgents = async (req, res) => {
  try {
    const agents = await DeliveryAgent.find({
      status: "available",
      isActive: true,
    })
      .select(
        "name phone email status rating totalDeliveries vehicleType vehicleNumber assignedOrders currentOrderId"
      )
      .lean();

    if (!agents.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const agentIds = agents.map((agent) => agent._id);

    const activeOrders = await Order.find({
      deliveryAgentId: { $in: agentIds },
      status: { $nin: ["Delivered", "Cancelled"] },
    })
      .select(
        "orderId status totalAmount createdAt shippingAddress orderProgress items deliveryAgentId"
      )
      .sort({ createdAt: 1 })
      .lean();

    const ordersByAgent = new Map();

    activeOrders.forEach((order) => {
      const agentKey = order.deliveryAgentId?.toString();
      if (!agentKey) return;
      if (!ordersByAgent.has(agentKey)) {
        ordersByAgent.set(agentKey, []);
      }

      const totalItems = Array.isArray(order.items)
        ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      ordersByAgent.get(agentKey).push({
        id: order.orderId,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        totalItems,
        shippingAddress: order.shippingAddress,
        orderProgress: order.orderProgress,
      });
    });

    const enrichedAgents = agents.map((agent) => {
      const agentKey = agent._id.toString();
      const assignedOrders = ordersByAgent.get(agentKey) || [];

      return {
        ...agent,
        assignedOrderCount: assignedOrders.length,
        assignedOrders,
      };
    });

    enrichedAgents.sort((a, b) => {
      if (a.assignedOrderCount !== b.assignedOrderCount) {
        return a.assignedOrderCount - b.assignedOrderCount;
      }
      const aDeliveries = a.totalDeliveries || 0;
      const bDeliveries = b.totalDeliveries || 0;
      if (aDeliveries !== bDeliveries) {
        return aDeliveries - bDeliveries;
      }
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      return bRating - aRating;
    });
    console.log("==============enrichedAgents==========", enrichedAgents);

    return res.status(200).json({
      success: true,
      count: enrichedAgents.length,
      data: enrichedAgents,
    });
  } catch (error) {
    console.error("Error fetching available agents:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching available agents",
      error: error.message,
    });
  }
};

// Get single delivery agent
export const getDeliveryAgent = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await DeliveryAgent.findById(id)
      .populate("currentOrderId")
      .populate("assignedOrders.orderId");

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Error fetching delivery agent:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching delivery agent",
      error: error.message,
    });
  }
};

// Add new delivery agent
export const addDeliveryAgent = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone number are required",
      });
    }

    // // Validate phone number format
    // if (!/^\d{10}$/.test(phone)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Please enter a valid 10-digit phone number",
    //   });
    // }

    // Check if agent already exists
    const existingAgent = await DeliveryAgent.findOne({ phone });
    if (existingAgent) {
      return res.status(409).json({
        success: false,
        message: "Delivery agent with this phone number already exists",
      });
    }
    // Create new agent with only name and phone
    const newAgent = await DeliveryAgent.create({
      name,
      phone,
      status: "available",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery agent added successfully",
      data: newAgent,
    });
  } catch (error) {
    console.error("Error adding delivery agent:", error);
    return res.status(500).json({
      success: false,
      message: "Error adding delivery agent",
      error: error.message,
    });
  }
};

// Update delivery agent
export const updateDeliveryAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow updating certain fields directly
    delete updateData.totalDeliveries;
    delete updateData.assignedOrders;
    delete updateData.currentOrderId;

    const agent = await DeliveryAgent.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery agent updated successfully",
      data: agent,
    });
  } catch (error) {
    console.error("Error updating delivery agent:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating delivery agent",
      error: error.message,
    });
  }
};

// Delete/Deactivate delivery agent
export const deleteDeliveryAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const agent = await DeliveryAgent.findById(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // Check if agent has active delivery
    if (agent.status === "delivery_assigned") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete agent with active delivery assignment",
      });
    }

    if (permanent === "true") {
      // Permanent deletion
      await DeliveryAgent.findByIdAndDelete(id);
      return res.status(200).json({
        success: true,
        message: "Delivery agent deleted permanently",
      });
    } else {
      // Soft delete - just deactivate
      agent.isActive = false;
      agent.status = "offline";
      await agent.save();

      return res.status(200).json({
        success: true,
        message: "Delivery agent deactivated successfully",
        data: agent,
      });
    }
  } catch (error) {
    console.error("Error deleting delivery agent:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting delivery agent",
      error: error.message,
    });
  }
};

// Assign order to delivery agent
export const assignOrderToAgent = async (req, res) => {
  try {
    const { agentId, orderId } = req.body;

    if (!agentId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Agent ID and Order ID are required",
      });
    }

    // Find the agent
    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // Check if agent is available
    if (agent.status !== "available") {
      return res.status(400).json({
        success: false,
        message: "Delivery agent is not available",
        currentStatus: agent.status,
      });
    }

    if (!agent.isActive) {
      return res.status(400).json({
        success: false,
        message: "Delivery agent is not active",
      });
    }

    // Find the order first to get its _id
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update agent status
    agent.status = "delivery_assigned";
    agent.currentOrderId = order._id; // Use MongoDB _id, not orderId string
    agent.assignedOrders.push({
      orderId: order._id, // Use MongoDB _id for reference
      assignedAt: new Date(),
      status: "assigned",
    });

    await agent.save();

    // Update the order with delivery agent details
    order.deliveryAgentId = agentId;
    if (order.status === "Confirmed" || order.status === "Pending") {
      order.status = "Out for delivery";
    }
    order.orderProgress.push({
      status: "Out for delivery",
      notes: `Order assigned to delivery agent: ${agent.name}`,
      date: new Date(),
    });
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order assigned to delivery agent successfully",
      data: agent,
    });
  } catch (error) {
    console.error("Error assigning order:", error);
    return res.status(500).json({
      success: false,
      message: "Error assigning order to delivery agent",
      error: error.message,
    });
  }
};

// Mark delivery as completed
export const completeDelivery = async (req, res) => {
  try {
    const { agentId, orderId, otp } = req.body;

    // Validate required fields
    if (!agentId || !orderId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Agent ID, Order ID, and OTP are required",
      });
    }

    // Find the agent
    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // Find the order and validate OTP
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Validate OTP
    if (order.deliveryOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please provide the correct delivery OTP.",
      });
    }

    // Update the assigned order status
    const orderIndex = agent.assignedOrders.findIndex(
      (assignedOrder) =>
        assignedOrder.orderId.toString() === order._id.toString()
    );

    if (orderIndex !== -1) {
      agent.assignedOrders[orderIndex].status = "delivered";
      agent.assignedOrders[orderIndex].completedAt = new Date();
    }

    // Update agent status
    agent.status = "available";
    agent.currentOrderId = null;
    agent.totalDeliveries += 1;

    await agent.save();

    // Update order status to "Delivered"
    order.status = "Delivered";
    order.orderProgress.push({
      status: "Delivered",
      notes: "Order delivered successfully",
      date: new Date(),
    });
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Delivery marked as completed",
      data: agent,
    });
  } catch (error) {
    console.error("Error completing delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Error completing delivery",
      error: error.message,
    });
  }
};

// Update agent status manually
export const updateAgentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["available", "delivery_assigned", "offline"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const agent = await DeliveryAgent.findById(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // If setting to available, clear current order
    if (status === "available") {
      agent.currentOrderId = null;
    }

    agent.status = status;
    await agent.save();

    return res.status(200).json({
      success: true,
      message: "Agent status updated successfully",
      data: agent,
    });
  } catch (error) {
    console.error("Error updating agent status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating agent status",
      error: error.message,
    });
  }
};

// Get agent statistics
export const getAgentStats = async (req, res) => {
  try {
    const totalAgents = await DeliveryAgent.countDocuments();
    const availableAgents = await DeliveryAgent.countDocuments({
      status: "available",
      isActive: true,
    });
    const busyAgents = await DeliveryAgent.countDocuments({
      status: "delivery_assigned",
    });
    const offlineAgents = await DeliveryAgent.countDocuments({
      status: "offline",
    });
    const inactiveAgents = await DeliveryAgent.countDocuments({
      isActive: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        total: totalAgents,
        available: availableAgents,
        busy: busyAgents,
        offline: offlineAgents,
        inactive: inactiveAgents,
      },
    });
  } catch (error) {
    console.error("Error fetching agent stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching agent statistics",
      error: error.message,
    });
  }
};
export const getAgentOrders = async (req, res) => {
  try {
    const { id } = req.params; 

    const agent = await DeliveryAgent.findById(id).populate({
      path: 'assignedOrders.orderId',
      populate: [
        { path: 'items.productId', select: 'name images' },
        { path: 'userId', select: 'name phone' }
      ]
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // Filter and format active orders
    const activeOrders = agent.assignedOrders
      .filter(order => 
        order.orderId && 
        order.status !== 'delivered' &&
        order.orderId.status !== 'Delivered' &&
        order.orderId.status !== 'Cancelled'
      )
      .map(order => {
        const orderDoc = order.orderId;
        return {
          id: orderDoc.orderId, // Order number string (e.g., "ORD-1001")
          _id: orderDoc._id, // MongoDB ID
          status: orderDoc.status,
          customerName: orderDoc.customerName || orderDoc.customerId?.name,
          customerPhone: orderDoc.customerPhone || orderDoc.customerId?.phone,
          paymentMethod: orderDoc.paymentMethod,
          totalAmount: orderDoc.totalAmount,
          deliveryTime: order.assignedAt,
          address: orderDoc.shippingAddress?.completeAddress || 
                   orderDoc.shippingAddress?.addressLine1 || 
                   'Address not available',
          productName: orderDoc.items?.[0]?.productId?.name || 
                       orderDoc.items?.[0]?.productName || 
                       'Product',
          items: orderDoc.items,
          deliveryOtp: orderDoc.deliveryOtp, 
          assignedAt: order.assignedAt,
          assignmentStatus: order.status
        };
      });

    return res.status(200).json({
      success: true,
      count: activeOrders.length,
      data: activeOrders,
    });
  } catch (error) {
    console.error("Error fetching agent orders:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching agent orders",
      error: error.message,
    });
  }
};