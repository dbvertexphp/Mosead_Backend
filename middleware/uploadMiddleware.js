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

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 16 }, // Individual file size limit of 16MB
  fileFilter: function (req, file, cb) {
    // Add your file type validation logic here if needed
    cb(null, true);
  },
}).array("media", 10); // Allow up to 10 files

// Middleware to check total size limit
const checkTotalSize = (req, res, next) => {
  let totalSize = 0;

  req.files.forEach((file) => {
    totalSize += file.size;
  });

  if (totalSize > 1024 * 1024 * 16) { // Total size limit: 16MB
    return res.status(400).json({
      message: "Total file size exceeds 16MB limit.",
      status: false,
    });
  }

  next();
};

module.exports = { upload, checkTotalSize };
