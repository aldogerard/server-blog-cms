import express from "express";
import {
    getUserById,
    updatePasswordById,
    updateUserById,
} from "../controllers/usersController.js";

const router = express.Router();
const BASE_URL = "/api/users";

router.get(`${BASE_URL}/:id`, getUserById);
router.patch(`${BASE_URL}/:id`, updateUserById);
router.patch(`${BASE_URL}/password/:id`, updatePasswordById);

export default router;
