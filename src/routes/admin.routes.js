import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middlewares.js";
import { verifyAdmin } from "../middlewares/auth.middlewares.js";
import {
    getAllUsers,
    updateUser,
    deleteUser,
    changeUserVerificationStatus,
} from "../controllers/admin.controllers.js";


const router = Router();

router.use(verifyToken, verifyAdmin);

router.get("/users", getAllUsers);

router.put("/users/:id", updateUser);

router.delete("/users/:id", deleteUser);

router.patch("/users/:id/verify", changeUserVerificationStatus);

export default router;