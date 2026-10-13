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
        e.total_items,
        er.page_count
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    let totalScore = 0;
    let totalPossible = 0;
    let totalSheets = 0;
    statsRes.rows.forEach(row => {
      totalScore += parseFloat(row.score);
      totalSheets += row.page_count || 1;
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

router.get('/api/dashboard/recent-exams', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id, 
        e.exam_title as name, 
        COALESCE(
          (
            SELECT STRING_AGG(cl.class_name || ' (' || cl.section_code || ')', ', ')
            FROM exam_classes ec
            JOIN classes cl ON ec.class_id = cl.id
            WHERE ec.exam_id = e.id
          ), 
          c.class_name
        ) as subject, 
        e.total_items,
        e.config,
        COALESCE(
          (
            SELECT COUNT(DISTINCT ce.student_id)
            FROM exam_classes ec
            JOIN class_enrollments ce ON ec.class_id = ce.class_id
            WHERE ec.exam_id = e.id
          ),
          0
        ) as total_students,
        COALESCE(
          (
            SELECT COUNT(DISTINCT er.student_id)
            FROM exam_results er
            WHERE er.exam_id = e.id
          ),
          0
        ) as completed_students
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.id DESC
      LIMIT 5
    `, [instructorId]);

    const formatted = result.rows.map(row => {
      let volume = row.total_items;
      try {
        const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
        if (Array.isArray(config)) {
          volume = config.filter(s => s.enabled).reduce((sum, s) => sum + (s.selected * (s.defaultPoints || 1)), 0);
        }
      } catch (e) {}
      
      const completedStudents = parseInt(row.completed_students, 10);
      const totalStudents = Math.max(parseInt(row.total_students, 10), completedStudents);
      
      let progress = 100;
      let status = 'COMPLETED';
      
      if (totalStudents > 0) {
        progress = Math.min(100, Math.round((completedStudents / totalStudents) * 100));
        status = progress === 100 ? 'COMPLETED' : 'IN PROGRESS';
      } else if (completedStudents === 0) {
        progress = 0;
        status = 'IN PROGRESS';
      }
      
      return {
        id: row.id,
        name: row.name,
        subject: row.subject,
        volume: volume,
        status: status,
        progress: progress
      };
    });

    res.json(formatted);
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

// Report the enrolled students who do not yet have a graded result for each exam.
router.get('/api/dashboard/notifications', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT
        e.id,
        e.exam_title AS name,
        STRING_AGG(DISTINCT exam_class.class_name || ' (' || exam_class.section_code || ')', ', ')
          AS classes,
        COUNT(DISTINCT ce.student_id) AS total_students,
        COUNT(DISTINCT er.student_id) AS taken_students
      FROM exams e
      JOIN classes owner_class ON owner_class.id = e.class_id
      JOIN exam_classes ec ON ec.exam_id = e.id
      JOIN classes exam_class
        ON exam_class.id = ec.class_id
       AND exam_class.instructor_id = $1
      LEFT JOIN class_enrollments ce ON ce.class_id = exam_class.id
      LEFT JOIN exam_results er
        ON er.exam_id = e.id
       AND er.student_id = ce.student_id
      WHERE owner_class.instructor_id = $1
      GROUP BY e.id, e.exam_title
      HAVING COUNT(DISTINCT ce.student_id) > COUNT(DISTINCT er.student_id)
      ORDER BY e.id DESC
    `, [instructorId]);

    const notifications = result.rows.map(row => {
      const totalStudents = parseInt(row.total_students, 10);
      const takenStudents = parseInt(row.taken_students, 10);
      const missingStudents = totalStudents - takenStudents;

      return {
        id: `participation-${row.id}`,
        type: 'warning',
        title: 'Missing graded answer sheets',
        examId: row.id,
        message: `${missingStudents} of ${totalStudents} enrolled students do not yet have a graded answer sheet recorded for "${row.name}" (${row.classes}). ${takenStudents} of ${totalStudents} answer sheets have been graded.`
      };
    });

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
