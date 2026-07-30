const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const multer = require('multer');
const authMiddleware = require('../authMiddleware');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed.'), false);
    }
  }
});

// Wrapper to handle Multer upload errors gracefully
const handleUpload = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds the 10MB limit.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// All scan routes require authentication
router.post('/', authMiddleware, handleUpload, scanController.scanImage);
router.post('/grade', authMiddleware, scanController.gradeExam);
router.post('/grade/override', authMiddleware, scanController.saveOverride);

module.exports = router;
