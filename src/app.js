import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

// ROUTES
import userRoutes from "./routes/userRoutes.js";
import imageRoutes from "./routes/imageRouter.js"

const app = express();

// Fix __dirname for ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middlewares — must be before routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // FIX: was registered AFTER routes — cookies were never parsed

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/analyzer", imageRoutes);


app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
export default app;
