import express from "express";
import {
  register,
  login,
  refreshToken,
  logout
} from "../controllers/userController.js";

const router = express.Router();

// AUTH
router.post("/register", register);
router.post("/login", login);
router.post ("/refresh", refreshToken);
router.post("/logout", logout);

export default router;