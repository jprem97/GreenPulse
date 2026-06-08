import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

import { cloudUpload } from "../utils/cloudinary.js";
import Plant from "../models/Plant.js";
import User from "../models/User.js";
import {
  getStagesForDuration,
  getNextStage,
  isFirstUpload,
  isJourneyComplete,
  calculateStageGP,
  generateVerificationCode,
  CREATION_GP,
  COMPLETION_GP,
} from "../utils/plantStages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createPlantation = async (req, res) => {
  try {
    const { plantName, plantType, durationWeeks } = req.body;

    if (!plantName || !plantType || !durationWeeks) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (!["TREE", "FLOWER", "VEGETABLE", "INDOOR"].includes(plantType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plant type" });
    }

    if (![4, 8, 12].includes(Number(durationWeeks))) {
      return res
        .status(400)
        .json({ success: false, message: "Duration must be 4, 8, or 12 weeks" });
    }

    const activeCount = await Plant.countDocuments({
      user: req.user._id,
      status: "ACTIVE",
    });
    if (activeCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 active plantations allowed",
      });
    }

    const verificationCode = generateVerificationCode();

    const plant = await Plant.create({
      user: req.user._id,
      plantName: plantName.trim(),
      plantType,
      durationWeeks: Number(durationWeeks),
      verificationCode,
      currentStage: 0,
      status: "ACTIVE",
      totalGp: CREATION_GP,
    });

    const user = await User.findById(req.user._id);
    if (user) {
      user.gp = (user.gp || 0) + CREATION_GP;
      user.updateLevel();
      await user.save({ validateBeforeSave: false });
    }

    const stages = getStagesForDuration(Number(durationWeeks));

    return res.status(201).json({
      success: true,
      message: "Plantation created! +5 GP awarded",
      gpAwarded: CREATION_GP,
      plant: {
        id: plant._id,
        plantName: plant.plantName,
        plantType: plant.plantType,
        durationWeeks: plant.durationWeeks,
        verificationCode: plant.verificationCode,
        currentStage: plant.currentStage,
        status: plant.status,
        totalGp: plant.totalGp,
        stages,
        createdAt: plant.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create plantation",
      error: error.message,
    });
  }
};

export const uploadPlantStage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }

    if (!req.file.path || !fs.existsSync(req.file.path)) {
      return res
        .status(400)
        .json({ success: false, message: "Uploaded file not found" });
    }

    const plant = await Plant.findById(id);

    if (!plant) {
      fs.unlinkSync(req.file.path);
      return res
        .status(404)
        .json({ success: false, message: "Plantation not found" });
    }

    if (plant.user.toString() !== req.user._id.toString()) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (plant.status !== "ACTIVE") {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Plantation is ${plant.status.toLowerCase()}`,
      });
    }

    const stages = getStagesForDuration(plant.durationWeeks);
    const firstStage = stages[0];
    const is_first = isFirstUpload(plant.durationWeeks);
    const expectedNext = is_first
      ? firstStage
      : getNextStage(plant.durationWeeks, plant.currentStage);

    if (expectedNext === null) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ success: false, message: "All stages already completed" });
    }

    const alreadyUploaded = plant.uploads.some(
      (u) => u.week === expectedNext
    );
    if (alreadyUploaded) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ success: false, message: "Stage already completed" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const duplicateInPlant = plant.uploads.some((u) => u.imageHash === hash);
    if (duplicateInPlant) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Duplicate image detected for this plantation",
      });
    }

    let previousImagePath = null;
    if (plant.uploads.length > 0) {
      const lastUpload = plant.uploads[plant.uploads.length - 1];
      if (lastUpload.imageUrl) {
        const tmpDir = path.resolve(__dirname, "../public/assests");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        previousImagePath = path.join(tmpDir, `prev_${id}_${lastUpload.week}.jpg`);
        try {
          const response = await fetch(lastUpload.imageUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(previousImagePath, buffer);
        } catch {
          previousImagePath = null;
        }
      }
    }

    const pythonScript = path.resolve(__dirname, "../ml/plantAnalyzer.py");
    if (!fs.existsSync(pythonScript)) {
      fs.unlinkSync(req.file.path);
      if (previousImagePath && fs.existsSync(previousImagePath))
        fs.unlinkSync(previousImagePath);
      return res
        .status(500)
        .json({ success: false, message: "AI model script not found" });
    }

    const pythonCmd = process.env.PYTHON || "./.venv/Scripts/python.exe";
    const pythonProcess = spawn(pythonCmd, [
      pythonScript,
      req.file.path,
      previousImagePath || "null",
      plant.plantName,
      plant.plantType,
      String(expectedNext),
      String(plant.durationWeeks),
      plant.verificationCode,
      String(is_first),
    ]);

    let resultData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      const cleanup = () => {
        if (req.file && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path);
        if (previousImagePath && fs.existsSync(previousImagePath))
          fs.unlinkSync(previousImagePath);
      };

      try {
        if (!resultData || resultData.trim() === "") {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "AI processing failed",
            error: "No response from AI model",
            details: stderrData || `process exited with code ${code}`,
          });
        }

        let aiResult;
        try {
          aiResult = JSON.parse(resultData);
        } catch {
          cleanup();
          return res.status(500).json({
            success: false,
            message: "AI processing failed",
            error: "Invalid JSON from AI model",
            raw: resultData.slice(0, 200),
          });
        }

        if (!aiResult.valid || aiResult.fraudDetected) {
          cleanup();
          return res.status(400).json({
            success: false,
            message:
              aiResult.feedback?.join(". ") || "Image validation failed",
            aiResponse: aiResult,
          });
        }

        const uploadedImage = await cloudUpload(req.file.path);
        if (!uploadedImage) {
          cleanup();
          return res
            .status(500)
            .json({ success: false, message: "Cloud upload failed" });
        }

        cleanup();

        const totalStages = stages.length;
        const stageIndex = stages.indexOf(expectedNext);
        const gpAwarded = calculateStageGP(
          plant.plantType,
          stageIndex,
          totalStages,
          aiResult.score
        );

        plant.uploads.push({
          week: expectedNext,
          imageUrl: uploadedImage.secure_url,
          gpAwarded,
          aiResponse: {
            valid: aiResult.valid,
            samePlant: aiResult.samePlant,
            growthDetected: aiResult.growthDetected,
            growthQuality: aiResult.growthQuality,
            plantHealth: aiResult.plantHealth,
            fraudDetected: aiResult.fraudDetected,
            score: aiResult.score,
            feedback: aiResult.feedback || [],
          },
          verificationCodeVerified: is_first,
          uploadedAt: new Date(),
          imageHash: hash,
        });

        plant.currentStage = expectedNext;
        plant.totalGp += gpAwarded;

        let completionBonus = 0;
        if (isJourneyComplete(plant.durationWeeks, expectedNext)) {
          plant.status = "COMPLETED";
          completionBonus = COMPLETION_GP;
          plant.totalGp += completionBonus;
        }

        await plant.save();

        const user = await User.findById(req.user._id);
        if (user) {
          user.gp = (user.gp || 0) + gpAwarded + completionBonus;
          user.updateLevel();
          await user.save({ validateBeforeSave: false });
        }

        const nextStage = getNextStage(plant.durationWeeks, expectedNext);

        return res.status(200).json({
          success: true,
          message:
            plant.status === "COMPLETED"
              ? "Journey completed! +50 GP completion bonus!"
              : "Stage uploaded successfully",
          gpAwarded: gpAwarded + completionBonus,
          completionBonus,
          totalGp: plant.totalGp,
          currentStage: expectedNext,
          nextStage,
          status: plant.status,
          aiResponse: aiResult,
        });
      } catch (error) {
        cleanup();
        return res.status(500).json({
          success: false,
          message: "AI processing failed",
          error: error.message,
        });
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path))
      fs.unlinkSync(req.file.path);
    return res.status(500).json({
      success: false,
      message: "Stage upload failed",
      error: error.message,
    });
  }
};

export const getMyPlantations = async (req, res) => {
  try {
    const plants = await Plant.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select("-uploads.imageHash");

    return res.status(200).json({
      success: true,
      plants: plants.map((p) => ({
        id: p._id,
        plantName: p.plantName,
        plantType: p.plantType,
        durationWeeks: p.durationWeeks,
        currentStage: p.currentStage,
        status: p.status,
        totalGp: p.totalGp,
        stages: getStagesForDuration(p.durationWeeks),
        uploadCount: p.uploads.length,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plantations",
      error: error.message,
    });
  }
};

export const getPlantationById = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await Plant.findById(id).select("-uploads.imageHash");

    if (!plant) {
      return res
        .status(404)
        .json({ success: false, message: "Plantation not found" });
    }

    if (plant.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const stages = getStagesForDuration(plant.durationWeeks);
    const nextStage = isJourneyComplete(plant.durationWeeks, plant.currentStage)
      ? null
      : getNextStage(plant.durationWeeks, plant.currentStage);

    return res.status(200).json({
      success: true,
      plant: {
        id: plant._id,
        plantName: plant.plantName,
        plantType: plant.plantType,
        durationWeeks: plant.durationWeeks,
        verificationCode: plant.verificationCode,
        currentStage: plant.currentStage,
        nextStage,
        status: plant.status,
        totalGp: plant.totalGp,
        stages,
        uploads: plant.uploads.map((u) => ({
          week: u.week,
          imageUrl: u.imageUrl,
          gpAwarded: u.gpAwarded,
          aiResponse: u.aiResponse,
          verificationCodeVerified: u.verificationCodeVerified,
          uploadedAt: u.uploadedAt,
        })),
        createdAt: plant.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plantation",
      error: error.message,
    });
  }
};

export const deletePlantation = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await Plant.findById(id);

    if (!plant) {
      return res
        .status(404)
        .json({ success: false, message: "Plantation not found" });
    }

    if (plant.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (plant.uploads.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete plantation with uploads",
      });
    }

    await Plant.findByIdAndDelete(id);

    return res
      .status(200)
      .json({ success: true, message: "Plantation deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete plantation",
      error: error.message,
    });
  }
};
