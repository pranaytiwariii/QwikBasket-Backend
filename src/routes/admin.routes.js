import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middlewares.js";
import { verifyAdmin } from "../middlewares/auth.middlewares.js";
import {
    getAllUsers,
    updateUser,
    deleteUser,
    changeUserVerificationStatus, getUnverifiedUsers, getUserById, rejectUserVerification, getAllUsersDetails,
} from "../controllers/admin.controllers.js";


const router = Router();

router.use(verifyToken, verifyAdmin);

router.get("/allusers", getAllUsers);

router.get("/alluserdetails" , getAllUsersDetails)

router.get("/pendingusers", getUnverifiedUsers);

router.route("/usersDetails/:id").get(getUserById)

router.patch("/users/:id", updateUser);

router.delete("/users/:id", deleteUser);

router.patch("/users/:id/verify", changeUserVerificationStatus);
router.patch("/users/:id/reject", rejectUserVerification);


export default router;