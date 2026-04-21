const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

// Get all classes for instructor
router.get('/api/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.class_name as subject, 
        c.section_code as section,
        COUNT(ce.student_id) as students,
        'Oct 20' as "nextQuiz"
      FROM classes c
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.instructor_id = $1
      GROUP BY c.id, c.class_name, c.section_code
    `, [instructorId]);
    const formatted = result.rows.map(r => ({
      ...r,
      students: parseInt(r.students, 10)
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Create a class
router.post('/api/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  const { class_name, section_code } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO classes (instructor_id, class_name, section_code)
      VALUES ($1, $2, $3)
      RETURNING id, class_name as subject, section_code as section
    `, [instructorId, class_name, section_code]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Get students for a specific class
router.get('/api/classes/:id/students', authMiddleware, async (req, res) => {
  try {
    const classId = req.params.id;
    
    // 1. Fetch all exams for this class
    const examsRes = await db.query('SELECT id, exam_title, total_items FROM exams WHERE class_id = $1 ORDER BY created_at ASC', [classId]);
    const classExams = examsRes.rows;
    const examNames = classExams.map(e => e.exam_title);

    // 2. Fetch all students enrolled in this class
    const studentsRes = await db.query(`
      SELECT 
        s.id,
        s.full_name as name,
        s.student_id_number as number
      FROM students s
      JOIN class_enrollments ce ON s.id = ce.student_id
      WHERE ce.class_id = $1
      ORDER BY s.full_name ASC
    `, [classId]);
    
    // 3. For each student, find their scores for the respective exams
    const students = await Promise.all(studentsRes.rows.map(async (student) => {
      const scores = [];
      for (const exam of classExams) {
        const resultRes = await db.query(`
          SELECT score FROM exam_results WHERE exam_id = $1 AND student_id = $2
        `, [exam.id, student.id]);
        
        if (resultRes.rows.length > 0) {
          scores.push(`${resultRes.rows[0].score}/${exam.total_items}`);
        } else {
          scores.push(`--/${exam.total_items}`);
        }
      }
      return {
        name: student.name,
        number: student.number,
        scores: scores
      };
    }));
    
    res.json({ exams: examNames, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;
