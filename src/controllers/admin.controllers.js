import UserModels from "../models/user.models.js";

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

//  PUT /admin/users/:id
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const user = await UserModels.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).select("-password -refreshToken");

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
        const { isVerified } = req.body;

        if (typeof isVerified !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "`isVerified` must be a boolean (true/false)",
            });
        }

        const user = await UserModels.findByIdAndUpdate(
            id,
            { isVerified },
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
            message: `User verification status updated to ${isVerified}`,
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
