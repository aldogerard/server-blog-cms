import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import db from "../config/db.js";
import { failedReq, successReq } from "../utils/response.js";

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: result } = await db
            .from("users")
            .select("id, name, email, role, password")
            .eq("email", email);

        if (result.length === 0) {
            successReq(res, 404, "Email or password is not valid", null);
            return;
        }

        const data = result[0];
        const { password: hashedPassword } = data;
        const isMatch = await bcrypt.compare(password, hashedPassword);
        if (!isMatch) {
            successReq(res, 404, "Email or password is not valid", null);
            return;
        }

        const token = jwt.sign(
            {
                id: data.id,
                email: data.email,
                role: data.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d",
            }
        );

        successReq(res, 200, "User logged in", token);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};
