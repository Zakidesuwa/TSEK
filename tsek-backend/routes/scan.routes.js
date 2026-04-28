const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// The auth middleware should probably be here, but for testing we'll keep it simple
router.post('/', upload.single('image'), scanController.scanImage);
router.post('/grade', scanController.gradeExam);
router.post('/grade/override', scanController.saveOverride);

module.exports = router;
