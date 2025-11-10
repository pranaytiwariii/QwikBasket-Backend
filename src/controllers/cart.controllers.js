import Cart from "../models/cart.models.js";
import Product from "../models/product.models.js";
import User from "../models/user.models.js";

// Helper function to calculate cart totals
const calculateCartTotals = async (cart) => {
  await cart.populate("items.productId");
  cart.subtotal = cart.items.reduce((sum, item) => {
    const price = item.price;
    return sum + price;
  }, 0);
  cart.totalAmount = cart.subtotal - cart.couponDiscount;
  cart.totalItems = cart.items.length;
  await cart.save();
  return cart;
};

// Helper function to get product price based on customer type
const getProductPrice = (product, customerType) => {
  //we will get the customerType from the request query
  // If customerType is "normal" (regular customer), use priceForCustomer
  // Otherwise, use price (for business users)
  return customerType === "normal"
    ? Number(product.priceForCustomer)
    : Number(product.price);
};

// GET /api/cart/:userId
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { customerType = "business" } = req.query;

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

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
      return res.status(200).json({
        success: true,
        message: "Cart created successfully",
        cart,
      });
    }

    let messages = [];
    cart = await Cart.findOne({ user: userId }).populate("items.productId");

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Validate items strictly against Product collection
    const validItems = [];
    const validProductIds = [];
    const itemsWithProductIds = [];

    for (const item of cart.items) {
      if (!item.productId) {
        messages.push(`A deleted product was removed from your cart`);
        continue;
      }

      const productId = item.productId._id;
      if (!productId) {
        messages.push("An invalid product was removed from your cart");
        continue;
      }

      validProductIds.push(productId);
      itemsWithProductIds.push({ item, productId });
    }

    // Fetch all products at once
    const products = await Product.find({ _id: { $in: validProductIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Validate each item and update prices
    for (const { item, productId } of itemsWithProductIds) {
      const key = String(productId);
      const product = productMap.get(key);

      if (!product) {
        const productName = item.productId?.name || `Product ${key}`;
        messages.push(`${productName} was deleted and removed from your cart`);
        continue;
      }

      // If customerType is "normal", filter out products that are not shown to customers
      if (customerType === "normal" && !product.showToCustomer) {
        messages.push(
          `${product.name} is not available for customers and was removed from your cart`
        );
        continue;
      }

      // Check if product is out of stock - remove from cart if stockInPackets <= 0
      if (product.stockInPackets <= 0) {
        messages.push(`Removed ${product.name} as it is out of stock.`);
        continue;
      }

      // Check stock (in packets) - adjust quantity if needed
      if (product.stockInPackets < item.quantity) {
        // Adjust quantity to available stock
        item.quantity = Number(product.stockInPackets);
        const pricePerPacket = getProductPrice(product, customerType);
        item.price = Number((item.quantity * pricePerPacket).toFixed(2));
        messages.push(
          `Adjusted ${product.name} quantity to ${item.quantity} packet(s) due to stock limits`
        );
      } else {
        // Update price based on current customerType and product price
        const pricePerPacket = getProductPrice(product, customerType);
        item.price = Number((item.quantity * pricePerPacket).toFixed(2));
      }

      validItems.push(item);
    }

    cart.items = validItems;
    await calculateCartTotals(cart);
    cart = await Cart.findOne({ user: userId }).populate("items.productId");

    res.status(200).json({
      success: true,
      cart,
      messages,
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
    const { productId, quantity, userId, customerType = "business" } = req.body;

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
        message: "Quantity must be provided and must be greater than zero",
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

    // Check if product is available for this user type
    if (customerType === "normal" && !product.showToCustomer) {
      return res.status(400).json({
        success: false,
        message: "This product is not available for customers",
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

    // Check if product is out of stock - remove from cart if it exists
    if (product.stockInPackets <= 0) {
      if (existingItem) {
        // Remove the item from cart if it exists
        cart.items = cart.items.filter(
          (item) => item.productId.toString() !== productId
        );
        await calculateCartTotals(cart);
        const updatedCart = await Cart.findOne({ user: userId }).populate(
          "items.productId"
        );
        return res.status(200).json({
          success: true,
          message: `${product.name} is out of stock and was removed from your cart`,
          cart: updatedCart,
          cartItemQuantity: 0,
        });
      } else {
        // Product is out of stock and not in cart
        return res.status(400).json({
          success: false,
          message: "Product is out of stock",
        });
      }
    }

    // Validate minimum quantity (must be at least 1 packet)
    const quantityInPackets = Math.floor(Number(quantity));
    if (quantityInPackets < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum order is 1 packet",
      });
    }

    const pricePerPacket = getProductPrice(product, customerType);
    let finalItemQuantity = quantityInPackets;
    let message = "";

    if (existingItem) {
      // Handle negative quantity (removing items)
      if (quantity < 0) {
        const removeQuantity = Math.abs(quantityInPackets);
        const newQuantity = existingItem.quantity - removeQuantity;

        if (newQuantity <= 0) {
          // Remove item from cart if quantity becomes 0 or negative
          cart.items = cart.items.filter(
            (item) => item.productId.toString() !== productId
          );
          message = `Removed ${product.name} from cart`;
          finalItemQuantity = 0;
        } else {
          // Update quantity and price
          existingItem.quantity = newQuantity;
          existingItem.price = Number(
            (newQuantity * pricePerPacket).toFixed(2)
          );
          message = `Removed ${removeQuantity} packet(s) of ${product.name} from cart`;
          finalItemQuantity = newQuantity;
        }
      } else {
        // Handle positive quantity (adding items)
        const newQuantity = existingItem.quantity + quantityInPackets;

        // Check stock availability
        if (newQuantity > product.stockInPackets) {
          // Adjust to maximum available stock
          existingItem.quantity = Number(product.stockInPackets);
          existingItem.price = Number(
            (product.stockInPackets * pricePerPacket).toFixed(2)
          );
          finalItemQuantity = product.stockInPackets;
          message = `Only ${product.stockInPackets} packet(s) of ${product.name} available. Updated cart to maximum available quantity.`;
        } else {
          // Update quantity and price
          existingItem.quantity = newQuantity;
          existingItem.price = Number(
            (newQuantity * pricePerPacket).toFixed(2)
          );
          finalItemQuantity = newQuantity;
          message = `Added ${quantityInPackets} packet(s) of ${product.name} to cart`;
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

      // Check stock availability
      if (quantityInPackets > product.stockInPackets) {
        // Add with limited quantity
        const limitedQuantity = Number(product.stockInPackets);
        const itemPrice = Number((limitedQuantity * pricePerPacket).toFixed(2));
        cart.items.push({
          productId,
          quantity: limitedQuantity,
          price: itemPrice,
        });
        finalItemQuantity = limitedQuantity;
        message = `Only ${limitedQuantity} packet(s) of ${product.name} available. Added to cart.`;
      } else {
        // Add new item to cart
        const itemPrice = Number(
          (quantityInPackets * pricePerPacket).toFixed(2)
        );
        cart.items.push({
          productId,
          quantity: quantityInPackets,
          price: itemPrice,
        });
        finalItemQuantity = quantityInPackets;
        message = `Added ${quantityInPackets} packet(s) of ${product.name} to cart`;
      }
    }

    // Calculate cart totals
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    res.status(200).json({
      success: true,
      message,
      cart: updatedCart,
      cartItemQuantity: finalItemQuantity,
    });
  } catch (error) {
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
    const { productId, quantity, userId, customerType = "business" } = req.body;

    // Input validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (quantity === null || quantity === undefined) {
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

    // Check if product is available for this user type
    if (customerType === "normal" && !product.showToCustomer) {
      return res.status(400).json({
        success: false,
        message: "This product is not available for customers",
      });
    }

    // Find cart
    let cart = await Cart.findOne({ user: userId });
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

    // Check if product is out of stock - remove from cart if stockInPackets <= 0
    if (product.stockInPackets <= 0) {
      // Remove the item from cart
      cart.items = cart.items.filter(
        (item) => item.productId.toString() !== productId
      );
      await calculateCartTotals(cart);
      const updatedCart = await Cart.findOne({ user: userId }).populate(
        "items.productId"
      );
      return res.status(200).json({
        success: true,
        message: `${product.name} is out of stock and was removed from your cart`,
        cart: updatedCart,
        cartItemQuantity: 0,
      });
    }

    // Handle quantity 0 (remove item)
    const quantityInPackets = Math.floor(Number(quantity));
    if (quantityInPackets === 0) {
      cart.items = cart.items.filter(
        (item) => item.productId.toString() !== productId
      );
      await calculateCartTotals(cart);
      const updatedCart = await Cart.findOne({ user: userId }).populate(
        "items.productId"
      );
      return res.status(200).json({
        success: true,
        message: `Removed ${product.name} from cart`,
        cart: updatedCart,
        cartItemQuantity: 0,
      });
    }

    // Validate minimum quantity
    if (quantityInPackets < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum order is 1 packet",
      });
    }

    // Check if requested quantity exceeds available stock
    if (quantityInPackets > product.stockInPackets) {
      // Adjust to maximum available stock
      existingItem.quantity = Number(product.stockInPackets);
      const pricePerPacket = getProductPrice(product, customerType);
      existingItem.price = Number(
        (product.stockInPackets * pricePerPacket).toFixed(2)
      );
      await calculateCartTotals(cart);
      const updatedCart = await Cart.findOne({ user: userId }).populate(
        "items.productId"
      );
      return res.status(200).json({
        success: true,
        message: `Only ${product.stockInPackets} packet(s) of ${product.name} available. Updated to maximum available quantity.`,
        cart: updatedCart,
        cartItemQuantity: product.stockInPackets,
      });
    }

    // Update quantity and price
    const pricePerPacket = getProductPrice(product, customerType);
    existingItem.quantity = quantityInPackets;
    existingItem.price = Number(
      (quantityInPackets * pricePerPacket).toFixed(2)
    );

    // Calculate cart totals and save
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    res.status(200).json({
      success: true,
      message: `Updated ${product.name} quantity to ${quantityInPackets} packet(s)`,
      cart: updatedCart,
      cartItemQuantity: quantityInPackets,
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

    // Get product name for the message
    const product = await Product.findById(productId);
    const productName = product ? product.name : "item";

    res.status(200).json({
      success: true,
      message: `Removed ${productName} from cart`,
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
