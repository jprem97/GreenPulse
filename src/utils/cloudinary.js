import { v2 as cod } from "cloudinary";
import fs from "fs";
cod.config({
  cloud_name: 'dhr1lsc8m',
  api_key: process.env.CLOUDK,
  api_secret: process.env.CLOUDS
});

export const cloudUpload = async (filePath) => {
  if(!filePath) return ;
  try {
    const resultUpload = await cod.uploader.upload(filePath)
    fs.unlinkSync(filePath);
    return resultUpload;
  } catch (error) {
    fs.unlinkSync(filePath);
    return error;
  }

}

