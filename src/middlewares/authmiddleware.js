import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let accessToken = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
    const refreshToken = req.cookies.refreshToken;

    // 1. If access token exists → try to verify it
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
        return next();
      } catch {
        // expired → fall through to refresh logic
      }
    }

    // 2. Try refresh token
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
          return res.status(401).json({ message: "Invalid session" });
        }

        const newAccessToken = jwt.sign(
          { id: user._id, role: user.role },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );

        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: false
        });

        req.user = user;
        return next();

      } catch {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
    }

    // 3. No tokens
    return res.status(401).json({ message: "Not authenticated" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ROLE GUARD
// FIX: added null-check on req.user to prevent crash if protect somehow didn't set it
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
