const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

// Get history of all exams
router.get('/api/history', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id,
        c.class_name as subject,
        c.section_code as section,
        e.exam_title as name,
        e.total_items,
        e.created_at as date,
        (SELECT COUNT(*) FROM exam_results er WHERE er.exam_id = e.id) as scans
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.created_at DESC
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
