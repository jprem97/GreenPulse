// routes/adminRoutes.js
import express from "express";
import {
  getAgentsByLocation,
  getAgentPerformance
} from "../controllers/adminController.js";

import { protect, authorize } from "../middlewares/authmiddleware.js";

const router = express.Router();

// 🔍 filter agents by location
router.get(
  "/agents-by-location",
  protect,
  authorize("ADMIN"),
  getAgentsByLocation
);

// 📊 performance report
router.get(
  "/agent-performance",
  protect,
  authorize("ADMIN"),
  getAgentPerformance
);

export default router;