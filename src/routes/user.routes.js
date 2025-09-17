import {Router} from "express";
import {sendOtp, verifyOtp} from "../controllers/user.controllers.js";

const router = Router();

router.route('/send-otp').post(sendOtp);
router.route('/verify-otp').post(verifyOtp);
