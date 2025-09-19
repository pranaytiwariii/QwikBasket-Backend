import {Router} from "express";
import {sendOtp, UserVerification, verifyOtp} from "../controllers/user.controllers.js";
import {refreshToken} from "../middlewares/auth.middlewares.js";

const router = Router();

router.route('/send-otp').post(sendOtp);
router.route('/verify-otp').post(verifyOtp);
router.route('/verification').get(UserVerification);
router.post("/refresh-token", refreshToken);

export default router;