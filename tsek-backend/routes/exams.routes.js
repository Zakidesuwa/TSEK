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
        STRING_AGG(DISTINCT c.class_name, ', ') as subject,
        STRING_AGG(DISTINCT c.section_code, ', ') as "sectionCode",
        e.exam_title as name,
        e.total_items,
        COALESCE(e.exam_date, e.created_at::date) as date,
        e.deadline,
        'Multiple Choice' as types,
        'ACTIVE' as status
      FROM exams e
      JOIN exam_classes ec ON e.id = ec.exam_id
      JOIN classes c ON ec.class_id = c.id
      WHERE c.instructor_id = $1
      GROUP BY e.id, e.exam_title, e.total_items, e.exam_date, e.deadline, e.created_at
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
  const { class_id, class_ids, exam_title, total_items, config, answer_key, exam_date, deadline } = req.body;
  const targetClassIds = class_ids || (class_id ? [class_id] : []);

  if (targetClassIds.length === 0) {
    return res.status(400).json({ error: 'At least one class must be selected.' });
  }

  try {
    const result = await db.query(`
      INSERT INTO exams (class_id, exam_title, total_items, config, answer_key, exam_date, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      targetClassIds[0], // for legacy/backward compatibility
      exam_title,
      total_items,
      JSON.stringify(config),
      JSON.stringify(answer_key),
      exam_date || null,
      deadline || null
    ]);
    
    const examId = result.rows[0].id;

    // Link exam to all target classes
    for (const cid of targetClassIds) {
      await db.query(`
        INSERT INTO exam_classes (exam_id, class_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [examId, cid]);
    }
    
    res.json({ success: true, exam_id: examId });
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
      SELECT DISTINCT e.exam_title as exam_title, e.total_items, e.config
      FROM exams e
      JOIN exam_classes ec ON e.id = ec.exam_id
      JOIN classes c ON ec.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
      LIMIT 1
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
      SELECT DISTINCT e.exam_title as exam_title, e.total_items, e.config, e.answer_key
      FROM exams e
      JOIN exam_classes ec ON e.id = ec.exam_id
      JOIN classes c ON ec.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
      LIMIT 1
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
      SELECT DISTINCT e.id 
      FROM exams e
      JOIN exam_classes ec ON e.id = ec.exam_id
      JOIN classes c ON ec.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
      LIMIT 1
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

// Stream student scanned exam image on-demand (supports Base64 in DB and legacy URL redirects)
router.get('/api/exams/:examId/students/:studentId/image', authMiddleware, async (req, res) => {
  const { examId, studentId } = req.params;
  try {
    const result = await db.query(
      'SELECT scanned_image_url FROM exam_results WHERE exam_id = $1 AND student_id = $2',
      [examId, studentId]
    );

    if (result.rows.length === 0 || !result.rows[0].scanned_image_url) {
      return res.status(404).send('Image not found');
    }

    const base64Str = result.rows[0].scanned_image_url;

    // Check if the stored string is a Base64 Data URI
    if (base64Str.startsWith('data:')) {
      const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.type(mimeType);
        return res.send(buffer);
      }
    }

    // Otherwise, redirect to the legacy absolute URL
    return res.redirect(base64Str);
  } catch (err) {
    console.error('Error streaming student exam image:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
