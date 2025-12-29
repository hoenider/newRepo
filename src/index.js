import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Internal imports
import connectDB from "./db/index.js";
import { File } from "./models/file.model.js";

// Load environment variables
dotenv.config({ path: "./.env" });

const app = express();
const PORT = process.env.PORT || 8000;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Multer config (temporary upload location)
const upload = multer({ dest: "uploads/" });

// Classification helper
const classifyFile = (originalName) => {
  const nameLower = originalName.toLowerCase();
  if (nameLower.includes("ilo")) return "ilo";
  if (nameLower.includes("seclore")) return "seclore";
  if (nameLower.includes("dsp")) return "dsp";
  return "uncategorized";
};

// Date helper
const getFormattedDate = () => {
  return new Date().toISOString().split("T")[0];
};


app.post("/upload", upload.single("document"), async (req, res) => {

  
    //CHECK 1: FILE MUST NOT BE NULL
   
  if (!req.file) {
    return res.status(400).json({ message: "E1 : No file uploaded" });
  }

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const fileExtension = path.extname(originalName).toLowerCase();

  try {
    
      // CHECK 2: ONLY .PDF EXTENSION
      
    if (fileExtension !== ".pdf") {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ message: "E2 : Only PDF files are allowed" });
    }

   
     //  CHECK 3 : NO '/' IN FILE NAME
      
    if (originalName.includes("/")) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ message: "E3 : Invalid file name" });
    }

    
       //CHECK 4 : PDF MAGIC HEADER
       
    const fd = fs.openSync(tempPath, "r");
    const buffer = Buffer.alloc(5);
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    if (buffer.toString() !== "%PDF-") {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ message: "E4 : Invalid PDF structure" });
    }

    
      // CHECK 5: NO <script> TAG
      
    const content = fs.readFileSync(tempPath, "utf8");
    if (content.toLowerCase().includes("<script>")) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ message: "E5 : PDF contains forbidden content" });
    }

       // FILE ACCEPTED — RENAME & MOVE
      
    const category = classifyFile(originalName);
    const dateStr = getFormattedDate();
    const uniqueSuffix = Math.round(Math.random() * 1e9);

    const newFileName = `${category}_upload-${dateStr}-${uniqueSuffix}${fileExtension}`;
    const targetPath = path.join(__dirname, "../uploads", newFileName);

    fs.renameSync(tempPath, targetPath);

   
    //SAVE METADATA TO MONGO
    const newFileRecord = new File({
      originalName,
      storedName: newFileName,
      category,
      filePath: targetPath,
    });

    await newFileRecord.save();

    return res.status(200).json({
      message: "File uploaded successfully",
      data: newFileRecord,
    });

  } catch (error) {
    // Cleanup temp file if still exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    console.error("Upload error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


// START SERVER

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed", err);
  });
