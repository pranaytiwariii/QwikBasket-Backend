import {Router} from "express";
import {
    addressDetails,
    businessDetails,
    sendOtp,
    UserVerification,
    verifyOtp
} from "../controllers/user.controllers.js";
import {refreshToken , verifyToken} from "../middlewares/auth.middlewares.js";

const router = Router();

//public routes
router.route('/send-otp').post(sendOtp);
router.route('/verify-otp').post(verifyOtp);
router.post("/refresh-token", refreshToken);


//protected routes
router.route('/register').post(businessDetails)
router.route('/address').post(addressDetails)
router.route('/verification/:phone').get(UserVerification);

export default router;