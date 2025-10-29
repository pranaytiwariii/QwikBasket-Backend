import UserModels from "../models/user.models.js";
import jwt from "jsonwebtoken";

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Access token missing or malformed" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: "Invalid or expired access token" });
    }
};


export const refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

        const user = await UserModels.findById(decoded.user);
        if (!user || user.refreshToken !== token) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }
        const newAccessToken = jwt.sign(
            { userId: user._id, phone: user.phone },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "15m" }
        );

        req.user = user;

        return res.status(200).json({
            success: true,
            message: "Access token refreshed successfully",
            accessToken: newAccessToken,
            expiresIn: "15m",
        });
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
};

// 👑 Middleware to verify admin privileges
export const verifyAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }
        if (req.user.userType !== "admin") {
            return res.status(403).json({ success: false, message: "Admin privileges required" });
        }
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: "Server error verifying admin" });
    }
};


