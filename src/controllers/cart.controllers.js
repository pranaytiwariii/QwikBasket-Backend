import Cart from "../models/cart.models.js";
import Product from "../models/product.models.js";
import User from "../models/user.models.js";

// Helper function to calculate cart totals
const calculateCartTotals = async (cart) => {
  await cart.populate("items.productId");
  cart.subtotal = cart.items.reduce((sum, item) => {
    const price = item.productId?.pricePerKg || 0;
    return sum + price * item.quantity;
  }, 0);
  cart.totalAmount = Number((cart.subtotal - cart.couponDiscount).toFixed(2));
  await cart.save();
  return cart;
};

// GET /api/cart/:userId
export const getCart = async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isCartExists = await Cart.findOne({ user: req.params.userId });
    if (!isCartExists) {
      const cart = await Cart.create({ user: req.params.userId, items: [] });
      return res.status(200).json({
        success: true,
        message: "Cart created successfully",
        cart,
      });
    }

    res.status(200).json({
      success: true,
      cart: await Cart.findOne({ user: req.params.userId }).populate(
        "items.productId"
      ),
    });
  } catch (err) {
    console.error("Error in getCart:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// POST /api/cart/add
export const addItemToCart = async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;

    // Input validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!quantity) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be provided and cannot be zero",
      });
    }

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
    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    if (product.quantityAvailable <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Find existing item in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    let removedItem = false;
    if (existingItem) {
      // Handle negative quantity (removing items)
      if (quantity < 0) {
        const newQuantity = existingItem.quantity + quantity; // quantity is negative
        if (newQuantity <= 0) {
          // Remove item from cart if quantity becomes 0 or negative
          cart.items = cart.items.filter(
            (item) => item.productId.toString() !== productId
          );
          removedItem = true;
        } else {
          // Update quantity
          existingItem.quantity = newQuantity;
        }
      } else {
        // Handle positive quantity (adding items)
        // Check if already at maximum stock
        if (existingItem.quantity >= product.quantityAvailable) {
          return res.status(400).json({
            success: false,
            message: "You already have the maximum quantity in your cart",
          });
        }

        // Check if adding would exceed stock
        if (existingItem.quantity + quantity > product.quantityAvailable) {
          const toAdd = product.quantityAvailable - existingItem.quantity;
          existingItem.quantity += toAdd;

          // Calculate cart totals
          await calculateCartTotals(cart);

          const updatedCart = await Cart.findOne({ user: userId }).populate(
            "items.productId"
          );

          return res.status(200).json({
            success: true,
            message: `Only ${toAdd} items were added due to stock limits`,
            cart: updatedCart,
          });
        } else {
          existingItem.quantity += quantity;
        }
      }
    } else {
      // Item doesn't exist in cart
      if (quantity < 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot remove items that are not in the cart",
        });
      }
      if (product.quantityAvailable < quantity) {
        cart.items.push({ productId, quantity: product.quantityAvailable });
        return res.status(200).json({
          success: true,
          message: `Only ${product.quantityAvailable} items were added due to stock limits`,
          cart: await Cart.findOne({ user: userId }).populate(
            "items.productId"
          ),
        });
      }
      // Add new item to cart
      cart.items.push({ productId, quantity });
    }

    // Calculate cart totals
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    // Prepare response message
    let message;
    if (quantity < 0) {
      message = `Removed ${Math.abs(quantity)} item(s) from cart`;
    } else {
      message = `Added ${quantity} item(s) to cart`;
    }
    if (removedItem) {
      message = `Deleted the item from cart`; //because the quantity is zero or negative
    }

    res.status(200).json({
      success: true,
      message,
      cart: updatedCart,
    });
  } catch (error) {
    console.error("Error in addItemToCart:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// PUT /api/cart/update-quantity
export const updateItemQuantity = async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;

    // Input validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (quantity===null || quantity===undefined) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity cannot be negative",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product is available (has stock)
    if (product.quantityAvailable <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // Find cart
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Find existing item in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }
    if(quantity===0){
      cart.items = cart.items.filter(
        (item) => item.productId.toString() !== productId
      );
      await calculateCartTotals(cart);
      return res.status(200).json({
        success: true,
        message: "Item removed from cart",
        cart: await Cart.findOne({ user: userId }).populate("items.productId"),
      });
    }

    // Check if requested quantity exceeds available stock then just add the available quantity to the cart
    if (quantity > product.quantityAvailable) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantityAvailable} items available in stock`,
      });
    }

    // Update quantity
    existingItem.quantity = quantity;

    // Calculate cart totals and save
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    res.status(200).json({
      success: true,
      message: `Updated the item quantity to ${quantity}`,
      cart: updatedCart,
    });
  } catch (error) {
    console.error("Error in updateItemQuantity:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// DELETE /api/cart/item
export const removeItemFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product ID are required",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }
    // Remove the item from cart
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    // Calculate cart totals
    await calculateCartTotals(cart);

    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    res.status(200).json({
      success: true,
      message: "Item removed from cart",
      cart: updatedCart,
    });
  } catch (err) {
    console.error("Error in removeItemFromCart:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
