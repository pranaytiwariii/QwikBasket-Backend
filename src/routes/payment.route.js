import express from "express";
import { createRazorpayOrder,verifyPaymentAndCreateOrder } from "../controllers/payment.controller.js";
const router=express.Router();
router.post("/create-order",createRazorpayOrder);
router.post("/verify",verifyPaymentAndCreateOrder);
export default router;