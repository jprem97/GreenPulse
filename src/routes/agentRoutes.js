import express from "express";
import { protect, authorize } from "../middlewares/authmiddleware.js";
import { getMyProfile, getNotifications, markNotificationRead } from "../controllers/agentController.js";

const router = express.Router();

router.get("/get-my-profile", protect, authorize("AGENT"), getMyProfile);
router.get("/get-notifications", protect, authorize("AGENT"), getNotifications);
router.patch("/mark-notification-read/:id", protect, authorize("AGENT"), markNotificationRead);

export default router;