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
  }
});

// All scan routes require authentication
router.post('/', authMiddleware, upload.single('image'), scanController.scanImage);
router.post('/grade', authMiddleware, scanController.gradeExam);
router.post('/grade/override', authMiddleware, scanController.saveOverride);

module.exports = router;
