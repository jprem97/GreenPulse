import express from "express";
import {
  createDeal,
  getDeals,
  getDealById,
  updateDealStatus
} from "../controllers/dealController.js";
import { protect } from "../middlewares/authmiddleware.js";

const router = express.Router();

// CREATE
router.post("/create-deal", protect, createDeal);

// READ
router.get("/get-deals", protect, getDeals);
router.get("/get-deal/:id", protect, getDealById);

// UPDATE
router.patch("/update-deal-status/:id", protect, updateDealStatus);

export default router;