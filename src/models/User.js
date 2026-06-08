import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { LEVELS, getLevelForGP } from "../utils/levels.js";

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  gp: {
    type: Number,
    default: 0
  },

  profilePic: {
    type: String
  },

  level: {
    type: String,
    enum: LEVELS.map(l => l.name),
    default: "SEEDLING"
  },

  role: {
    type: String,
    enum: ["USER", "ADMIN"],
    default: "USER"
  },

  totalImages: {
    type: Number,
    default: 0
  },

  bestScore: {
    type: Number,
    default: 0
  },

  maxSingleGP: {
    type: Number,
    default: 0
  },

  goodCount: {
    type: Number,
    default: 0
  },

  streak: {
    type: Number,
    default: 0
  },

  lastUploadDate: {
    type: Date,
    default: null
  },

  unlockedAchievements: {
    type: [String],
    default: []
  },

  duplicateWarnings: {
    type: Number,
    default: 0
  },

  isFlagged: {
    type: Boolean,
    default: false
  },

  totalPlantations: {
    type: Number,
    default: 0
  },

  completedPlantations: {
    type: Number,
    default: 0
  },

  bestPlantAvgScore: {
    type: Number,
    default: 0
  },

  maxPlantStreak: {
    type: Number,
    default: 0
  },

  verifiedUploads: {
    type: Number,
    default: 0
  },

  refreshToken: {
    type: String,
    default: null
  }

}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.updateLevel = function () {
  const lvl = getLevelForGP(this.gp);
  this.level = lvl.name;
};

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      name: this.name
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  );
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      name: this.name
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};

export default mongoose.model("User", userSchema);
