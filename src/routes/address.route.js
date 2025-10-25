import express from "express";
import { getAllUserAddresses,setDefaultAddress } from "../controllers/address.controller";
const router=express.Router();
router.get("/:userId", getAllUserAddresses);
router.put("/set-default", setDefaultAddress);
export default router;