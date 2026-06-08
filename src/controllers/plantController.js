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
  isJourneyComplete,
  calculateStageGP,
  generateVerificationCode,
  calculatePlantStreak,
  calculateStreakBonus,
  isUploadOnSchedule,
  getCompletionBonusWithMultiplier,
  getCurrentWeek,
  isStageUnlocked,
  getNextUnlockedStage,
  CREATION_GP,
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
      user.totalPlantations = (user.totalPlantations || 0) + 1;
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
    const is_first = plant.uploads.length === 0;
    const expectedNext = is_first
      ? firstStage
      : getNextUnlockedStage(plant.durationWeeks, plant.createdAt, plant.uploads);

    if (expectedNext === null) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ success: false, message: "All stages already completed or no stage is currently unlocked" });
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

    if (!is_first && !isStageUnlocked(plant.durationWeeks, plant.createdAt, expectedNext)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Week ${expectedNext} is not yet available. Please wait until the correct time to upload.`,
      });
    }

    // Upload frequency limit: max 1 per 24 hours per plantation
    if (plant.uploads.length > 0) {
      const lastUpload = plant.uploads[plant.uploads.length - 1];
      const hoursSinceLastUpload = (Date.now() - new Date(lastUpload.uploadedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUpload < 24) {
        fs.unlinkSync(req.file.path);
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(24 - hoursSinceLastUpload)} hours before uploading again`,
        });
      }
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // Duplicate detection within same plantation
    const duplicateInPlant = plant.uploads.some((u) => u.imageHash === hash);
    if (duplicateInPlant) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Duplicate image detected for this plantation",
      });
    }

    // Cross-plantation duplicate detection
    const duplicateInOtherPlant = await Plant.findOne({
      user: req.user._id,
      _id: { $ne: plant._id },
      "uploads.imageHash": hash,
    });
    if (duplicateInOtherPlant) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "This image was already used in another plantation",
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

        // Enhanced verification code fraud detection
        const verificationFailed = is_first
          ? aiResult.verificationCodeDetected === false ||
            aiResult.verificationCodeMatches === false
          : false;

        // Subsequent upload: must confirm same plant
        const samePlantFailed = !is_first && aiResult.samePlant === false;

        // Timeline validation: check if upload is on schedule
        const onSchedule = isUploadOnSchedule(plant.uploads, plant.durationWeeks, expectedNext);

        if (
          !aiResult.valid ||
          aiResult.fraudDetected ||
          samePlantFailed ||
          verificationFailed
        ) {
          cleanup();
          return res.status(400).json({
            success: false,
            message:
              aiResult.feedback?.join(". ") || "Image validation failed",
            aiResponse: aiResult,
            fraudType: aiResult.fraudDetected ? "AI_DETECTED" : 
                       verificationFailed ? "VERIFICATION_FAILED" :
                       samePlantFailed ? "DIFFERENT_PLANT" : "INVALID",
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
        const growthQuality = aiResult.growthQuality || "POOR";
        const gpAwarded = calculateStageGP(
          plant.plantType,
          stageIndex,
          totalStages,
          aiResult.score,
          growthQuality
        );

        // Calculate streak bonus
        const newStreak = calculatePlantStreak(
          [...plant.uploads, { week: expectedNext }],
          plant.durationWeeks
        );
        const streakBonus = calculateStreakBonus(newStreak);

        const totalStageGp = gpAwarded + streakBonus;

        plant.uploads.push({
          week: expectedNext,
          imageUrl: uploadedImage.secure_url,
          gpAwarded: totalStageGp,
          aiResponse: {
            valid: aiResult.valid,
            samePlant: aiResult.samePlant,
            verificationCodeDetected: aiResult.verificationCodeDetected,
            verificationCodeMatches: aiResult.verificationCodeMatches,
            growthDetected: aiResult.growthDetected,
            growthQuality: aiResult.growthQuality,
            plantHealth: aiResult.plantHealth,
            fraudDetected: aiResult.fraudDetected,
            score: aiResult.score,
            feedback: aiResult.feedback || [],
          },
          verificationCodeVerified: aiResult.verificationCodeMatches === true,
          uploadedAt: new Date(),
          imageHash: hash,
        });

        plant.currentStage = expectedNext;
        plant.totalGp += totalStageGp;
        plant.plantStreak = newStreak;
        plant.lastUploadWeek = expectedNext;

        let completionBonus = 0;
        if (isJourneyComplete(plant.durationWeeks, expectedNext)) {
          plant.status = "COMPLETED";
          completionBonus = getCompletionBonusWithMultiplier(
            plant.durationWeeks,
            plant.uploads
          );
          plant.totalGp += completionBonus;
        }

        await plant.save();

        const user = await User.findById(req.user._id);
        if (user) {
          user.gp = (user.gp || 0) + totalStageGp + completionBonus;
          if (aiResult.verificationCodeMatches) {
            user.verifiedUploads = (user.verifiedUploads || 0) + 1;
          }
          if (plant.status === "COMPLETED") {
            user.completedPlantations = (user.completedPlantations || 0) + 1;
            const avgScore = plant.uploads.reduce((sum, u) => sum + (u.aiResponse?.score || 0), 0) / plant.uploads.length;
            if (avgScore > (user.bestPlantAvgScore || 0)) {
              user.bestPlantAvgScore = Math.round(avgScore);
            }
          }
          if (newStreak > (user.maxPlantStreak || 0)) {
            user.maxPlantStreak = newStreak;
          }
          user.updateLevel();
          await user.save({ validateBeforeSave: false });
        }

        const nextStage = getNextStage(plant.durationWeeks, expectedNext);

        return res.status(200).json({
          success: true,
          message:
            plant.status === "COMPLETED"
              ? `Journey completed! +${completionBonus} GP completion bonus!`
              : "Stage uploaded successfully",
          gpAwarded: totalStageGp,
          streakBonus,
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
      plants: plants.map((p) => {
        const stages = getStagesForDuration(p.durationWeeks);
        const currentWeek = getCurrentWeek(p.createdAt);
        const unlockedStage = isJourneyComplete(p.durationWeeks, p.currentStage)
          ? null
          : getNextUnlockedStage(p.durationWeeks, p.createdAt, p.uploads);
        const nextStage = isJourneyComplete(p.durationWeeks, p.currentStage)
          ? null
          : getNextStage(p.durationWeeks, p.currentStage);

        return {
          id: p._id,
          plantName: p.plantName,
          plantType: p.plantType,
          durationWeeks: p.durationWeeks,
          currentStage: p.currentStage,
          currentWeek,
          unlockedStage,
          nextStage,
          status: p.status,
          totalGp: p.totalGp,
          plantStreak: p.plantStreak || 0,
          stages,
          uploads: p.uploads.map((u) => ({
            week: u.week,
            imageUrl: u.imageUrl,
            gpAwarded: u.gpAwarded,
            aiResponse: {
              score: u.aiResponse?.score,
              growthQuality: u.aiResponse?.growthQuality,
              plantHealth: u.aiResponse?.plantHealth,
            },
            uploadedAt: u.uploadedAt,
          })),
          uploadCount: p.uploads.length,
          createdAt: p.createdAt,
        };
      }),
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
    const currentWeek = getCurrentWeek(plant.createdAt);
    const unlockedStage = isJourneyComplete(plant.durationWeeks, plant.currentStage)
      ? null
      : getNextUnlockedStage(plant.durationWeeks, plant.createdAt, plant.uploads);
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
        currentWeek,
        unlockedStage,
        nextStage,
        status: plant.status,
        totalGp: plant.totalGp,
        plantStreak: plant.plantStreak || 0,
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
