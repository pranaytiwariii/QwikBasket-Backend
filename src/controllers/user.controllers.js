import { generateOTP, verifyOTP } from '../utils/OTP.js';
import UserModels from "../models/user.models.js";
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const OTP = generateOTP();
console.log(OTP);

export const sendOtp = async (req,res) => {
    try{

        // user ko check karna , if new to register karna

        const {phone} = req.body;
        let user = await UserModels.findOne({ phone });
        if (!user) {
            user = await UserModels.create({ phone, isVerified: false });
        }

        // otp send karna


    }
    catch (error) {}
}
export const verifyOtp = () => {
    // Logic to verify OTP
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