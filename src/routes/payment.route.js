import express from "express";
import { createRazorpayOrder, verifyPaymentAndCreateOrder, createPendingOrder } from "../controllers/payment.controller.js";
const router=express.Router();
router.post("/create-order",createRazorpayOrder);
router.post("/verify",verifyPaymentAndCreateOrder);
router.post("/create-pending-order", createPendingOrder);
export default router;