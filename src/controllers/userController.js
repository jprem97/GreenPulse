import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Agent from "../models/Agent.js"; // FIX: was missing — caused crash when creating agent profile on register

/* =========================
   TOKEN HELPERS
========================= */

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

/* =========================
   REGISTER
========================= */

export const register = async (req, res) => {
  try {
    // FIX: added `location` to destructuring — was missing, causing all agents to get location "Unknown"
    const { name, email, password, role, location } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: role || "AGENT"
    });

    // FIX: Agent import was missing above — now works correctly
    if (user.role === "AGENT") {
      await Agent.create({
        user: user._id,
        location: location || "Unknown",
        serviceAreas: [location || "Unknown"],
        currentLoad: 0,
        performanceScore: 0,
        notifications: []
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

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
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
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

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

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
   REFRESH TOKEN
========================= */

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user);

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    });

    res.json({ message: "Access token refreshed" });

  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
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

    // FIX: cookies are now always cleared regardless of token validity
    res
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .json({ message: "Logged out" });

  } catch (err) {
    // FIX: even in outer catch, clear cookies so client is truly logged out
    res
      .clearCookie("accessToken")
      .clearCookie("refreshToken")
      .json({ message: "Logged out" });
  }
};
