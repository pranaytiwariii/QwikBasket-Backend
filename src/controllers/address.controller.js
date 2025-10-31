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
// Endpoint 3: POST /api/address
export const createAddress = async (req, res) => {
  try {
    const { userId } = req.body; // Make sure userId is sent from the app

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // 1. Check if any other address exists for this user
    const existingAddress = await Address.findOne({ userId: userId });
    
    // 2. If no address exists, this new one is the default
    const isFirstAddress = !existingAddress;

    // 3. Create the new address
    const newAddress = new Address({
      ...req.body,
      isDefault: isFirstAddress, // Set isDefault to true if it's the first one
    });

    // 4. Save to database
    await newAddress.save();

    res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data: newAddress,
    });

  } catch (error) {
    console.error("Error in createAddress:", error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: validationErrors[0] || "Validation failed",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// Endpoint 4: PUT /api/address/:addressId
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { userId, completeAddress, landmark, pincode, city, state, addressNickname } = req.body;

    if (!userId || !addressId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Address ID are required",
      });
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId: userId },
      {
        completeAddress,
        landmark,
        pincode,
        city,
        state,
        addressNickname,
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found or does not belong to user",
      });
    }

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updatedAddress,
    });
  } catch (error) {
    console.error("Error in updateAddress:", error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: validationErrors[0] || "Validation failed",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};