import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🔥 force correct .env loading
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  debug:true
});

import connectDB from "./src/db/index.js";
import app from "./src/app.js" // ✔ fixed

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
      });
  })
  .catch(() => {
    console.log("DB connection error");
  });