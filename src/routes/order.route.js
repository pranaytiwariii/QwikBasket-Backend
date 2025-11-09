import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  updateOrderInvoice,
  getOrdersByUserId,
} from "../controllers/order.controller.js";
const router = express.Router();
router.post("/", createOrder);
router.get("/user/:userId", getUserOrders);
router.get("/:orderId", getOrderById);
router.get("/:orderId", getOrderById);
router.get("/user/:userId", getOrdersByUserId);
router.get("/", getAllOrders);
router.patch("/:orderId/status", updateOrderStatus);
router.delete("/:orderId", deleteOrder);
router.patch("/:orderId/invoice", updateOrderInvoice);
export default router;
