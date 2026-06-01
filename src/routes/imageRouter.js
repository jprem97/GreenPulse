import express from "express";

import { protect } from "../middlewares/authmiddleware.js";

import { upload } from "../middlewares/multermiddleware.js";

import { imgHandler } from "../controllers/imagecontroller.js";

const router = express.Router();

router.post(
  "/analyze",
  protect,
  upload.single("image"),
  imgHandler
);

export default router;