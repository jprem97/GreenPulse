import express from "express";
import {
  getMyActivities,
  createActivity  // FIX: was not imported or routed — now wired to POST endpoint
} from "../controllers/activityController.js";
import { protect } from "../middlewares/authmiddleware.js";

const router = express.Router();

// READ
router.get("/get-my-activities", protect, getMyActivities);

// FIX: createActivity was dead code — now has an actual route
router.post("/create-activity", protect, createActivity);

export default router;
