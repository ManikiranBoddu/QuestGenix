const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./questions.db');

db.serialize(() => {
  // Existing tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT,
      profilePic TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      lastLogin TEXT,
      totalPublications INTEGER DEFAULT 0,
      publicationsByDomain TEXT DEFAULT '{}',
      totalQuizzes INTEGER DEFAULT 0,
      quizNames TEXT DEFAULT '[]',
      totalAssignments INTEGER DEFAULT 0,
      totalQuestionsGenerated INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      domain TEXT,
      text TEXT,
      questions TEXT,
      answers TEXT,
      feedback TEXT,
      score INTEGER,
      total INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Add new columns to existing publications table
  db.run(`ALTER TABLE publications ADD COLUMN answers TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error(err);
  });
  db.run(`ALTER TABLE publications ADD COLUMN feedback TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error(err);
  });
  db.run(`ALTER TABLE publications ADD COLUMN score INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error(err);
  });
  db.run(`ALTER TABLE publications ADD COLUMN total INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error(err);
  });

  // Other existing tables remain unchanged
  db.run(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      resume_text TEXT,
      job_description TEXT,
      questions TEXT,
      score INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      quiz_name TEXT,
      questions TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS publication_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      publication_id INTEGER,
      score INTEGER,
      total INTEGER,
      feedback TEXT,
      answers TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(publication_id) REFERENCES publications(id),
      UNIQUE(user_id, publication_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS publication_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      publication_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(publication_id) REFERENCES publications(id),
      UNIQUE(user_id, publication_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS publication_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      publication_id INTEGER,
      text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(publication_id) REFERENCES publications(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS saved_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      publication_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(publication_id) REFERENCES publications(id),
      UNIQUE(user_id, publication_id)
    )
  `);
});

module.exports = db;