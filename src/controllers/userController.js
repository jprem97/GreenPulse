import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import User from "../models/User.js";
import  { cloudUpload }  from "../utils/cloudinary.js"; 


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


/* =========================
   REGISTER
========================= */

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
    const profilePic = await cloudUpload(profilePicPath);
    if (!fs.existsSync(profilePicPath)) {
      return res.status(400).json({ message: "Profile picture file not found" });
    }
    

    if (!profilePic || !(profilePic.secure_url || profilePic.url)) {
      if (fs.existsSync(profilePicPath)) fs.unlinkSync(profilePicPath);
      return res.status(500).json({ message: "Profile picture upload failed" });
    }
    
    const user = await User.create({
      name,
      email,
      password,
      profilePic: profilePic.url
    });

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
        message: "Registered successfully",
        accessToken,
        user: { id: user._id, name: user.name, email: user.email }
      });

  } catch (err) {
    res.status(500).json({
      message: "Registration failed",
      error: err.message
    });
  }
};


/* =========================
   LOGIN
========================= */

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      });

  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};


/* =========================
   LOGOUT
========================= */

export const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
      } catch {
        // token invalid but we still clear cookies below
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