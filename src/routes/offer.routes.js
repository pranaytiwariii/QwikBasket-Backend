import express from "express";
import {
  getOffers,
  getOfferById,
  getActiveOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} from "../controllers/offer.controllers.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

// Public routes
router.get("/", getOffers);
router.get("/active", getActiveOffers);
router.get("/:id", getOfferById);

// admin routes
router.post("/", upload.single("image"), createOffer);
router.put("/:id", upload.single("image"), updateOffer);
router.delete("/:id", deleteOffer);

export default router;
