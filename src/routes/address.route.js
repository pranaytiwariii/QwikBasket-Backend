import express from "express";
import { getAllUserAddresses,setDefaultAddress,createAddress,updateAddress } from "../controllers/address.controller.js";
const router=express.Router();
router.get("/:userId", getAllUserAddresses);
router.put("/set-default", setDefaultAddress);
router.post("/", createAddress);
router.put('/:addressId', updateAddress);
export default router;