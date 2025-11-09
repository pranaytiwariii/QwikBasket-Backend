import UserModels from "../models/user.models.js";
import BusinessDetails from "../models/businessDetails.models.js";
import addressModels from "../models/address.models.js";
import mongoose from "mongoose";

//  GET /admin/users
export const getAllUsers = async (req, res) => {
    try {
        const users = await UserModels.find().select("-refreshToken");
        return res.status(200).json({
            success: true,
            message: "All users fetched successfully",
            users,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message,
        });
    }
};

export const getAllUsersDetails = async (req, res) => {
    try {
        const users = await UserModels.find().select("-refreshToken");

        const usersWithDetails = await Promise.all(
            users.map(async (user) => {
                const businessDetails = await BusinessDetails.findOne({ userId: user._id });
                const addressDetails = await addressModels.findOne({ userId: user._id });

                return {
                    ...user.toObject(),
                    businessDetails,
                    addressDetails,
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "All users fetched successfully",
            users: usersWithDetails,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message,
        });
    }
};


export const getUnverifiedUsers = async (req, res) => {
    try {
        const users = await UserModels.find({ isVerified: false , status : "pending" }).select("-refreshToken");

        const usersWithDetails = await Promise.all(
            users.map(async (user) => {
                const businessDetails = await BusinessDetails.findOne({ userId: user._id });
                const addressDetails = await addressModels.findOne({ userId: user._id });

                return {
                    ...user.toObject(),
                    businessDetails,
                    addressDetails,
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Unverified users fetched successfully",
            users: usersWithDetails,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch unverified users",
            error: error.message,
        });
    }
}


export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user id",
            });
        }

        const user = await UserModels.findById(id).select("-refreshToken");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const businessDetails = await BusinessDetails.findOne({ userId: id });
        const addressDetails = await addressModels.findOne({ userId: id });

        return res.status(200).json({
            success: true,
            message: "User details fetched successfully",
            user: {
                ...user.toObject(),
                businessDetails,
                addressDetails,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user details",
            error: error.message,
        });
    }
};


//  PUT /admin/users/:id
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const user = await UserModels.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).select("-refreshToken");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating user",
            error: error.message,
        });
    }
};


 //  DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await UserModels.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: error.message,
        });
    }
};

 //  PATCH /admin/users/:id/verify
export const changeUserVerificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        // const { isVerified } = req.body;

        // if (typeof isVerified !== "boolean") {
        //     return res.status(400).json({
        //         success: false,
        //         message: "`isVerified` must be a boolean (true/false)",
        //     });
        // }

        const user = await UserModels.findByIdAndUpdate(
            id,
            { isVerified : true  , status: "approved" },
            { new: true }
        ).select("-refreshToken");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: `User verification status updated to ${user.isVerified}`,
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating verification status",
            error: error.message,
        });
    }
};

export const rejectUserVerification = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await UserModels.findByIdAndUpdate(
            id,
            { isVerified : false  , status: "rejected" },
            { new: true }
        ).select("-refreshToken");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: `User verification status updated to ${user.isVerified}`,
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating verification status",
            error: error.message,
        });
    }
}