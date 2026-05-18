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
        c.section_code as "sectionCode",
        e.exam_title as name,
        e.total_items,
        COALESCE(e.exam_date, e.created_at::date) as date,
        e.deadline,
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
  const { class_id, exam_title, total_items, config, answer_key, exam_date, deadline } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO exams (class_id, exam_title, total_items, config, answer_key, exam_date, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      class_id,
      exam_title,
      total_items,
      JSON.stringify(config),
      JSON.stringify(answer_key),
      exam_date || null,
      deadline || null
    ]);
    
    res.json({ success: true, exam_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save exam' });
  }
});

// Get exam format details
router.get('/api/exams/:id/format', authMiddleware, async (req, res) => {
  const examId = req.params.id;
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT e.exam_title as exam_title, e.total_items, e.config
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
    `, [examId, instructorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found or you do not have access to this exam.' });
    }

    const row = result.rows[0];
    res.json({
      examTitle: row.exam_title,
      totalItems: row.total_items,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exam format' });
  }
});

// Get full answer sheet (answer key + config) for an exam
router.get('/api/exams/:id/answersheet', authMiddleware, async (req, res) => {
  const examId = req.params.id;
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT e.exam_title as exam_title, e.total_items, e.config, e.answer_key
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
    `, [examId, instructorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found or you do not have access to this exam.' });
    }

    const row = result.rows[0];
    res.json({
      examTitle: row.exam_title,
      totalItems: row.total_items,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      answerKey: typeof row.answer_key === 'string' ? JSON.parse(row.answer_key) : row.answer_key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exam answer sheet' });
  }
});

// Delete an exam
router.delete('/api/exams/:id', authMiddleware, async (req, res) => {
  const examId = req.params.id;
  const instructorId = req.user.id;
  try {
    // Verify ownership via classes table before deleting
    const verifyResult = await db.query(`
      SELECT e.id 
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
    `, [examId, instructorId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found or already deleted' });
    }

    await db.query('DELETE FROM exams WHERE id = $1', [examId]);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

module.exports = router;
