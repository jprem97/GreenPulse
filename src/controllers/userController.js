import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import User from "../models/User.js";
import  { cloudUpload }  from "../utils/cloudinary.js";
import { getLevelProgress, ACHIEVEMENTS } from "../utils/levels.js"; 


const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

  } catch (error) {
    throw new Error("Something went wrong while generating refresh and access token"); 
  }
};

function buildUserResponse(user) {
  const levelProgress = getLevelProgress(user.gp);
  const stats = {
    totalImages: user.totalImages || 0,
    bestScore: user.bestScore || 0,
    maxSingleGP: user.maxSingleGP || 0,
    goodCount: user.goodCount || 0,
    streak: user.streak || 0,
    totalGP: user.gp || 0,
    levelIndex: levelProgress.index,
  };
  const achievements = ACHIEVEMENTS
    .filter(a => a.condition(stats))
    .map(a => a.id);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profilePic: user.profilePic,
    gp: user.gp,
    level: user.level,
    totalImages: user.totalImages || 0,
    bestScore: user.bestScore || 0,
    maxSingleGP: user.maxSingleGP || 0,
    goodCount: user.goodCount || 0,
    streak: user.streak || 0,
    duplicateWarnings: user.duplicateWarnings || 0,
    isFlagged: user.isFlagged || false,
    levelProgress,
    achievements,
  };
}

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    const profilePicPath = req.file.path;
    if (!fs.existsSync(profilePicPath)) {
      return res.status(400).json({ message: "Profile picture file not found" });
    }

    const profilePic = await cloudUpload(profilePicPath);
    if (!profilePic || !(profilePic.secure_url || profilePic.url)) {
      if (fs.existsSync(profilePicPath)) fs.unlinkSync(profilePicPath);
      return res.status(500).json({ message: "Profile picture upload failed" });
    }

    const user = await User.create({
      name,
      email,
      password,
      profilePic: profilePic.secure_url || profilePic.url
    });

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false
      })
      .json({
        message: "Registered successfully",
        accessToken,
        user: buildUserResponse(user)
      });

  } catch (err) {
    res.status(500).json({
      message: "Registration failed",
      error: err.message
    });
  }
};


export const login = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Missing request body" });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);

    // FIX: removed redundant user.refreshToken + save() — generator already handles it

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: false
      })
      .json({
        message: "Login successful",
        accessToken,
        user: buildUserResponse(user)
      });

  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};


export const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
      } catch {
      }
    }

    res
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .json({ message: "Logged out" });

  } catch (err) {
    res
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .json({ message: "Logged out" });
  }
};


export const  profile = ()=>{
  try {
    
  } catch (error) {
    
  }
}