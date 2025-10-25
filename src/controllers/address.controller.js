import Address from "../models/address.models.js"
import mongoose from "mongoose"
// Endpoint 1: GET /api/addresses/:userId
export const getAllUserAddresses=async(req,res)=>{
    try {
        const {userId}=req.params;
        if(!userId)
            {
                return res.status(400).json({ success: false, message: "User ID is required" });
            }
        const addresses=await Address.find({userId:userId}).sort({
            isDefault:-1,
            updatedAt:-1,
        });
        res.status(200).json({
            success: true,
            data: addresses,
          });
    } catch (error) {
        console.error("Error in finding all addresses",error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
          });
    }
}
// Endpoint 2: PUT /api/addresses/set-default
export const setDefaultAddress=async(req,res)=>{
    try {
    const { userId, addressId } = req.body;
    if (!userId || !addressId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Address ID are required",
      });
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        
        await Address.updateMany(
          { userId: userId },
          { $set: { isDefault: false } },
          { session }
        );
  
        
        const updatedAddress = await Address.findOneAndUpdate(
          { _id: addressId, userId: userId },
          { $set: { isDefault: true } },
          { new: true, session }
        );
  
        if (!updatedAddress) {
          throw new Error("Address not found or does not belong to user");
        }
  
        
        await session.commitTransaction();
  
        res.status(200).json({
          success: true,
          message: "Default address updated successfully",
          data: updatedAddress,
        });
  
      } catch (error) {
        
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
        console.error("Error in setDefaultAddress:", error);
        res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
        });
    }
}