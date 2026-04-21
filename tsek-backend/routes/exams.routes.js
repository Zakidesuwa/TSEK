const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

// Get all exams for instructor
router.get('/api/exams', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id,
        c.class_name as subject,
        e.exam_title as name,
        e.total_items,
        e.created_at as date,
        'Multiple Choice' as types,
        'ACTIVE' as status
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.created_at DESC
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// Create an exam
router.post('/api/exams', authMiddleware, async (req, res) => {
  const { class_id, exam_title, total_items, config } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO exams (class_id, exam_title, total_items, config)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [class_id, exam_title, total_items, JSON.stringify(config)]);
    
    res.json({ success: true, exam_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save exam' });
  }
});

module.exports = router;
