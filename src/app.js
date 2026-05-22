import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

// ROUTES
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import dealRoutes from "./routes/dealRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// Fix __dirname for ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middlewares — must be before routes
app.use(cors());
app.use(express.json());
app.use(cookieParser()); // FIX: was registered AFTER routes — cookies were never parsed

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/admin", adminRoutes);
// // Serve Frontend (frontend folder)
// app.use(express.static(frontendPath));

// // Root + fallback
// app.use((req, res) => {
//   res.sendFile(path.join(frontendPath, "index.html"));
// });
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
export default app;
