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
        er.score,
        e.config,
        e.total_items
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    let totalScore = 0;
    let totalPossible = 0;
    statsRes.rows.forEach(row => {
      totalScore += parseFloat(row.score);
      let maxScore = row.total_items;
      try {
        const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
        if (Array.isArray(config)) {
          maxScore = config.filter(s => s.enabled).reduce((sum, s) => sum + (s.selected * (s.defaultPoints || 1)), 0);
        }
      } catch (e) {}
      totalPossible += maxScore;
    });
    
    const accuracyNum = totalPossible > 0 ? (totalScore / totalPossible * 100) : 0;
    const totalSheets = statsRes.rows.length;
    
    const examsRes = await db.query(`
      SELECT COUNT(e.id) FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    const classesRes = await db.query('SELECT COUNT(*) FROM classes WHERE instructor_id = $1', [instructorId]);
    
    const accuracyStr = accuracyNum > 0 ? accuracyNum.toFixed(1) + '%' : '0.0%';

    res.json({
      totalSheets: totalSheets,
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
