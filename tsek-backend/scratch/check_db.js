const db = require('../db');

async function check() {
  try {
    const res = await db.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'exam_results'::regclass");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
