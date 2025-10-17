import Cart from "../models/cart.models.js";
import User from "../models/user.models.js";
import Address from "../models/address.models.js";
import { toTwoDecimalsNoRound, roundUpTo2 } from "../utils/productUtils.js";

// Helper function to calculate the Delivery fees
const calculateDeliveryFee = (subtotal) => {
  if (subtotal >= 500) {
    return 0;
  }
  return 50;
};
// Helper function to calculate checkout summary
const calculateCheckoutSummary = (cart, deliveryFee = null) => {
  const subtotal = toTwoDecimalsNoRound(cart.subtotal || 0);
  const couponDiscount = toTwoDecimalsNoRound(cart.couponDiscount || 0);
  if (deliveryFee === null) {
    deliveryFee = calculateDeliveryFee(subtotal);
  }
  const baseTotal =
    cart.totalAmount != null
      ? Number(cart.totalAmount)
      : toTwoDecimalsNoRound(subtotal - couponDiscount);
  const totalAmount = toTwoDecimalsNoRound(baseTotal + deliveryFee);
  return {
    subtotal,
    couponDiscount,
    deliveryFee: toTwoDecimalsNoRound(deliveryFee),
    totalAmount,
    totalItems: cart.totalItems != null ? cart.totalItems : cart.items.length,
  };
};
// @route   GET /api/checkout/:userId
// @access  Private
export const getCheckoutSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const cart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Please add items to proceed to checkout.",
      });
    }
    const defaultAddress = await Address.findOne({
      user: userId,
      isDefault: true,
    });
    const summary = calculateCheckoutSummary(cart);
    const checkoutData = {
      user: {
        _id: user._id,
        phone: user.phone,
      },
      deliveryAddress: defaultAddress || null,
      cart: {
        items: cart.items.map((item) => {
          const p = item.productId;
          return {
            productId: p._id,
            name: p.name,
            image: p.images?.[0] || null,
            pricePerKg: p?.pricePerKg || 0,
            quantity: item.quantity,
            selectedUnit: item.selectedUnit || "kg",
            itemTotal: roundUpTo2(item.price || 0),
          };
        }),
        totalItems: summary.totalItems,
      },
      paymentSummary: {
        subtotal: summary.subtotal,
        couponDiscount: summary.couponDiscount,
        deliveryFee: summary.deliveryFee,
        totalAmount: summary.totalAmount,
      },
    };
    res.status(200).json({
      success: true,
      data: checkoutData,
    });
  } catch (error) {
    console.error("Error in getCheckoutSummary", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};
// @route   POST /api/checkout/validate
// @access  Private
export const validateCheckout = async (req, res) => {
  try {
    const { userId, addressId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Delivery address not found or does not belong to user",
      });
    }
    const cart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }
    const stockIssues = [];
    for (const item of cart.items) {
      const product = item.productId;
      if (!product) {
        stockIssues.push({
          productId: item.productId._id,
          issue: "Product no longer exists",
        });
        continue;
      }
      // item.quantity is already stored in kg
      const qtyInStorage = item.quantity || 0;
      if (product.stockQuantity <= 0) {
        stockIssues.push({
          productId: product._id,
          productName: product.name,
          issue: "Out of stock",
        });
      } else if (qtyInStorage > product.stockQuantity) {
        stockIssues.push({
          productId: product._id,
          productName: product.name,
          issue: `Only ${product.stockQuantity} items available, but ${qtyInStorage} in cart`,
        });
      }
    }
    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items in ur cart have stock issues",
        stockIssues,
      });
    }
    const summary = calculateCheckoutSummary(cart);
    res.status(200).json({
      success: true,
      message: "Checkout validation successful",
      data: {
        isValid: true,
        deliveryAddress: {
          _id: address._id,
          completeAddress: address.completeAddress,
          landmark: address.landmark,
          pincode: address.pincode,
          city: address.city,
          state: address.state,
          addressNickname: address.addressNickname,
        },
        paymentSummary: summary,
      },
    });
  } catch (error) {
    console.error("Error in validating checkout:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getDeliveryFee = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const cart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }
    const subtotal = toTwoDecimalsNoRound(cart.subtotal || 0);
    const deliveryFee = calculateDeliveryFee(subtotal);
    res.status(200).json({
      success: true,
      data: {
        subtotal: toTwoDecimalsNoRound(subtotal),
        deliveryFee: toTwoDecimalsNoRound(deliveryFee),
        freeDeliveryThreshold: 500,
        isFreeDelivery: deliveryFee === 0,
      },
    });
  } catch (error) {
    console.error("Error in getDeliveryFee:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// @route   PUT /api/checkout/address
// @access  Private
export const updateCheckoutAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address ID is required",
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or does not belong to user",
      });
    }
    res.status(200).json({
      success: true,
      message: "Delivery address selected",
      data: {
        address: {
          _id: address._id,
          completeAddress: address.completeAddress,
          landmark: address.landmark,
          pincode: address.pincode,
          city: address.city,
          state: address.state,
          addressNickname: address.addressNickname,
        },
      },
    });
  } catch (error) {
    console.error("Error in updateCheckoutAddress:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};
