import Cart from "../models/cart.models.js";
import Product from "../models/product.models.js";
import User from "../models/user.models.js";
import {
  convertQuantityToStorageUnit,
  convertQuantityFromStorageUnit,
  toThreeDecimalsNoRound,
  roundUpTo2,
} from "../utils/productUtils.js";

// Helper function to calculate cart totals
const calculateCartTotals = async (cart) => {
  await cart.populate("items.productId");
  cart.subtotal = cart.items.reduce((sum, item) => {
    const price = item.price;
    return sum + price;
  }, 0);
  cart.totalAmount = toThreeDecimalsNoRound(
    cart.subtotal - cart.couponDiscount
  );
  cart.totalItems = cart.items.length;
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
    let messages = [];
    let cart = await Cart.findOne({ user: req.params.userId }).populate(
      "items.productId"
    );

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }
    // Validate items strictly against Product collection
    const validItems = [];

    // Filter out items with null productId and collect valid productIds
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

    // Validate each item
    for (const { item, productId } of itemsWithProductIds) {
      const key = String(productId);
      const product = productMap.get(key);

      if (!product) {
        const productName = item.productId?.name || `Product ${key}`;
        messages.push(`${productName} was deleted and removed from your cart`);
        continue;
      }

      // Both stockQuantity and item.quantity are in kg (storage unit)
      if (product.stockQuantity < item.quantity) {
        item.quantity = toThreeDecimalsNoRound(product.stockQuantity);
        item.price = roundUpTo2(item.quantity * product.pricePerKg);

        if (product.stockQuantity === 0) {
          messages.push(`Removed ${product.name} as it is out of stock.`);
          continue;
        }

        const displayQuantity = convertQuantityFromStorageUnit(
          product.stockQuantity,
          item.selectedUnit || product.defaultUnit
        );
        const displayUnit = item.selectedUnit || product.defaultUnit;
        messages.push(
          `Adjusted ${product.name} quantity to ${displayQuantity}${displayUnit} due to stock limits`
        );
      }

      validItems.push(item);
    }

    cart.items = validItems;
    await calculateCartTotals(cart);
    cart = await Cart.findOne({ user: req.params.userId }).populate(
      "items.productId"
    );

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
    const { productId, quantity, userId, selectedUnit } = req.body;

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
    if (!selectedUnit) {
      return res.status(400).json({
        success: false,
        message: "Unit is required",
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

    if (product.stockQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // Validate unit and packaging constraints
    const unit = selectedUnit;
    const allowedUnits = ["gms", "kg", "ltr"];
    if (!allowedUnits.includes(unit)) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Allowed units are: gms, kg, ltr",
      });
    }

    const qtyInStorage = convertQuantityToStorageUnit(quantity, unit);
    const packagingQuantityInStorage = convertQuantityToStorageUnit(
      product.packagingQuantity,
      product.defaultUnit
    );
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Find existing item in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    let removedItem = false;
    let finalItemQuantity = 0;

    if (existingItem) {
      // Handle negative quantity (removing items)
      if (quantity < 0) {
        const deltaStorage = convertQuantityToStorageUnit(
          Math.abs(quantity),
          unit
        );
        const newQuantity = existingItem.quantity - deltaStorage; // reduce in storage unit
        if (newQuantity <= 0) {
          // Remove item from cart if quantity becomes 0 or negative
          cart.items = cart.items.filter(
            (item) => item.productId.toString() !== productId
          );
          removedItem = true;
          finalItemQuantity = 0;
        } else {
          existingItem.quantity = toThreeDecimalsNoRound(newQuantity);
          existingItem.selectedUnit = unit;
          // Calculate price: use the new stored quantity (already in kg) * pricePerKg
          const quantityInKg = convertQuantityToStorageUnit(
            existingItem.quantity,
            existingItem.selectedUnit
          );
          const itemPrice = roundUpTo2(
            existingItem.quantity * product.pricePerKg
          );
          existingItem.price = itemPrice;
          finalItemQuantity = convertQuantityFromStorageUnit(
            existingItem.quantity,
            existingItem.selectedUnit
          );
        }
      } else {
        if (qtyInStorage < packagingQuantityInStorage) {
          return res.status(400).json({
            success: false,
            message: `Minimum order is ${product.packagingQuantity}${product.defaultUnit}. You entered ${quantity}${selectedUnit}.`,
          });
        }
        // Handle positive quantity (adding items)
        if (existingItem.quantity >= product.stockQuantity) {
          existingItem.quantity = toThreeDecimalsNoRound(product.stockQuantity);
          existingItem.selectedUnit = unit;
          const itemPrice = roundUpTo2(
            existingItem.quantity * product.pricePerKg
          );
          existingItem.price = itemPrice;
          finalItemQuantity = convertQuantityFromStorageUnit(
            existingItem.quantity,
            existingItem.selectedUnit
          );
          await calculateCartTotals(cart);
          const updatedCart = await Cart.findOne({ user: userId }).populate(
            "items.productId"
          );
          return res.status(200).json({
            success: true,
            message: "You already have the maximum quantity in your cart",
            cart: updatedCart,
            cartItemQuantity: finalItemQuantity,
          });
        }

        if (existingItem.quantity + qtyInStorage > product.stockQuantity) {
          existingItem.quantity = toThreeDecimalsNoRound(product.stockQuantity);
          existingItem.selectedUnit = unit;
          const itemPrice = roundUpTo2(
            existingItem.quantity * product.pricePerKg
          );
          existingItem.price = itemPrice;
          finalItemQuantity = convertQuantityFromStorageUnit(
            existingItem.quantity,
            existingItem.selectedUnit
          );
          await calculateCartTotals(cart);
          const updatedCart = await Cart.findOne({ user: userId }).populate(
            "items.productId"
          );

          return res.status(200).json({
            success: true,
            message: `Only ${toAdd}${selectedUnit} of ${product.name} were added due to stock limits`,
            cart: updatedCart,
            cartItemQuantity: finalItemQuantity,
          });
        } else {
          existingItem.quantity = toThreeDecimalsNoRound(
            existingItem.quantity + qtyInStorage
          );
          existingItem.selectedUnit = unit;
          // Calculate price: use the new stored quantity (already in kg) * pricePerKg
          existingItem.price = roundUpTo2(
            existingItem.quantity * product.pricePerKg
          );
          finalItemQuantity = convertQuantityFromStorageUnit(
            existingItem.quantity,
            existingItem.selectedUnit
          );
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
      if (product.stockQuantity < qtyInStorage) {
        const limitedQty = product.stockQuantity;
        // Calculate price: limitedQty is already in storage unit (kg), so multiply directly by pricePerKg
        const itemPrice = roundUpTo2(limitedQty * product.pricePerKg);
        cart.items.push({
          productId,
          quantity: toThreeDecimalsNoRound(limitedQty),
          selectedUnit: unit,
          price: itemPrice,
        });
        finalItemQuantity = convertQuantityFromStorageUnit(limitedQty, unit); // respond with requested unit quantity

        await calculateCartTotals(cart);
        const updatedCart = await Cart.findOne({ user: userId }).populate(
          "items.productId"
        );

        return res.status(200).json({
          success: true,
          message: `Only ${product.stockQuantity}${selectedUnit} of ${product.name} were added due to stock limits`,
          cart: updatedCart,
          cartItemQuantity: finalItemQuantity,
        });
      }

      // Add new item to cart
      const itemPrice = roundUpTo2(qtyInStorage * product.pricePerKg);
      const newItem = {
        productId,
        quantity: toThreeDecimalsNoRound(qtyInStorage),
        selectedUnit: unit,
        price: itemPrice,
      };
      cart.items.push(newItem);
      finalItemQuantity = convertQuantityFromStorageUnit(qtyInStorage, unit);
    }

    // Calculate cart totals
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    // Prepare response message
    let message;

    const unitText = selectedUnit;
    const productName = product.name;

    if (removedItem) {
      message = `Removed ${productName} from cart`;
    } else if (quantity < 0) {
      message = `Removed ${Math.abs(
        quantity
      )}${unitText} of ${productName} from cart`;
    } else {
      message = `Added ${quantity}${unitText} of ${productName} to cart`;
    }

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
    const { productId, quantity, userId, selectedUnit } = req.body;

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

    if (!selectedUnit) {
      return res.status(400).json({
        success: false,
        message: "Unit is required",
      });
    }

    // Validate unit
    const allowedUnits = ["gms", "kg", "ltr"];
    if (!allowedUnits.includes(selectedUnit)) {
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Allowed units are: gms, kg, ltr",
      });
    }
    const unit = selectedUnit;

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product is available (has stock)
    if (product.stockQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    // Find cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }
    // Find existing item in cart
    let existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }
    if (quantity === 0) {
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

    // Convert input quantity to storage unit (kg)
    const qtyInStorage = convertQuantityToStorageUnit(quantity, selectedUnit);
    const packagingQuantityInStorage = convertQuantityToStorageUnit(
      product.packagingQuantity,
      product.defaultUnit
    );
    if (qtyInStorage < packagingQuantityInStorage) {
      return res.status(400).json({
        success: false,
        message: `Minimum order is ${product.packagingQuantity}${product.defaultUnit}. You entered ${quantity}${selectedUnit}.`,
      });
    }

    // Check if requested quantity exceeds available stock
    if (qtyInStorage > product.stockQuantity) {
      existingItem.quantity = product.stockQuantity;
      existingItem.selectedUnit = selectedUnit;
      // Calculate price: use the new stored quantity directly (already in kg) * pricePerKg
      const itemPrice = roundUpTo2(existingItem.quantity * product.pricePerKg);
      existingItem.price = itemPrice;
      await calculateCartTotals(cart);
      const updatedCart = await Cart.findOne({ user: userId }).populate(
        "items.productId"
      );
      return res.status(200).json({
        success: true,
        message: `Only ${product.stockQuantity}${product.defaultUnit} of ${product.name} are in stock.`,
        cart: updatedCart,
        cartItemQuantity: convertQuantityFromStorageUnit(
          existingItem.quantity,
          selectedUnit
        ),
      });
    }

    // Update quantity and price - set the quantity directly to what user entered
    existingItem.quantity = toThreeDecimalsNoRound(qtyInStorage);
    existingItem.selectedUnit = selectedUnit;
    // Calculate price: use the new stored quantity directly (already in kg) * pricePerKg
    const itemPrice = roundUpTo2(existingItem.quantity * product.pricePerKg);
    existingItem.price = itemPrice;

    // Calculate cart totals and save
    await calculateCartTotals(cart);

    // Get updated cart with populated product details
    const updatedCart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );
    let cartItemQuantity1 = existingItem.quantity;
    if (selectedUnit === "gms") {
      cartItemQuantity1 *= 1000;
    }
    console.log(cartItemQuantity1);
    res.status(200).json({
      success: true,
      message: `Updated ${product.name} quantity to ${quantity}${selectedUnit}`,
      cart: updatedCart,
      cartItemQuantity: convertQuantityFromStorageUnit(
        existingItem.quantity,
        selectedUnit
      ),
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
