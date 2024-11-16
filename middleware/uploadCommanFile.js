const multer = require("multer");
const path = require("path");
const fs = require("fs");

// General storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.uploadPath || "uploads/"; // Use a general path if not specified
    // Ensure the directory exists
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const uploadFile = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // Limit file size to 5MB
});

module.exports = uploadFile;
