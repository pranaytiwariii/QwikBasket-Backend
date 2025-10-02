import express from "express";
import { getCheckoutSummary,validateCheckout,getDeliveryFee,updateCheckoutAddress} from "../controllers/checkout.controllers.js";
const router=express.Router();
router.get('/:userId',getCheckoutSummary);
router.post('/validate',validateCheckout);
router.post('/calculate-delivery',getDeliveryFee);
router.put('/address',updateCheckoutAddress);
export default router;