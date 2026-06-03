import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({

  company: {
    type: String,
    required: true,
    trim: true
  },

  product: {
    type: String,
    required: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    unique: true
  },

  pointsRequired: {
    type: Number,
    required: true
  },

  redeemedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  launchDate: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ["ACTIVE", "EXPIRED"],
    default: "ACTIVE"
  }

}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema); 