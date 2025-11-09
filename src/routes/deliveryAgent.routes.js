import { Router } from "express";
import {
  getAllDeliveryAgents,
  getAvailableAgents,
  getDeliveryAgent,
  addDeliveryAgent,
  updateDeliveryAgent,
  deleteDeliveryAgent,
  assignOrderToAgent,
  completeDelivery,
  updateAgentStatus,
  getAgentStats,
} from "../controllers/deliveryAgent.controllers.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.middlewares.js";

const router = Router();

router.route("/stats").get(verifyToken, verifyAdmin, getAgentStats);
router.route("/").get(verifyToken, verifyAdmin, getAllDeliveryAgents);
router.route("/available").get(verifyToken, verifyAdmin, getAvailableAgents);
router.route("/").post(verifyToken, verifyAdmin, addDeliveryAgent);
router.route("/assign").post(verifyToken, verifyAdmin, assignOrderToAgent);
router.route("/complete").post(verifyToken, verifyAdmin, completeDelivery);
router.route("/:id").get(verifyToken, verifyAdmin, getDeliveryAgent);
router.route("/:id").put(verifyToken, verifyAdmin, updateDeliveryAgent);
router.route("/:id/status").patch(verifyToken, verifyAdmin, updateAgentStatus);
router.route("/:id").delete(verifyToken, verifyAdmin, deleteDeliveryAgent);

export default router;
