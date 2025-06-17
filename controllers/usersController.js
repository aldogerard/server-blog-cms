import bcrypt from "bcrypt";

import db from "../config/db.js";
import { failedReq, successReq } from "../utils/response.js";
import moment from "moment-timezone";

const findById = async (id) => {
    try {
        const { data: result } = await db
            .from("users")
            .select("name, email, role, created_at, updated_at")
            .eq("id", id);

        if (!result) {
            return false;
        }

        return result;
    } catch (error) {
        return false;
    }
};

export const getUserById = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await findById(id);
        if (!result) {
            successReq(res, 404, "User not found", null);
            return;
        }

        successReq(res, 200, "User found", result);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const updateUserById = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, email } = req.body;

        const result = await findById(id);
        if (!result) {
            successReq(res, 404, "User not found", null);
            return;
        }

        const { error: updateError } = await db
            .from("users")
            .update({
                name,
                email,
                updated_at: moment()
                    .tz("Asia/Jakarta")
                    .format("YYYY-MM-DD HH:mm:ss"),
            })
            .eq("id", id)
            .select();

        if (updateError) throw new Error(updateError.message);

        successReq(res, 200, "User updated", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const updatePasswordById = async (req, res) => {
    try {
        const id = req.params.id;
        const { oldPassword, newPassword } = req.body;

        // Cek apakah user ada
        const result = await findById(id);
        if (!result) {
            return successReq(res, 404, "User not found", null);
        }

        // Ambil password lama dari database
        const { data, error } = await db
            .from("users")
            .select("password")
            .eq("id", id)
            .single();

        if (error || !data) {
            return failedReq(res, 404, "User not found");
        }

        const isMatch = await bcrypt.compare(oldPassword, data.password);
        if (!isMatch) {
            return failedReq(res, 400, "Password is not valid");
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await db
            .from("users")
            .update({
                password: newPasswordHash,
                updated_at: moment()
                    .tz("Asia/Jakarta")
                    .format("YYYY-MM-DD HH:mm:ss"),
            })
            .eq("id", id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        successReq(res, 200, "Password updated successfully", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};
