const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

// Dashboard Stats
router.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const statsRes = await db.query(`
      SELECT 
        COUNT(er.id) as total_sheets,
        COALESCE(SUM(er.score)::float / NULLIF(SUM(e.total_items), 0) * 100, 0) as accuracy
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    const examsRes = await db.query(`
      SELECT COUNT(e.id) FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    const classesRes = await db.query('SELECT COUNT(*) FROM classes WHERE instructor_id = $1', [instructorId]);
    
    const accuracyNum = parseFloat(statsRes.rows[0].accuracy);
    const accuracyStr = accuracyNum > 0 ? accuracyNum.toFixed(1) + '%' : '0.0%';

    res.json({
      totalSheets: parseInt(statsRes.rows[0].total_sheets, 10),
      accuracy: accuracyStr,
      activeExams: parseInt(examsRes.rows[0].count, 10),
      classesCount: parseInt(classesRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Recent Exams
router.get('/api/dashboard/recent-exams', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id, 
        e.exam_title as name, 
        c.class_name as subject, 
        e.total_items as volume,
        'COMPLETED' as status,
        100 as progress
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.id DESC
      LIMIT 5
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent exams' });
  }
});

// Dashboard Classes (blocks)
router.get('/api/dashboard/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        c.section_code as block, 
        COUNT(ce.student_id) as students
      FROM classes c
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.instructor_id = $1
      GROUP BY c.id, c.section_code
    `, [instructorId]);
    // Convert count string to number
    const formatted = result.rows.map(r => ({ block: r.block, students: parseInt(r.students, 10) }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class blocks' });
  }
});

module.exports = router;
