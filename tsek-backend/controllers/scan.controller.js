const { GoogleGenerativeAI } = require("@google/generative-ai");

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // Deletion
          dp[i][j - 1] + 1,    // Insertion
          dp[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }
  return dp[m][n];
}

function calculateSimilarity(str1, str2) {
  const s1 = String(str1 || '').toLowerCase().trim();
  const s2 = String(str2 || '').toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // 1. Direct substring
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.5 + 0.4 * (minLen / maxLen);
  }

  // 2. Levenshtein similarity
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const levSim = 1 - distance / maxLen;

  // 3. Word overlap
  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);
  const common = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  const wordSim = common.length > 0 ? (common.length / Math.max(words1.length, words2.length)) : 0;

  return Math.max(levSim, wordSim * 0.8);
}

exports.scanImage = async (req, res) => {
  try {
    // Support both single file (legacy) and multiple files
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ message: 'No image(s) provided for scanning' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on the server' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // Build image parts for all pages
    const imageParts = files.map((file, index) => ({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype
      }
    }));

    // Adapt prompt based on single vs multi-page
    const isMultiPage = files.length > 1;

    const prompt = isMultiPage
      ? `You are a highly accurate grading system capable of reading both Optical Mark Recognition (OMR) bubbles and handwriting.
You are given ${files.length} images. These are ${files.length} PAGES of the SAME student's exam answer sheet. The items continue across pages with sequential numbering (e.g., page 1 has items 1-50, page 2 has items 51-100, etc.).

1. Identify the Learner Reference Number (LRN) / Student ID encoded in the grid bubbles. The LRN grid is on PAGE 1 ONLY.
   - There are exactly 12 columns in the LRN / Student ID grid.
   - The grid has exactly 10 rows of bubbles. The top-most row is ALWAYS 0, the second row down is 1, the third row down is 2, and so on until the bottom row which is 9.
   - Look at each column individually from left to right.
   - For each column, count how many rows down the shaded bubble is to determine the correct number (0-9). Pay extreme attention to horizontal alignment.
   - Combine these 12 numbers to form the final LRN / Student ID.
   - IMPORTANT: If the grid is completely blank or no bubbles are shaded, you MUST return studentId as null. Do NOT guess or hallucinate any digits.

2. If there is a name field (handwritten or printed) on page 1, identify the student's full name. If it is blank, return null or "".
3. For multiple-choice and true/false questions, read the shaded bubbles. Pay attention to the letters printed inside the bubbles (A, B, C, D, E, or T, F). Record the exact letter that is shaded.
   - STRICT BLANK HANDLING: If a question bubble is NOT shaded or filled, it is completely BLANK. You MUST return its value as null. Do NOT guess, hallucinate, or infer any answer.
4. For identification or enumeration questions, read the handwritten text written on the lines next to the item numbers.
   - STRICT BLANK HANDLING: If a line has no handwriting on it, it is completely BLANK. You MUST return its value as null or "". Do NOT guess, hallucinate, or infer any answer.
5. IMPORTANT: Combine ALL answers from ALL pages into a single "answers" object. The item numbers continue sequentially across pages. Make sure to read every item from every page.
6. DO NOT HALLUCINATE: Accuracy is critical. Double check if any shading or pen stroke actually exists before returning a value. If the entire sheet is empty, return nulls for all questions.

Return the result STRICTLY as a valid, stringified JSON object using the following exact format:
{
  "studentIdReasoning": "Briefly list the shaded number found in each of the 12 columns from left to right (e.g., 'Col 1: 2, Col 2: 0...') to ensure accuracy.",
  "studentId": "123456789012",
  "studentName": "JOHN DOE",
  "answers": {
    "1": "A",
    "2": "C",
    "51": "MITOCHONDRIA",
    "52": "PHOTOSYNTHESIS"
  }
}
Do not include any markdown code blocks (like \`\`\`json) or any conversational text. Return ONLY the raw JSON object.`
      : `You are a highly accurate grading system capable of reading both Optical Mark Recognition (OMR) bubbles and handwriting.
Look carefully at the provided student answer sheet image. 

1. Identify the Learner Reference Number (LRN) / Student ID encoded in the grid bubbles. 
   - There are exactly 12 columns in the LRN / Student ID grid.
   - The grid has exactly 10 rows of bubbles. The top-most row is ALWAYS 0, the second row down is 1, the third row down is 2, and so on until the bottom row which is 9.
   - Look at each column individually from left to right.
   - For each column, count how many rows down the shaded bubble is to determine the correct number (0-9). Pay extreme attention to horizontal alignment.
   - Combine these 12 numbers to form the final LRN / Student ID.
   - IMPORTANT: If the grid is completely blank or no bubbles are shaded, you MUST return studentId as null. Do NOT guess or hallucinate any digits.

2. If there is a name field (handwritten or printed), identify the student's full name. If it is blank, return null or "".
3. For multiple-choice and true/false questions, read the shaded bubbles. Pay attention to the letters printed inside the bubbles (A, B, C, D, E, or T, F). Record the exact letter that is shaded.
   - STRICT BLANK HANDLING: If a question bubble is NOT shaded or filled, it is completely BLANK. You MUST return its value as null. Do NOT guess, hallucinate, or infer any answer.
4. For identification or enumeration questions, read the handwritten text written on the lines next to the item numbers.
   - STRICT BLANK HANDLING: If a line has no handwriting on it, it is completely BLANK. You MUST return its value as null or "". Do NOT guess, hallucinate, or infer any answer.
5. DO NOT HALLUCINATE: Accuracy is critical. Double check if any shading or pen stroke actually exists before returning a value. If the entire sheet is empty, return nulls for all questions.

Return the result STRICTLY as a valid, stringified JSON object using the following exact format:
{
  "studentIdReasoning": "Briefly list the shaded number found in each of the 12 columns from left to right (e.g., 'Col 1: 2, Col 2: 0...') to ensure accuracy.",
  "studentId": "123456789012",
  "studentName": "JOHN DOE",
  "answers": {
    "1": "A",
    "2": "C",
    "3": "MITOCHONDRIA",
    "4": "PHOTOSYNTHESIS",
    "5": "T"
  }
}
Do not include any markdown code blocks (like \`\`\`json) or any conversational text. Return ONLY the raw JSON object.`;

    let responseText;
    try {
      const result = await model.generateContent([prompt, ...imageParts]);
      responseText = result.response.text();
    } catch (apiError) {
      // If we hit a rate limit (429) or 503, fallback to the second API key
      if (apiError.status === 503 || apiError.status === 429 || (apiError.message && (apiError.message.includes('503') || apiError.message.includes('429') || apiError.message.includes('quota')))) {
        console.log("Primary API key failed or quota exceeded. Attempting fallback to GEMINI_API_KEY_2...");
        
        const fallbackKey = process.env.GEMINI_API_KEY_2;
        if (!fallbackKey) {
          console.error("No GEMINI_API_KEY_2 found in .env. Cannot fallback.");
          throw apiError;
        }

        const fallbackGenAI = new GoogleGenerativeAI(fallbackKey);
        const fallbackModel = fallbackGenAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const fallbackResult = await fallbackModel.generateContent([prompt, ...imageParts]);
        responseText = fallbackResult.response.text();
      } else {
        throw apiError; // Throw other errors normally
      }
    }

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

    // Convert the first page image buffer directly into a Base64 string for DB storage
    let imageUrl = null;
    if (files.length > 0) {
      const file = files[0];
      const base64Data = file.buffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64Data}`;
    }

    res.status(200).json({
      message: 'Scanning complete',
      rawText: parsedJson,
      pageCount: files.length,
      imageUrl: imageUrl
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
  const { exam_id, studentId, answers, scanned_image_url, page_count } = req.body;

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
            INSERT INTO exam_results (exam_id, student_id, score, graded_items, scanned_image_url, page_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT ON CONSTRAINT unique_exam_student 
            DO UPDATE SET score = $3, graded_items = $4, scanned_image_url = COALESCE($5, exam_results.scanned_image_url), page_count = COALESCE($6, exam_results.page_count)
          `, [exam_id, studentDbId, totalScore, JSON.stringify(gradedItems), scanned_image_url || null, page_count || 1]);
        }
      }
    }

    let similarStudents = [];
    if (!isEnrolled && classId) {
      try {
        const enrolledStudentsQuery = await db.query(`
          SELECT s.id, s.full_name, s.student_id_number 
          FROM students s
          JOIN class_enrollments ce ON s.id = ce.student_id
          WHERE ce.class_id = $1
        `, [classId]);

        const scannedName = req.body.studentName || '';
        const scannedId = String(studentId || '').trim();

        const calculated = enrolledStudentsQuery.rows.map(row => {
          const nameSim = calculateSimilarity(scannedName, row.full_name);
          const idSim = calculateSimilarity(scannedId, row.student_id_number);
          
          const combinedScore = Math.max(nameSim, idSim);
          return {
            id: row.id,
            name: row.full_name,
            student_id_number: row.student_id_number,
            similarity: combinedScore
          };
        });

        similarStudents = calculated
          .filter(s => s.similarity > 0.35)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);
      } catch (simError) {
        console.error('Failed to calculate similar students:', simError);
      }
    }

    res.status(200).json({
      message: isEnrolled ? 'Grading complete' : 'Student not enrolled in this class',
      score: totalScore,
      totalPossible: totalPossible,
      studentFound: studentExists,
      isEnrolled: isEnrolled,
      classId: classId,
      details: gradedItems,
      similarStudents: similarStudents
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
  const { exam_id, studentId, adjustedScore, overriddenItems, page_count } = req.body;

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
            'UPDATE exam_results SET score = $1, graded_items = $4, page_count = COALESCE($5, exam_results.page_count) WHERE exam_id = $2 AND student_id = $3',
            [adjustedScore, exam_id, studentDbId, JSON.stringify(overriddenItems), page_count || 1]
          );
        } else {
          await db.query(`
            INSERT INTO exam_results (exam_id, student_id, score, graded_items, page_count) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT ON CONSTRAINT unique_exam_student DO UPDATE SET score = $3, graded_items = $4, page_count = COALESCE($5, exam_results.page_count)
          `, [exam_id, studentDbId, adjustedScore, JSON.stringify(overriddenItems), page_count || 1]);
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
