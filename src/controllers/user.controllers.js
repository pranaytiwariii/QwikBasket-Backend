import UserModels from "../models/user.models.js";
import twilio from 'twilio';
import dotenv from "dotenv";
import {generateAccessToken, generateRefreshToken} from "../utils/JWT.js";
import businessDetailsModels from "../models/businessDetails.models.js";
import addressModels from "../models/address.models.js";

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

        // otp send karna
        // const verification = await client.verify.v2.services(process.env.VERIFICATION_SID)
        //     .verifications
        //     .create({ to: phone, channel: 'sms' });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            // data: verification,
            // status: verification.status,
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
        let user = await UserModels.findOne({ phone });
        if (!user) {
            user = await UserModels.create({ phone : phone});
        }

        // console.log("OTP received:", code);
        // const check = await client.verify.v2.services(process.env.VERIFICATION_SID)
        //     .verificationChecks
        //     .create({ to: phone, code: code });
        //

        // if (check.status === 'approved')
        if (code === "123456"){ // For testing purposes, accept "123456" as valid OTP{
            const user = await UserModels.findOne({ phone });
            const payload = {
                user: user._id,
                phone: user.phone,
                isVerified: user.isVerified,
                userType: user.userType,
            };

            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);
            user.refreshToken = refreshToken;
            await user.save();

            return res.status(200).cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                maxAge: 15 * 60 * 1000,
            }).cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            }).json({
                success: true,
                message: "User verified successfully",
                accessToken,
                refreshToken,
                status: user.status,
            });
        }
        return res.status(400).json({
            success: false,
            message: "Invalid OTP",
            // status: check.status,
        });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message , data: "error sending OTP" });
    }
}

export const UserVerification = async (req,res) => {
    try {
        const { phone } = req.params;

        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const user = await UserModels.findOne({phone});
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        if (user.isVerified) {
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

export const businessDetails = async (req,res) => {
    const {phone , name , email , businessName , businessType , gstNumber , fssaiLicense } = req.body;
    try {
        let user = await UserModels.findOne({phone});
        if(!user){
            return res.status(400).json({ success: false, message: "User not found" });
        }
        const id = user._id;

        let userD = await businessDetailsModels.create({userId: id , name , email , businessName , businessType , gstNumber , fssaiLicense });

        user.status = "exists";
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Business details registered successfully",
            data: userD,
        });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message, data: "Business details registration failed" });
    }
}

export const getBusinessDetails = async (req,res) => {
    const {phone} = req.params;
    try {
        let user = await UserModels.findOne({phone});
        if(!user){
            return res.status(400).json({ success: false, message: "User not found" });
        }
        const id = user._id;

        let userD = await businessDetailsModels.findOne({userId: id});

        return res.status(200).json({
            success: true,
            message: "Business details fetched successfully",
            data: userD,
        });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message, data: "Fetching Business details failed" });
    }
}

export const addressDetails = async (req,res) => {
    const {phone , completeAddress , landmark , pincode , city , state , addressNickname , location  } = req.body;

    try {
        let user = await UserModels.findOne({phone});
        if(!user){
            return res.status(400).json({ success: false, message: "User not found" });
        }
        const id = user._id;

        let userD = await addressModels.create({userId: id , completeAddress , landmark , pincode , city , state , addressNickname , location  });
        user.status = "pending";
        await user.save();
        if (!addressNickname) userD.AddressType = addressNickname;

        return res.status(200).json({
            success: true,
            message: "Address details registered successfully",
            data: userD,
        });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message, data: "Address details registration failed" });
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