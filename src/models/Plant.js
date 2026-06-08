import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema({
  week: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  imageHash: { type: String },
  gpAwarded: { type: Number, default: 0 },
  aiResponse: {
    valid: { type: Boolean, default: false },
    samePlant: { type: Boolean, default: false },
    growthDetected: { type: Boolean, default: false },
    growthQuality: { type: String, default: "POOR" },
    plantHealth: { type: String, default: "POOR" },
    fraudDetected: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    feedback: [{ type: String }],
  },
  verificationCodeVerified: { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now },
});

const plantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plantName: {
      type: String,
      required: true,
      trim: true,
    },
    plantType: {
      type: String,
      enum: ["TREE", "FLOWER", "VEGETABLE", "INDOOR"],
      required: true,
    },
    durationWeeks: {
      type: Number,
      enum: [4, 8, 12],
      required: true,
    },
    verificationCode: {
      type: String,
      required: true,
    },
    currentStage: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "ABANDONED"],
      default: "ACTIVE",
    },
    totalGp: {
      type: Number,
      default: 0,
    },
    uploads: [uploadSchema],
  },
  { timestamps: true }
);

plantSchema.index({ user: 1, status: 1 });
plantSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Plant", plantSchema);
