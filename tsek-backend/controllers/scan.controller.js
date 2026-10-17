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
You are given ${files.length} images. These are ${files.length} PAGES of a student's exam answer sheet.

CRITICAL SECURITY CHECK:
1. Verify if all uploaded pages belong to the SAME student. 
   - Check the handwriting style, ink color, pen stroke thickness, name details, or LRN details across all pages.
   - If you detect that the pages belong to different students (e.g., mismatching names, completely different handwriting/pen style, or mismatching student details), set "pagesMatchStudent" to false. Otherwise, set it to true.

2. Identify the Learner Reference Number (LRN) / Student ID. Every printed page has a repeated field for this number. Read it on each page and compare the values.
  - IMPORTANT: If a page's field is blank or illegible, do not guess or hallucinate digits.
  - Use the clearly readable value shared by the pages for studentId. If repeated page values conflict, set "pagesMatchStudent" to false and studentId to null.

3. Identify the Exam / Quiz Title printed at the top of page 1 (for example, "Quiz #1: Cells"). Return it in "examTitle". If blank or not found, return null.
4. If there is a name field (handwritten or printed) on page 1, identify the student's full name. If it is blank, return null or "".
5. For multiple-choice and true/false questions, read the shaded bubbles. Pay attention to the letters printed inside the bubbles (A, B, C, D, E, or T, F). Record the exact letter that is shaded.
   - STRICT BLANK HANDLING: If a question bubble is NOT shaded or filled, it is completely BLANK. You MUST return its value as null. Do NOT guess, hallucinate, or infer any answer.
   - MULTIPLE SHADES: If you detect MORE THAN ONE shaded bubble for a single question (e.g., both A and B are shaded), return ALL shaded letters separated by a comma in alphabetical order (e.g., "A, B" or "A, C"). Do NOT guess or hallucinate unshaded bubbles.
6. For identification or enumeration questions, read the handwritten text written on the lines next to the item numbers.
   - STRICT BLANK HANDLING: If a line has no handwriting on it, it is completely BLANK. You MUST return its value as null or "". Do NOT guess, hallucinate, or infer any answer.
7. IMPORTANT: Combine ALL answers from ALL pages into a single "answers" object. The item numbers continue sequentially across pages. Make sure to read every item from every page.
8. DO NOT HALLUCINATE: Accuracy is critical. Double check if any shading or pen stroke actually exists before returning a value. If the entire sheet is empty, return nulls for all questions.

Return the result STRICTLY as a valid, stringified JSON object using the following exact format:
{
  "examTitle": "Quiz #1: Cells",
  "studentIdReasoning": "Briefly state the LRN/Student ID found on each page and whether the repeated values match.",
  "studentId": "123456789012",
  "studentName": "JOHN DOE",
  "pagesMatchStudent": true,
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

1. Identify the Learner Reference Number (LRN) / Student ID. This will be hand-written in a box/line. Read the numbers clearly.
   - IMPORTANT: If the field is blank or illegible, you MUST return studentId as null. Do NOT guess or hallucinate any digits.

2. Identify the Exam / Quiz Title printed at the top of the answer sheet (for example, "Quiz #1: Cells"). Return it in "examTitle". If blank or not found, return null.
3. If there is a name field (handwritten or printed), identify the student's full name. If it is blank, return null or "".
4. For multiple-choice and true/false questions, read the shaded bubbles. Pay attention to the letters printed inside the bubbles (A, B, C, D, E, or T, F). Record the exact letter that is shaded.
   - STRICT BLANK HANDLING: If a question bubble is NOT shaded or filled, it is completely BLANK. You MUST return its value as null. Do NOT guess, hallucinate, or infer any answer.
   - MULTIPLE SHADES: If you detect MORE THAN ONE shaded bubble for a single question (e.g., both A and B are shaded), return ALL shaded letters separated by a comma in alphabetical order (e.g., "A, B" or "A, C"). Do NOT guess or hallucinate unshaded bubbles.
5. For identification or enumeration questions, read the handwritten text written on the lines next to the item numbers.
   - STRICT BLANK HANDLING: If a line has no handwriting on it, it is completely BLANK. You MUST return its value as null or "". Do NOT guess, hallucinate, or infer any answer.
6. DO NOT HALLUCINATE: Accuracy is critical. Double check if any shading or pen stroke actually exists before returning a value. If the entire sheet is empty, return nulls for all questions.

Return the result STRICTLY as a valid, stringified JSON object using the following exact format:
{
  "examTitle": "Quiz #1: Cells",
  "studentIdReasoning": "Briefly state where you found the LRN and what it says to ensure accuracy.",
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

    // Convert all page image buffers directly into Base64 strings for DB storage
    let imageUrl = null;
    let imageUrls = [];
    if (files.length > 0) {
      imageUrls = files.map(file => {
        const base64Data = file.buffer.toString('base64');
        const mimeType = file.mimetype || 'image/jpeg';
        return `data:${mimeType};base64,${base64Data}`;
      });
      // If multi-page, store as a JSON array string; if single page, store as standard data URI
      imageUrl = imageUrls.length > 1 ? JSON.stringify(imageUrls) : imageUrls[0];
    }

    res.status(200).json({
      message: 'Scanning complete',
      rawText: parsedJson,
      pageCount: files.length,
      imageUrl: imageUrl,
      imageUrls: imageUrls
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

    let enumerationStart = null;
    let enumerationSection = null;

    // Ensure sections follow the standard printed layout order:
    // Multiple Choice -> Identification -> Enumeration -> True or False
    const SECTION_ORDER = ['multipleChoice', 'identification', 'enumeration', 'trueOrFalse'];
    const activeSections = (Array.isArray(parsedConfig) ? parsedConfig : [])
      .filter(s => s && s.enabled)
      .sort((a, b) => {
        const idxA = SECTION_ORDER.indexOf(a.key);
        const idxB = SECTION_ORDER.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

    activeSections.forEach(section => {
      if (section.key === 'enumeration') {
        enumerationStart = currentGlobalNum;
        enumerationSection = section;
      }
      
      for (let i = 1; i <= section.selected; i++) {
        itemMapping[currentGlobalNum] = {
          sectionKey: section.key,
          sectionLocalNum: i,
          points: section.defaultPoints || 1
        };
        currentGlobalNum++;
      }
    });

    let enumGroups = [];
    if (enumerationSection && enumerationStart !== null) {
      const defaultPoints = enumerationSection.defaultPoints || 1;
      
      if (enumerationSection.groups && Array.isArray(enumerationSection.groups) && enumerationSection.groups.length > 0) {
        let currentSubgroupStart = enumerationStart;
        enumerationSection.groups.forEach((group, idx) => {
          const size = group.size || 1;
          const end = currentSubgroupStart + size - 1;
          enumGroups.push({
            index: idx,
            start: currentSubgroupStart,
            end: end,
            strictOrder: group.strictOrder !== false, // default to true if not specified
            points: defaultPoints
          });
          currentSubgroupStart += size;
        });
      } else {
        // Backward compatibility fallback: single group of size `enumerationSection.selected`
        const strict = enumerationSection.strictOrder !== false;
        enumGroups.push({
          index: 0,
          start: enumerationStart,
          end: enumerationStart + enumerationSection.selected - 1,
          strictOrder: strict,
          points: defaultPoints
        });
      }
    }

    // 3. Grade Answers
    let totalScore = 0;
    let totalPossible = 0;
    const gradedItems = {};

    const getNonStrictSubgroup = (gNum) => {
      return enumGroups.find(g => !g.strictOrder && gNum >= g.start && gNum <= g.end);
    };

    // Grade normal items
    for (const [globalNumStr, studentAnswer] of Object.entries(answers)) {
      const globalNum = parseInt(globalNumStr, 10);
      
      // Skip if it's part of a non-strict enumeration subgroup (graded separately below)
      if (getNonStrictSubgroup(globalNum)) continue;

      const mapping = itemMapping[globalNum];
      if (!mapping) continue;

      const { sectionKey, sectionLocalNum, points } = mapping;
      const sectionAnswers = parsedAnswerKey[sectionKey] || {};
      const correctAnswer = sectionAnswers[sectionLocalNum];

      let isCorrect = false;
      let isDoubleShade = false;

      if (!studentAnswer) {
        isCorrect = false;
      } else if (Array.isArray(correctAnswer)) {
        // Multiple Choice / True False (Array of allowed answers configured for this item)
        const allowedAnswers = correctAnswer.map(a => String(a).toUpperCase().trim()).filter(Boolean);

        // Parse student shaded answers (can be "A", "A, B", ["A", "B"], or legacy "INVALID_MULTIPLE")
        let studentShades = [];
        if (Array.isArray(studentAnswer)) {
          studentShades = studentAnswer.map(s => String(s).toUpperCase().trim()).filter(Boolean);
        } else if (typeof studentAnswer === 'string') {
          const rawUpper = studentAnswer.toUpperCase().trim();
          if (rawUpper === 'INVALID_MULTIPLE') {
            studentShades = ['INVALID_MULTIPLE'];
          } else {
            studentShades = rawUpper.split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        if (studentShades.length === 0) {
          isCorrect = false;
        } else if (studentShades.includes('INVALID_MULTIPLE')) {
          // Unresolvable multiple shade
          isCorrect = false;
          isDoubleShade = true;
        } else if (allowedAnswers.length <= 1) {
          // Question only has 1 valid answer: automark double/multiple answers as wrong!
          if (studentShades.length > 1) {
            isCorrect = false;
            isDoubleShade = true;
          } else if (studentShades.length === 1 && allowedAnswers.includes(studentShades[0])) {
            isCorrect = true;
          } else {
            isCorrect = false;
          }
        } else {
          // Question has MORE THAN 1 valid answer on purpose (multi-select)
          // Verification: It should NOT be marked wrong if the student shaded valid answers!
          const allShadesValid = studentShades.every(s => allowedAnswers.includes(s));
          if (allShadesValid && studentShades.length > 0) {
            isCorrect = true;
          } else {
            isCorrect = false;
          }
        }
      } else if (typeof correctAnswer === 'string') {
        // Identification / Enumeration (Strict)
        if (studentAnswer.toUpperCase().trim() === correctAnswer.toUpperCase().trim()) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        totalScore += points;
      }
      totalPossible += points;

      gradedItems[globalNum] = {
        studentAnswer: Array.isArray(studentAnswer) ? studentAnswer.join(', ') : (studentAnswer || ''),
        correctAnswer,
        isCorrect,
        isDoubleShade,
        pointsAwarded: isCorrect ? points : 0,
        maxPoints: points
      };
    }

    // Grade non-strict subgroups if applicable
    enumGroups.filter(g => !g.strictOrder).forEach(group => {
      const start = group.start;
      const end = group.end;
      const points = group.points;

      // Extract all expected answers for this subgroup's local range
      const correctAnswers = [];
      const sectionAnswers = parsedAnswerKey['enumeration'] || {};
      
      const sectionLocalStart = start - enumerationStart + 1;
      const sectionLocalEnd = end - enumerationStart + 1;

      for (let localNum = sectionLocalStart; localNum <= sectionLocalEnd; localNum++) {
        if (sectionAnswers[localNum] !== undefined) {
          correctAnswers.push({
            localNum: localNum,
            value: String(sectionAnswers[localNum]).toUpperCase().trim(),
            matched: false
          });
        }
      }

      // Process each global item in this subgroup
      for (let globalNum = start; globalNum <= end; globalNum++) {
        const studentAnswer = answers[globalNum];
        let isCorrect = false;
        let matchedLocalNum = null;

        if (studentAnswer) {
          const cleanStudentAns = String(studentAnswer).toUpperCase().trim();
          
          // Match with an unmatched expected answer within this subgroup's correct list
          for (const correct of correctAnswers) {
            if (!correct.matched && cleanStudentAns === correct.value) {
              correct.matched = true;
              isCorrect = true;
              matchedLocalNum = correct.localNum;
              break;
            }
          }
        }

        if (isCorrect) {
          totalScore += points;
        }
        totalPossible += points;

        gradedItems[globalNum] = {
          studentAnswer: studentAnswer || '',
          correctAnswer: matchedLocalNum ? sectionAnswers[matchedLocalNum] : (sectionAnswers[globalNum - start + sectionLocalStart] || ''),
          isCorrect,
          pointsAwarded: isCorrect ? points : 0,
          maxPoints: points
        };
      }
    });

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

        const enrollmentQuery = await db.query(`
          SELECT 1
          FROM exam_classes ec
          JOIN class_enrollments ce ON ce.class_id = ec.class_id
          WHERE ec.exam_id = $1 AND ce.student_id = $2
          LIMIT 1
        `, [exam_id, studentDbId]);
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
  const { exam_id, studentId, adjustedScore, overriddenItems, details, page_count, scanned_image_url } = req.body;

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

        // Fetch existing exam_result to preserve full item breakdown if details was omitted
        const existing = await db.query(
          'SELECT id, graded_items FROM exam_results WHERE exam_id = $1 AND student_id = $2',
          [exam_id, studentDbId]
        );

        let finalGradedItems = details;
        if (!finalGradedItems && existing.rows.length > 0) {
          try {
            const raw = existing.rows[0].graded_items;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              finalGradedItems = { ...parsed };
              if (Array.isArray(overriddenItems)) {
                overriddenItems.forEach(itemKey => {
                  if (finalGradedItems[itemKey]) {
                    finalGradedItems[itemKey].isCorrect = true;
                    finalGradedItems[itemKey].pointsAwarded = finalGradedItems[itemKey].maxPoints || 1;
                  }
                });
              }
            }
          } catch (e) {
            console.error('Failed to parse existing graded_items:', e);
          }
        }

        if (!finalGradedItems) {
          finalGradedItems = overriddenItems;
        }

        if (existing.rows.length > 0) {
          await db.query(
            'UPDATE exam_results SET score = $1, graded_items = $4, page_count = COALESCE($5, exam_results.page_count), scanned_image_url = COALESCE($6, exam_results.scanned_image_url) WHERE exam_id = $2 AND student_id = $3',
            [adjustedScore, exam_id, studentDbId, JSON.stringify(finalGradedItems), page_count || 1, scanned_image_url || null]
          );
        } else {
          await db.query(`
            INSERT INTO exam_results (exam_id, student_id, score, graded_items, page_count, scanned_image_url) 
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT ON CONSTRAINT unique_exam_student DO UPDATE SET score = $3, graded_items = $4, page_count = COALESCE($5, exam_results.page_count), scanned_image_url = COALESCE($6, exam_results.scanned_image_url)
          `, [exam_id, studentDbId, adjustedScore, JSON.stringify(finalGradedItems), page_count || 1, scanned_image_url || null]);
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
