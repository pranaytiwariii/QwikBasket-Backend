import UserModels from "../models/user.models.js";
import twilio from 'twilio';
import dotenv from "dotenv";
import {generateAccessToken, generateRefreshToken} from "../utils/JWT.js";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// const OTP = generateOTP();
// console.log(OTP);

export const sendOtp = async (req,res) => {
    try{
        // user ko check karna , if new to register karna
        const {phone} = req.body;
        let user = await UserModels.findOne({ phone });
        if (!user) {
            user = await UserModels.create({ phone, isVerified: false });
        }
        // otp send karna
        const verification = await client.verify.v2.services(process.env.VERIFICATION_SID)
            .verifications
            .create({ to: phone, channel: 'sms' });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            // data: verification,
            status: verification.status,
        });
    }
    catch (err) {
        return res.status(400).json({ success : false , error: err.message , data: "error sending OTP" });
    }
}


export const verifyOtp = async (req,res) => {
    // Logic to verify OTP
    try{
        const {phone, code} = req.body;
        // console.log("OTP received:", code);
        const check = await client.verify.v2.services(process.env.VERIFICATION_SID)
            .verificationChecks
            .create({ to: phone, code: code });
        if (check.status === 'approved') {
            const user = await UserModels.findOneAndUpdate(
                { phone },
                { $set: { isVerified: true } },
                { new: true }
            );
            const accessToken = generateAccessToken({user : user._id, phone: user.phone, isVerified: user.isVerified});
            user.refreshToken = generateRefreshToken({user : user._id, phone: user.phone, isVerified: user.isVerified});
            await user.save();

            return res.status(200).json({
                success: true,
                message: "User verified successfully",
                accessToken,
                refreshToken: user.refreshToken,
                status: check.status,
            });
        }
        return res.status(400).json({
            success: false,
            message: "Invalid OTP",
            status: check.status,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message , data: "error sending OTP" });
    }
}

export const UserVerification = async (req,res) => {
    try {
        const {phone} = req.body;
        const user = await UserModels.findOne({phone});
        if (user && user.isVerified) {
            return res.status(200).json({
                success: true,
                message: "User is verified",
                isVerified: user.isVerified,
            });
        } else {
            return res.status(200).json({
                success: false,
                message: "User is not verified",
                isVerified: user ? user.isVerified : false,
            });
        }
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message, data: "error checking verification" });
    }
}

export const updateProfile = () => {
    // Logic to update user profile
}

export const getUserDetails = () => {
    // Logic to get user details
}
export const deleteUserAccount = () => {
    // Logic to delete user account
}