import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: true
    },
    storedName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ["ilo", "seclore", "dsp", "uncategorized"],
        default: "uncategorized"
    },
    filePath: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const File = mongoose.model("File", fileSchema);