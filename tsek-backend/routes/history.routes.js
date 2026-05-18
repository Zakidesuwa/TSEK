const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

// Get history of all exams
router.get('/api/history', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  const { sortBy = 'date', sortOrder = 'DESC' } = req.query;

  // Map sort fields to validated SQL columns to prevent SQL injection
  const allowedSortFields = {
    name: 'e.exam_title',
    subject: 'c.class_name',
    date: 'COALESCE(e.exam_date, e.created_at::date)',
    deadline: 'e.deadline',
    total_items: 'e.total_items',
    scans: 'scans'
  };

  const allowedOrders = ['ASC', 'DESC'];

  const sortColumn = allowedSortFields[sortBy] || 'COALESCE(e.exam_date, e.created_at::date)';
  const order = allowedOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  try {
    const result = await db.query(`
      SELECT 
        e.id,
        c.class_name as subject,
        c.section_code as section,
        e.exam_title as name,
        e.total_items,
        COALESCE(e.exam_date, e.created_at::date) as date,
        e.deadline,
        (SELECT COUNT(*) FROM exam_results er WHERE er.exam_id = e.id) as scans
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY ${sortColumn} ${order}
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
