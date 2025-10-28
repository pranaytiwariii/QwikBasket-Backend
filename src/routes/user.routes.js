import {Router} from "express";
import {
    addressDetails,
    businessDetails, getBusinessDetails,
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
router.route('/register').post(verifyToken,businessDetails)
router.route('/business/:phone').get(verifyToken , getBusinessDetails)
router.route('/address').post(verifyToken , addressDetails)
router.route('/verification/:phone').get(verifyToken , UserVerification);

export default router;