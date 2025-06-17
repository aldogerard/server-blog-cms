import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import usersRoute from "./routes/usersRoute.js";
import authRoute from "./routes/authRoute.js";
import articlesRoute from "./routes/articlesRoute.js";

import createAdmin from "./config/createAdmin.js";
import "./utils/scheduler.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ message: "Connection successful" });
});

app.use(usersRoute);
app.use(authRoute);
app.use(articlesRoute);

(async () => {
    await createAdmin();

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
})();
