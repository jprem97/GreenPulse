import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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

  ip: {
    type: Number,
    default: 0
  },

  profilePic: {
    type: String
  },

  level: {
    type: String,
    enum: [
      "BEGINNER",
      "GREEN_WARRIOR",
      "ECO_HERO",
      "PLANET_GUARDIAN"
    ],
    default: "BEGINNER"
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

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password); // FIX: was "bycrpt" (typo)
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign( // FIX: was "jwt.encrption" (wrong method + typo)
    {
      id: this._id,
      email: this.email,
      name: this.name
    },
    process.env.REFRESH_TOKEN_SECRET, // FIX: was REFRESH_TOKEN_SCERET (typo)
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  );
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign( // FIX: was "jwt.encrption" (wrong method + typo)
    {
      id: this._id,
      email: this.email,
      name: this.name
    },
    process.env.ACCESS_TOKEN_SECRET, // FIX: was incorrectly using REFRESH_TOKEN_SECRET
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY // FIX: was incorrectly using REFRESH_TOKEN_EXPIRY
    }
  );
};

export default mongoose.model("User", userSchema);