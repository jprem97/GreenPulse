import express from "express";

import { Coupon } from "../models/Coupons.js";

import {
  getCoupons,
  myCoupons,
  toggleSaveCoupon,
  redeemCoupon
} from "../controllers/coupons.Controllerjs";

import {
  createCoupon,
  deactivateCoupon
} from "../controllers/adminCouponsController.js";

import { protect, authorize } from "../middlewares/authmiddleware.js";

const router = express.Router();

router.get("/", protect, getCoupons);

router.get("/me", protect, myCoupons);

router.post(
  "/:id/save",
  protect,
  toggleSaveCoupon
);

router.post(
  "/:id/redeem",
  protect,
  redeemCoupon
);

router.post(
  "/admin",
  protect,
  authorize("ADMIN"),
  createCoupon
);

router.patch(
  "/admin/:id",
  protect,
  authorize("ADMIN"),
  deactivateCoupon
);

export default router;