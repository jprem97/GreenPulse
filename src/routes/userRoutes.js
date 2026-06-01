import express from "express";
import {
  register,
  login,
  logout
} from "../controllers/userController.js";
import { upload } from "../middlewares/multermiddleware.js";
const router = express.Router();

// AUTH
router.post("/register",upload.single("image"), register);
router.post("/login", login);
router.post("/logout", logout);

export default router;