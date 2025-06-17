import express from "express";
import { login } from "../controllers/authController.js";

const router = express.Router();
const BASE_URL = "/api/auth";

router.post(`${BASE_URL}/login`, login);

export default router;
