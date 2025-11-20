import { Router } from "express";
import {
  createPickupPoint,
  deletePickupPoint,
  getPickupPointById,
  listActivePickupPoints,
  listAllPickupPoints,
  updatePickupPoint,
} from "../controllers/pickupPoint.controller.js";
import { verifyAdmin, verifyToken } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/", listActivePickupPoints);
router.get("/admin", verifyToken, verifyAdmin, listAllPickupPoints);
router.get(
  "/admin/:pickupPointId",
  verifyToken,
  verifyAdmin,
  getPickupPointById
);
router.post("/", verifyToken, verifyAdmin, createPickupPoint);
router.patch("/:pickupPointId", verifyToken, verifyAdmin, updatePickupPoint);
router.delete("/:pickupPointId", verifyToken, verifyAdmin, deletePickupPoint);

export default router;
