import express from "express";
import { protect } from "../middlewares/authmiddleware.js";
import { upload } from "../middlewares/multermiddleware.js";
import {
  createPlantation,
  uploadPlantStage,
  getMyPlantations,
  getPlantationById,
  deletePlantation,
} from "../controllers/plantController.js";

const router = express.Router();

router.post("/create", protect, createPlantation);
router.post("/:id/upload", protect, upload.single("image"), uploadPlantStage);
router.get("/my", protect, getMyPlantations);
router.get("/:id", protect, getPlantationById);
router.delete("/:id", protect, deletePlantation);

export default router;
