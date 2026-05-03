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

// Add a student to a class (create student if not exists, then enroll)
router.post('/api/classes/:id/students', authMiddleware, async (req, res) => {
  const classId = req.params.id;
  const { full_name, student_id_number } = req.body;

  if (!full_name || !student_id_number) {
    return res.status(400).json({ error: 'full_name and student_id_number are required.' });
  }

  try {
    // Check if student already exists by student_id_number
    let studentResult = await db.query(
      'SELECT id FROM students WHERE student_id_number::text = $1',
      [student_id_number.toString().trim()]
    );

    let studentId;
    if (studentResult.rows.length > 0) {
      studentId = studentResult.rows[0].id;
    } else {
      // Create the student
      const insertResult = await db.query(
        'INSERT INTO students (full_name, student_id_number) VALUES ($1, $2) RETURNING id',
        [full_name.trim(), student_id_number.toString().trim()]
      );
      studentId = insertResult.rows[0].id;
    }

    // Check if already enrolled
    const enrollCheck = await db.query(
      'SELECT 1 FROM class_enrollments WHERE class_id = $1 AND student_id = $2',
      [classId, studentId]
    );

    if (enrollCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Student is already enrolled in this class.' });
    }

    // Enroll
    await db.query(
      'INSERT INTO class_enrollments (class_id, student_id) VALUES ($1, $2)',
      [classId, studentId]
    );

    res.status(201).json({
      message: 'Student added successfully',
      student: { id: studentId, name: full_name.trim(), number: student_id_number.trim() }
    });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message || 'Failed to add student' });
  }
});

// Remove a student from a class
router.delete('/api/classes/:classId/students/:studentId', authMiddleware, async (req, res) => {
  const { classId, studentId } = req.params;
  try {
    await db.query(
      `DELETE FROM class_enrollments 
       WHERE class_id = $1 
       AND student_id = (SELECT id FROM students WHERE student_id_number = $2)`,
      [classId, studentId]
    );

    res.json({ message: 'Student removed from class' });
  } catch (err) {
    console.error('Error removing student:', err);
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

// Delete a class
router.delete('/api/classes/:id', authMiddleware, async (req, res) => {
  const classId = req.params.id;
  const instructorId = req.user.id;

  try {
    // Verify the class belongs to this instructor
    const classCheck = await db.query(
      'SELECT id FROM classes WHERE id = $1 AND instructor_id = $2',
      [classId, instructorId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found or you do not have permission to delete it.' });
    }

    // Delete exam results for exams in this class
    await db.query(
      `DELETE FROM exam_results 
       WHERE exam_id IN (SELECT id FROM exams WHERE class_id = $1)`,
      [classId]
    );

    // Delete exams for this class
    await db.query(
      'DELETE FROM exams WHERE class_id = $1',
      [classId]
    );

    // Delete class enrollments
    await db.query(
      'DELETE FROM class_enrollments WHERE class_id = $1',
      [classId]
    );

    // Delete the class itself
    await db.query(
      'DELETE FROM classes WHERE id = $1',
      [classId]
    );

    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error('Error deleting class:', err);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;
