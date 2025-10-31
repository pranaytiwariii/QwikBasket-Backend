import express from "express";
import { createOrder, getUserOrders, getOrderById } from "../controllers/order.controller.js";
const router=express.Router();
router.post("/",createOrder);
router.get("/user/:userId", getUserOrders);
router.get("/:orderId", getOrderById);
export default router;