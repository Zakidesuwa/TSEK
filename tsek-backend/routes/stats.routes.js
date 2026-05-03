const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

router.get('/api/exams/:id/statistics', authMiddleware, async (req, res) => {
  const examId = req.params.id;
  const instructorId = req.user.id;

  try {
    // Verify ownership
    const verifyResult = await db.query(`
      SELECT e.total_items, e.config 
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE e.id = $1 AND c.instructor_id = $2
    `, [examId, instructorId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const { total_items: totalItems, config } = verifyResult.rows[0];
    
    // Calculate total possible score based on config
    let maxPossibleScore = 0;
    try {
      const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      if (Array.isArray(parsedConfig)) {
        parsedConfig.filter(s => s.enabled).forEach(section => {
          maxPossibleScore += (section.selected * (section.defaultPoints || 1));
        });
      } else {
        maxPossibleScore = totalItems; // Fallback
      }
    } catch (e) {
      maxPossibleScore = totalItems; // Fallback
    }

    // Fetch all results for this exam
    const resultsQuery = await db.query(`
      SELECT score, graded_items 
      FROM exam_results 
      WHERE exam_id = $1
    `, [examId]);

    const results = resultsQuery.rows;
    const totalStudents = results.length;

    if (totalStudents === 0) {
      return res.json({
        totalStudents: 0,
        averageScore: 0,
        distribution: { well: 0, good: 0, needsImprovement: 0 },
        mostMissed: []
      });
    }

    let totalScoreSum = 0;
    let distribution = { well: 0, good: 0, needsImprovement: 0 };
    let itemMissCounts = {};

    results.forEach(row => {
      const score = parseFloat(row.score);
      totalScoreSum += score;
      
      const percentage = (score / maxPossibleScore) * 100;
      if (percentage >= 80) distribution.well++;
      else if (percentage >= 60) distribution.good++;
      else distribution.needsImprovement++;

      const gradedItems = row.graded_items || {};
      for (const [itemNum, data] of Object.entries(gradedItems)) {
        if (!data.isCorrect) {
          itemMissCounts[itemNum] = (itemMissCounts[itemNum] || 0) + 1;
        }
      }
    });

    const averageScore = (totalScoreSum / totalStudents).toFixed(2);

    // Sort most missed items
    const mostMissed = Object.entries(itemMissCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5

    res.json({
      totalStudents,
      averageScore,
      totalItems: maxPossibleScore,
      distribution,
      mostMissed
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
