const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.scanImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided for scanning' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on the server' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // Prepare the image for Gemini
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    // Strict prompt to force JSON output representing the OMR sheet and handwriting
    const prompt = `You are a highly accurate grading system capable of reading both Optical Mark Recognition (OMR) bubbles and handwriting.
Look carefully at the provided student answer sheet image. 

1. Identify the Student ID number encoded in the grid bubbles.
2. If there is a name field (handwritten or printed), identify the student's full name.
3. For multiple-choice and true/false questions, read the shaded bubbles. Pay attention to the letters printed inside the bubbles (A, B, C, D, E, or T, F). Record the exact letter that is shaded.
4. For identification or enumeration questions, read the handwritten text written on the lines next to the item numbers.

Return the result STRICTLY as a valid, stringified JSON object using the following exact format:
{
  "studentId": "123456",
  "studentName": "JOHN DOE",
  "answers": {
    "1": "A",
    "2": "C",
    "3": "MITOCHONDRIA",
    "4": "PHOTOSYNTHESIS",
    "5": "T"
  }
}
Do not include any markdown code blocks (like \`\`\`json) or any conversational text. Return ONLY the raw JSON object. If an item is unreadable or completely blank, leave the answer as null.`;

    const result = await model.generateContent([prompt, imagePart]);
    let responseText = result.response.text();

    // Clean up potential markdown formatting if Gemini disobeys
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedJson;
    try {
      parsedJson = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON:", responseText);
      return res.status(500).json({
        message: 'Failed to parse OMR results',
        rawText: responseText
      });
    }

    res.status(200).json({
      message: 'Scanning complete',
      rawText: parsedJson // We return the parsed JSON object here
    });

  } catch (error) {
    console.error('Error during Gemini scanning:', error);
    res.status(500).json({
      message: error.message || String(error),
      error: error.message || String(error)
    });
  }
};

const db = require('../db');

exports.gradeExam = async (req, res) => {
  const { exam_id, studentId, answers } = req.body;

  if (!exam_id || !answers) {
    return res.status(400).json({ message: 'exam_id and answers are required.' });
  }

  try {
    // 1. Fetch Exam Config and Answer Key
    const examResult = await db.query('SELECT config, answer_key FROM exams WHERE id = $1', [exam_id]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ message: 'Exam not found.' });
    }

    const { config, answer_key } = examResult.rows[0];

    if (!answer_key) {
      return res.status(400).json({ message: 'This exam does not have an answer key configured.' });
    }

    // 2. Build Item Mapping (Global Number -> Section Local Number)
    const itemMapping = {};
    let currentGlobalNum = 1;

    // Parse config if it's stringified
    const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
    const parsedAnswerKey = typeof answer_key === 'string' ? JSON.parse(answer_key) : answer_key;

    parsedConfig.filter(s => s.enabled).forEach(section => {
      for (let i = 1; i <= section.selected; i++) {
        itemMapping[currentGlobalNum] = {
          sectionKey: section.key,
          sectionLocalNum: i,
          points: section.defaultPoints || 1
        };
        currentGlobalNum++;
      }
    });

    // 3. Grade Answers
    let totalScore = 0;
    let totalPossible = 0;
    const gradedItems = {};

    for (const [globalNumStr, studentAnswer] of Object.entries(answers)) {
      const globalNum = parseInt(globalNumStr, 10);
      const mapping = itemMapping[globalNum];

      if (!mapping) continue;

      const { sectionKey, sectionLocalNum, points } = mapping;
      const sectionAnswers = parsedAnswerKey[sectionKey] || {};
      const correctAnswer = sectionAnswers[sectionLocalNum];

      let isCorrect = false;

      if (!studentAnswer) {
        isCorrect = false;
      } else if (Array.isArray(correctAnswer)) {
        // Multiple Choice / True False (Array of allowed answers)
        if (correctAnswer.includes(studentAnswer.toUpperCase())) {
          isCorrect = true;
        }
      } else if (typeof correctAnswer === 'string') {
        // Identification / Enumeration
        if (studentAnswer.toUpperCase().trim() === correctAnswer.toUpperCase().trim()) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        totalScore += points;
      }
      totalPossible += points;

      gradedItems[globalNum] = {
        studentAnswer,
        correctAnswer,
        isCorrect,
        pointsAwarded: isCorrect ? points : 0,
        maxPoints: points
      };
    }

    // 4. Look up Student and Class enrollment
    let studentDbId = null;
    let isEnrolled = false;
    let studentExists = false;
    let classId = null;

    const examInfo = await db.query('SELECT class_id FROM exams WHERE id = $1', [exam_id]);
    if (examInfo.rows.length > 0) {
      classId = examInfo.rows[0].class_id;
    }

    if (studentId && classId) {
      const studentQuery = await db.query('SELECT id FROM students WHERE student_id_number::text = $1', [String(studentId).trim()]);
      if (studentQuery.rows.length > 0) {
        studentExists = true;
        studentDbId = studentQuery.rows[0].id;

        const enrollmentQuery = await db.query('SELECT 1 FROM class_enrollments WHERE class_id = $1 AND student_id = $2', [classId, studentDbId]);
        if (enrollmentQuery.rows.length > 0) {
          isEnrolled = true;

          // Insert into exam_results only if student is enrolled
          await db.query(`
            INSERT INTO exam_results (exam_id, student_id, score, graded_items)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ON CONSTRAINT unique_exam_student DO UPDATE SET score = $3, graded_items = $4
          `, [exam_id, studentDbId, totalScore, JSON.stringify(gradedItems)]);
        }
      }
    }

    res.status(200).json({
      message: isEnrolled ? 'Grading complete' : 'Student not enrolled in this class',
      score: totalScore,
      totalPossible: totalPossible,
      studentFound: studentExists,
      isEnrolled: isEnrolled,
      classId: classId,
      details: gradedItems
    });

  } catch (err) {
    console.error('Error during grading:', err);
    res.status(500).json({
      message: err.message || String(err),
      error: err.message || String(err)
    });
  }
};

exports.saveOverride = async (req, res) => {
  const { exam_id, studentId, adjustedScore, overriddenItems } = req.body;

  if (!exam_id || adjustedScore === undefined) {
    return res.status(400).json({ message: 'exam_id and adjustedScore are required.' });
  }

  try {
    if (studentId) {
      const studentQuery = await db.query(
        'SELECT id FROM students WHERE student_id_number::text = $1',
        [String(studentId).trim()]
      );

      if (studentQuery.rows.length > 0) {
        const studentDbId = studentQuery.rows[0].id;

        // Update existing exam_result or insert if not exists
        const existing = await db.query(
          'SELECT id FROM exam_results WHERE exam_id = $1 AND student_id = $2',
          [exam_id, studentDbId]
        );

        if (existing.rows.length > 0) {
          await db.query(
            'UPDATE exam_results SET score = $1, graded_items = $4 WHERE exam_id = $2 AND student_id = $3',
            [adjustedScore, exam_id, studentDbId, JSON.stringify(overriddenItems)]
          );
        } else {
          await db.query(`
            INSERT INTO exam_results (exam_id, student_id, score, graded_items) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ON CONSTRAINT unique_exam_student DO UPDATE SET score = $3, graded_items = $4
          `, [exam_id, studentDbId, adjustedScore, JSON.stringify(overriddenItems)]);
        }

        return res.status(200).json({
          message: 'Override saved successfully',
          saved: true,
          overriddenItems
        });
      }
    }

    // If student not found, just acknowledge the override
    res.status(200).json({
      message: 'Override acknowledged (student not in DB)',
      saved: false,
      overriddenItems
    });

  } catch (err) {
    console.error('Error saving override:', err);
    res.status(500).json({ message: err.message || String(err) });
  }
};
