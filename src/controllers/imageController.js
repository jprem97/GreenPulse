import fs from "fs";
import crypto from "crypto";

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

import { cloudUpload } from "../utils/cloudinary.js";
import { computeStreak } from "../utils/levels.js";

import User from "../models/User.js";
import Image from "../models/Image.js";

export const imgHandler = async (req, res) => {

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    if (!req.file.path || !fs.existsSync(req.file.path)) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file not found",
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const oldImage = await Image.findOne({ imageHash: hash });

    if (oldImage) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Old image already used",
      });
    }

    const pythonScript = path.resolve(__dirname, "../ml/ecoModel2.py");

    if (!fs.existsSync(pythonScript)) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({
        success: false,
        message: "AI model script not found",
        error:   pythonScript,
      });
    }

    const pythonCmd     = process.env.PYTHON || "./.venv/Scripts/python.exe";
    const pythonProcess = spawn(pythonCmd, [pythonScript, req.file.path]);

    let resultData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
      console.log("Python stderr:", data.toString());
    });

    pythonProcess.on("close", async (code) => {

      const cleanup = () => {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      };

      try {

        if (!resultData || resultData.trim() === "") {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "AI processing failed",
            error:   "No response from AI model",
            details: stderrData || `process exited with code ${code}`,
          });
        }

        let aiResult;
        try {
          aiResult = JSON.parse(resultData);
        } catch (parseErr) {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "AI processing failed",
            error:   "Invalid JSON from AI model",
            raw:     resultData.slice(0, 200),
          });
        }

        if (aiResult.classification === "INVALID") {
          cleanup();
          return res.status(400).json({
            success:        false,
            classification: "INVALID",
            score:          0,
            gp:             0,
            reason:         aiResult.reason ?? "Image did not pass waste validation.",
          });
        }

        const uploadedImage = await cloudUpload(req.file.path);

        if (!uploadedImage) {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "Cloudinary upload failed",
          });
        }

        cleanup();

        const savedImage = await Image.create({
          user:             req.user._id,
          imageUrl:         uploadedImage.secure_url,
          imageHash:        hash,
          imageType:        "WASTE",
          classification:   aiResult.classification,
          confidenceScore:  aiResult.score,
          score:            aiResult.score,
          ecoPointsAwarded: aiResult.gp,
          detectedObjects:  aiResult.detectedObjects,
          sceneAnalysis:    aiResult.sceneAnalysis,
          feedback:         aiResult.feedback,
          isBlurry:         false,
          isDuplicate:      false,
          isFraudulent:     false,
        });

        let updatedUser = null;
        try {
          const points = Number(aiResult.gp) || 0;
          if (points > 0 && req.user && req.user._id) {
            const updates = { $inc: { gp: points, totalImages: 1 } };

            if (aiResult.score > 0) {
              updates.$max = { bestScore: aiResult.score };
            }
            if (points > 0) {
              updates.$max = { ...updates.$max, maxSingleGP: points };
            }
            if (aiResult.classification === "GOOD") {
              updates.$inc.goodCount = 1;
            }

            updates.lastUploadDate = new Date();

            const beforeUser = await User.findById(req.user._id);
            const oldStreak = beforeUser?.streak || 0;
            const oldDate = beforeUser?.lastUploadDate;
            const newStreak = computeStreak(oldDate, oldStreak);
            updates.streak = newStreak;

            updatedUser = await User.findByIdAndUpdate(
              req.user._id,
              updates,
              { new: true }
            );

            if (updatedUser) {
              updatedUser.updateLevel();
              await updatedUser.save({ validateBeforeSave: false });
            }
          }
        } catch (uErr) {
          console.error("Failed to update user gp:", uErr.message || uErr);
        }

        return res.status(200).json({
          success: true,
          data:    savedImage,
          updatedUser: updatedUser ? {
            gp: updatedUser.gp,
            level: updatedUser.level,
            totalImages: updatedUser.totalImages,
            streak: updatedUser.streak,
          } : null,
        });

      } catch (error) {
        cleanup();
        return res.status(500).json({
          success: false,
          message: "AI processing failed",
          error:   error.message,
        });
      }
    });

  } catch (error) {

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: "Image processing failed",
      error:   error.message,
    });
  }
};