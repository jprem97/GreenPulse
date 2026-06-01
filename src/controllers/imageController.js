import fs from "fs";
import crypto from "crypto";

import { spawn } from "child_process";

import { cloudUpload } from "../utils/cloudinary.js";

import Image from "../models/Image.js";

export const imgHandler = async (req, res) => {

  try {

    // ===================================================
    // CHECK FILE
    // ===================================================

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No image uploaded"
      });
    }

    // ===================================================
    // READ FILE
    // ===================================================

    const fileBuffer = fs.readFileSync(
      req.file.path
    );

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

    const oldImage = await Image.findOne({

      imageHash: hash
    });

    if (oldImage) {

      fs.unlinkSync(req.file.path);

      return res.status(400).json({

        success: false,

        message:
        "Old image already used"
      });
    }

    // ===================================================
    // RUN PYTHON MODEL
    // ===================================================

    const pythonProcess = spawn(

      "python",

      [

        "./ml/ecoModel.py",

        req.file.path
      ]
    );

    let resultData = "";

    // ===================================================
    // CAPTURE PYTHON OUTPUT
    // ===================================================

    pythonProcess.stdout.on(

      "data",

      (data) => {

        resultData += data.toString();
      }
    );

    // ===================================================
    // CAPTURE PYTHON ERRORS
    // ===================================================

    pythonProcess.stderr.on(

      "data",

      (data) => {

        console.log(

          "Python Error:",

          data.toString()
        );
      }
    );

    // ===================================================
    // WHEN PYTHON FINISHES
    // ===================================================

    pythonProcess.on(

      "close",

      async () => {

        try {

          // ===============================================
          // PARSE AI RESULT
          // ===============================================

          const aiResult = JSON.parse(
            resultData
          );

          // ===============================================
          // UPLOAD TO CLOUDINARY
          // ===============================================

          const uploadedImage =

            await cloudUpload(
              req.file.path
            );

          // ===============================================
          // CHECK CLOUDINARY RESPONSE
          // ===============================================

          if (!uploadedImage) {

            return res.status(500).json({

              success: false,

              message:
              "Cloudinary upload failed"
            });
          }

          // ===============================================
          // SAVE TO DATABASE
          // ===============================================

          const savedImage = await Image.create({

            user: req.user._id,

            imageUrl:
            uploadedImage.secure_url,

            imageHash: hash,

            imageType: "WASTE",

            classification:
            aiResult.classification,

            confidenceScore:
            aiResult.score,

            ecoPointsAwarded:
            aiResult.gp,

            score:
            aiResult.score,

            sceneAnalysis:
            aiResult.sceneAnalysis,

            detectedObjects:
            aiResult.detectedObjects,

            feedback:
            aiResult.feedback,
          });

          // ===============================================
          // RESPONSE
          // ===============================================

          return res.status(200).json({

            success: true,

            data: savedImage
          });

        } catch (error) {

          // local file safety delete
          if (

            req.file &&

            fs.existsSync(req.file.path)
          ) {

            fs.unlinkSync(req.file.path);
          }

          return res.status(500).json({

            success: false,

            message:
            "AI processing failed",

            error: error.message
          });
        }
      }
    );

  } catch (error) {

    // safety delete
    if (

      req.file &&

      fs.existsSync(req.file.path)
    ) {

      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({

      success: false,

      message: "Image processing failed",

      error: error.message
    });
  }
};