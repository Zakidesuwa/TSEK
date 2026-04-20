const db = require('./db');
const bcrypt = require('bcrypt');

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    // 1. Clear existing data
    await db.query(`
      TRUNCATE TABLE 
        exam_results, 
        exams, 
        class_enrollments, 
        students, 
        classes, 
        instructors 
      RESTART IDENTITY CASCADE;
    `);
    console.log('Cleared existing data.');

    // 2. Insert Instructor
    const passwordHash = await bcrypt.hash('password123', 10);
    const instructorRes = await db.query(`
      INSERT INTO instructors (prefix, full_name, school_email, password_hash)
      VALUES ('Mr.', 'Chris Allen Pineda', 'instructor@school.edu', $1)
      RETURNING id;
    `, [passwordHash]);
    const instructorId = instructorRes.rows[0].id;
    console.log('Created Instructor.');

    // 3. Insert Classes
    const classRecords = [
      { name: "People and Earth's Ecosystem", section: "BSIT - 1A&B" },
      { name: "People and Earth's Ecosystem", section: "BSCS - 1A&B" },
      { name: "Science Technology and Society", section: "BSIT - 1C&D" },
      { name: "Science Technology and Society", section: "BSCS - 1C&D" },
    ];

    const classesData = [];
    for (const c of classRecords) {
      const res = await db.query(`
        INSERT INTO classes (instructor_id, class_name, section_code)
        VALUES ($1, $2, $3)
        RETURNING id;
      `, [instructorId, c.name, c.section]);
      classesData.push({ ...c, id: res.rows[0].id });
    }
    console.log('Created Classes.');

    // 4. Insert Students & Enrollments
    const studentsData = [
      { name: 'Markuz Gabriel Diosomito', number: '202000000' },
      { name: 'Jerald Pangan', number: '202000001' },
      { name: 'Ana Marie Santos', number: '202000002' },
      { name: 'Juan Carlos Reyes', number: '202000003' },
      { name: 'Maria Clara Cruz', number: '202000004' },
      { name: 'Jose Rizal Garcia', number: '202000005' },
      { name: 'Carlos Miguel Torres', number: '202100010' },
      { name: 'Sofia Isabelle Reyes', number: '202100011' }
    ];

    for (let i = 0; i < studentsData.length; i++) {
      const s = studentsData[i];
      const res = await db.query(`
        INSERT INTO students (student_id_number, full_name)
        VALUES ($1, $2)
        RETURNING id;
      `, [s.number, s.name]);
      const studentId = res.rows[0].id;

      // Enroll in the first two classes randomly for dummy data
      await db.query(`INSERT INTO class_enrollments (class_id, student_id) VALUES ($1, $2)`, [classesData[0].id, studentId]);
      if (i % 2 === 0) {
        await db.query(`INSERT INTO class_enrollments (class_id, student_id) VALUES ($1, $2)`, [classesData[1].id, studentId]);
      }
    }
    console.log('Created Students & Enrollments.');

    // 5. Insert Exams
    const examRecords = [
      { classId: classesData[0].id, title: 'Quiz #1: Ecosystems', items: 50 },
      { classId: classesData[0].id, title: 'Midterm Exams', items: 100 },
      { classId: classesData[1].id, title: 'Quiz #1: Ecosystems', items: 50 },
      { classId: classesData[2].id, title: 'Midterm Examination', items: 100 }
    ];

    for (const exam of examRecords) {
      const res = await db.query(`
        INSERT INTO exams (class_id, exam_title, total_items)
        VALUES ($1, $2, $3)
        RETURNING id;
      `, [exam.classId, exam.title, exam.items]);
      
      const examId = res.rows[0].id;

      // 6. Insert Exam Results (simulate 5 random students taking the exam)
      for(let j = 1; j <= 5; j++) {
         const score = Math.floor(Math.random() * exam.items);
         await db.query(`
           INSERT INTO exam_results (exam_id, student_id, score, scanned_image_url)
           VALUES ($1, $2, $3, $4)
         `, [examId, j, score, '']);
      }
    }
    console.log('Created Exams & Results.');

    console.log('✅ Database seeded successfully!');
    process.exit(0);

  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

seedDatabase();
