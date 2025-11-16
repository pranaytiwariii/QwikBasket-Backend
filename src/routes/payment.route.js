import express from "express";
import {
  createRazorpayOrder,
  verifyPaymentAndCreateOrder,
  createPendingOrder,
  getAllPayments,
  getPaymentById,
  getPaymentSummary,
  updatePaymentStatus,
  deletePayment,
  checkCreditStatus,
  completeCreditPayment,
  initiateUpiCollectRequest
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyPaymentAndCreateOrder);
router.post("/create-pending-order", createPendingOrder);

router.post("/create-pending-order", createPendingOrder);
router.get("/payments", getAllPayments);
router.get("/payment/:id", getPaymentById);
router.get("/summary", getPaymentSummary);
router.patch("/payment/:id/status", updatePaymentStatus);
router.delete("/payment/:id", deletePayment);
router.get("/credit-status/:userId", checkCreditStatus);
router.post("/complete-credit-payment", completeCreditPayment);
router.post("/initiate-upi-collect", initiateUpiCollectRequest)
export default router;
