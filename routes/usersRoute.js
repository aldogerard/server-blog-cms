import express from "express";
import {
    getUserById,
    updatePasswordById,
    updateUserById,
} from "../controllers/usersController.js";
import { isAdmin } from "../middleware/isAdmin.js";

const router = express.Router();
const BASE_URL = "/api/users";

router.get(`${BASE_URL}/:id`, isAdmin, getUserById);
router.patch(`${BASE_URL}/:id`, isAdmin, updateUserById);
router.patch(`${BASE_URL}/password/:id`, isAdmin, updatePasswordById);

export default router;
