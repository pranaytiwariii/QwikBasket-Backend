import express from "express";
import {
  getCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
} from "../controllers/cart.controllers.js";

const router = express.Router();

// Get the user's cart
router.get("/:userId", getCart);

// Add an item to the cart or remove a quantity of an item (for +/- buttons)
router.post("/add", addItemToCart);

// Update item quantity directly (for direct input)
router.put("/update-quantity", updateItemQuantity);

// Remove an item from the cart for delete button
router.delete("/item", removeItemFromCart);

export default router;
