// models/Image.js

import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  imageUrl: {
    type: String,
    required: true
  },

  imageType: {
    type: String,
    enum: ["WASTE", "PLANT"],
    required: true
  },

  classification: {
    type: String,
    enum: ["GOOD", "MEDIUM", "BAD", "INVALID"],
    default: "INVALID"
  },

  confidenceScore: {
    type: Number,
    default: 0
  },

  ecoPointsAwarded: {
    type: Number,
    default: 0
  },

  aiResponse: {
    type: String
  }

}, { timestamps: true });

export default mongoose.model("Image", imageSchema);