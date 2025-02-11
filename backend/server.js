const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" }); // Save temp files in 'uploads' folder

app.use(cors());

// Paths to Whisper binary and model file
const WHISPER_PATH = path.join(__dirname, "whisper.cpp/build/bin/whisper-cli");
const MODEL_PATH = path.join(__dirname, "whisper.cpp/models/ggml-small.en.bin");

// API Endpoint to process audio transcription
app.post("/transcribe", upload.single("audio"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
    }

    const audioFilePath = path.join(__dirname, req.file.path);
    console.log(`Received file: ${audioFilePath}`);

    // Run whisper-cli command for transcription
    const whisperCommand = `${WHISPER_PATH} -m ${MODEL_PATH} -f ${audioFilePath} -l en --output-txt`;

    exec(whisperCommand, (error, stdout, stderr) => {
        // Delete the temp audio file after processing
        fs.unlink(audioFilePath, (err) => {
            if (err) console.error(`Error deleting file: ${err.message}`);
        });

        if (error) {
            console.error(`Whisper Error: ${stderr}`);
            return res.status(500).json({ error: "Transcription failed", details: stderr });
        }

        // Extract transcribed text from the output
        const transcription = stdout.trim();
        console.log(`Transcribed Text: ${transcription}`);

        res.json({ transcription });
    });
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
