// middlewares/isAdmin.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const isAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Cek apakah role-nya admin
        if (decoded.role !== "admin") {
            return res.status(403).json({ message: "Forbidden. Admin only." });
        }

        // Simpan user di req.user untuk keperluan selanjutnya
        req.user = decoded;

        next(); // Lanjut ke controller
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};
