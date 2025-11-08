import { Router } from "express";
import {
  checkPincodeService,
  addPincode,
  updatePincodeService,
  deletePincode,
  getAllPincodes,
  bulkAddPincodes,
} from "../controllers/pincode.controllers.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.middlewares.js";

const router = Router();

// Public route - Check if service is available for a pincode
router.route("/check/:pincode").get(checkPincodeService);

// Admin routes - Protected
router.route("/").get(verifyToken, verifyAdmin, getAllPincodes);
router.route("/").post(verifyToken, verifyAdmin, addPincode);
router.route("/bulk").post(verifyToken, verifyAdmin, bulkAddPincodes);
router.route("/:pincode").put(verifyToken, verifyAdmin, updatePincodeService);
router.route("/:pincode").delete(verifyToken, verifyAdmin, deletePincode);

export default router;
