import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

import userRoutes from "./routes/userRoutes.js";
import imageRoutes from "./routes/imageRouter.js";
import couponsRoutes from "./routes/couponsRoutes.js";
import plantRoutes from "./routes/plantRoutes.js";

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/users", userRoutes);
app.use("/api/analyzer", imageRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/plants", plantRoutes);


app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
export default app;
