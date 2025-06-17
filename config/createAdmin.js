import "dotenv/config";

import db from "../config/db.js";
import bcrypt from "bcrypt";
import moment from "moment-timezone";

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    try {
        const { data, error: fetchError } = await db
            .from("users")
            .select("*")
            .eq("email", email);

        if (fetchError) throw new Error(fetchError.message);
        if (data.length > 0) {
            console.log("ℹ️ Admin already exists, skip creation.");
            return;
        }

        const hashed = bcrypt.hashSync(password, 10);

        const { error: insertError } = await db
            .from("users")
            .insert([
                {
                    name: "Admin",
                    email: email,
                    password: hashed,
                    role: "admin",
                    created_at: moment()
                        .tz("Asia/Jakarta")
                        .format("YYYY-MM-DD HH:mm:ss"),
                },
            ])
            .select();

        if (insertError) {
            throw new Error(insertError.message);
        }
        console.log("✅ Admin created successfully.");
    } catch (error) {
        console.error("Error creating default admin : ", error.message);
    }
}

export default createAdmin;
