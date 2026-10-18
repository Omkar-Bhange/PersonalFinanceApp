const express = require("express");
const multer = require("multer");
const { authenticateToken } = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "text/csv",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(pdf|csv|txt|png|jpe?g|webp|xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload PDF, Excel (.xlsx, .xls), CSV, TXT, or Image."));
    }
  },
});

router.use(authenticateToken);

router.post("/parse-statement", upload.single("file"), aiController.parseStatement);
router.post("/suggest-category", aiController.suggestCategory);

module.exports = router;

