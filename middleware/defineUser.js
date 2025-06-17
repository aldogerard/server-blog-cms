// middlewares/isAdmin.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const defineUser = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader === undefined) {
            next();
            return;
        }
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid" });
    }
};
