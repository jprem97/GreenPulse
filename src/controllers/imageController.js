import fs from "fs";
import crypto from "crypto";
import User from "../models/Image";

export const imgHandler = async (req,res)=> {
  
 try {
   const fileBuffer = fs.readFileSync(req.file.path);
   const hash = crypto
     .createHash("sha256")
     .update(fileBuffer)
     .digest("hex");
   const HashedImage = await Image.findOne({ imageHash: hash });
   if (HashedImage) return res.status(400).json({ message: "Old image used" });
 
 } catch (error) {
  res.status(500).json({
      message: "Registration failed",
      error: err.message
    })
 }

}