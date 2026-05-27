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

  imageHash: {
    type: String,
    unique: true
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

  score: {
    type: Number,
    default: 0
  },

  ecoPointsAwarded: {
    type: Number,
    default: 0
  },

  
  detectedObjects: [{
    name: String,
    category: String,
    confidence: Number
  }],

  sceneAnalysis: {
    edgeDensity: Number,
    brightness: Number,
    sharpness: Number
  },

  
  isDuplicate: {
    type: Boolean,
    default: false
  },

  isBlurry: {
    type: Boolean,
    default: false
  },

  isFraudulent: {
    type: Boolean,
    default: false
  },

 
  feedback: [{
    type: String
  }],

  aiResponse: {
    type: String
  }

}, { timestamps: true });

export default mongoose.model("Image", imageSchema);