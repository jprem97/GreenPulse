import express from "express";
import { protect, authorize } from "../middlewares/authmiddleware.js";
import { createClient, getClients, getClientById, updateClientStatus } from "../controllers/clientController.js";

const router = express.Router();

// Public route for the standalone Client Portal
router.post("/create-client", createClient);

// Protected routes for the Agent Dashboard
router.get("/get-clients", protect, authorize("AGENT"), getClients);
router.get("/:id", protect, authorize("AGENT"), getClientById);
router.patch("/:id/status", protect, authorize("AGENT"), updateClientStatus);

export default router;