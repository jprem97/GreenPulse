import express from "express";
import { protect, authorize } from "../middlewares/authmiddleware.js";
import { createProperty, getProperties, searchProperties } from "../controllers/propertyController.js";

const router = express.Router();

router.post("/create-property", protect, authorize("AGENT"), createProperty);
router.get("/get-properties", protect, authorize("AGENT"), getProperties);
router.get("/search", searchProperties);

export default router;