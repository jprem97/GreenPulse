import fs from "fs";
import crypto from "crypto";

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

import { cloudUpload } from "../utils/cloudinary.js";

import Image from "../models/Image.js";

export const imgHandler = async (req, res) => {

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  try {

    // ===================================================
    // CHECK FILE
    // ===================================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    // ===================================================
    // READ FILE
    // ===================================================

    if (!req.file.path || !fs.existsSync(req.file.path)) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file not found",
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    // ===================================================
    // GENERATE HASH
    // ===================================================

    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // ===================================================
    // DUPLICATE CHECK
    // ===================================================

    const oldImage = await Image.findOne({ imageHash: hash });

    if (oldImage) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Old image already used",
      });
    }

    // ===================================================
    // LOCATE PYTHON SCRIPT
    // ===================================================

    const pythonScript = path.resolve(__dirname, "../ml/ecoModel2.py");

    if (!fs.existsSync(pythonScript)) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({
        success: false,
        message: "AI model script not found",
        error:   pythonScript,
      });
    }

    // ===================================================
    // RUN PYTHON MODEL
    // ===================================================

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

    // ===================================================
    // WHEN PYTHON FINISHES
    // ===================================================

    pythonProcess.on("close", async (code) => {

      // helper: clean up local file and respond
      const cleanup = () => {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      };

      try {

        // ==============================================
        // VALIDATE RAW OUTPUT
        // ==============================================

        if (!resultData || resultData.trim() === "") {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "AI processing failed",
            error:   "No response from AI model",
            details: stderrData || `process exited with code ${code}`,
          });
        }

        // ==============================================
        // PARSE JSON
        // ==============================================

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

        // ==============================================
        // REJECT INVALID — before any upload or DB write
        //
        // Python is the single source of truth.
        // If it says INVALID, stop here.
        // Do NOT upload to Cloudinary.
        // Do NOT save to the database.
        // ==============================================

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

        // ==============================================
        // UPLOAD TO CLOUDINARY
        // Only reached for GOOD / MEDIUM / BAD
        // ==============================================

        const uploadedImage = await cloudUpload(req.file.path);

        if (!uploadedImage) {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "Cloudinary upload failed",
          });
        }

        // local file no longer needed after upload
        cleanup();

        // ==============================================
        // SAVE TO DATABASE
        // All scored fields come from Python — never
        // computed independently in Node.js.
        // ==============================================

        const savedImage = await Image.create({
          user:             req.user._id,
          imageUrl:         uploadedImage.secure_url,
          imageHash:        hash,
          imageType:        "WASTE",
          classification:   aiResult.classification,    // Python only
          confidenceScore:  aiResult.score,             // Python only
          score:            aiResult.score,             // Python only
          ecoPointsAwarded: aiResult.gp,                // Python only
          detectedObjects:  aiResult.detectedObjects,   // Python only
          sceneAnalysis:    aiResult.sceneAnalysis,      // Python only
          feedback:         aiResult.feedback,           // Python only
          isBlurry:         false,
          isDuplicate:      false,
          isFraudulent:     false,
        });

        // ==============================================
        // SUCCESS RESPONSE
        // ==============================================

        return res.status(200).json({
          success: true,
          data:    savedImage,
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