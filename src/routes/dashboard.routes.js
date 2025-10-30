import express from "express";
import { getDashboardStats,getTopCategories } from "../controllers/dashboard.controller.js";
const router=express.Router();
router.get("/stats",getDashboardStats);
router.get("/top-categories", getTopCategories);
export default router;