const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateQuestions } = require('../questionGenerator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const docxParser = require('docx-parser');
const textract = require('textract');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const SECRET_KEY = 'my-secret-key';
const upload = multer({ dest: 'uploads/' });

router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO users (username, password, email, createdAt) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, email || null, createdAt],
    function (err) {
      if (err) {
        console.log('Registration error:', err.message);
        return res.status(400).json({ error: 'Username exists' });
      }
      const userId = this.lastID;
      const token = jwt.sign({ id: userId }, SECRET_KEY);
      console.log('User registered, token generated:', token);
      res.json({ message: 'Registered successfully', token });
    }
  );
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      console.log('Login error: User not found, username:', username);
      return res.status(400).json({ error: 'User not found' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('Login error: Invalid password for username:', username);
      return res.status(400).json({ error: 'Invalid password' });
    }
    const token = jwt.sign({ id: user.id }, SECRET_KEY);
    db.run('UPDATE users SET lastLogin = ? WHERE id = ?', [new Date().toISOString(), user.id], (err) => {
      if (err) console.log('Error updating lastLogin:', err.message);
    });
    console.log('User logged in, token generated:', token);
    res.json({ token });
  });
});

const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  console.log('Verifying token:', token);
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No token' });
  }
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.log('Token decoded:', decoded);
    req.userId = decoded.id;
    next();
  });
};

router.post('/upload-file', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = req.file.path;
  let text = '';

  try {
    console.log('Processing file:', req.file.originalname, 'mimetype:', req.file.mimetype, 'size:', req.file.size);
    if (req.file.mimetype === 'application/pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } catch (pdfError) {
        throw new Error(`PDF parsing failed: ${pdfError.message}`);
      }
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await new Promise((resolve, reject) => {
        docxParser.parseDocx(filePath, (text) => resolve(text), (err) => reject(err));
      });
    } else if (req.file.mimetype === 'text/plain') {
      text = await new Promise((resolve, reject) => {
        textract.fromFileWithPath(filePath, (err, text) => {
          if (err) reject(err);
          resolve(text);
        });
      });
    } else {
      throw new Error('Unsupported file type: ' + req.file.mimetype);
    }

    fs.unlinkSync(filePath);
    if (!text) throw new Error('No text extracted from file');
    console.log('Extracted text from file:', text);
    res.json({ text });
  } catch (error) {
    fs.unlinkSync(filePath);
    console.error('File processing error:', error.message);
    res.status(500).json({ error: 'Failed to parse file: ' + error.message });
  }
});

router.post('/upload-image', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const filePath = req.file.path;
  let text = '';

  try {
    console.log('Processing image:', req.file.originalname, 'mimetype:', req.file.mimetype);
    const worker = await createWorker();
    const { data: { text: extractedText } } = await worker.recognize(filePath);
    text = extractedText || '';
    await worker.terminate();

    fs.unlinkSync(filePath);
    if (!text) throw new Error('No text extracted from image');
    console.log('Extracted text from image:', text);
    res.json({ text });
  } catch (error) {
    fs.unlinkSync(filePath);
    console.error('Image processing error:', error.message);
    res.status(500).json({ error: 'Failed to process image: ' + error.message });
  }
});

router.post('/generate', authenticate, async (req, res) => {
  const { text, questionTypes } = req.body;
  console.log('Received generate request with text length:', text.length, 'and types:', questionTypes);
  try {
    if (!text || !questionTypes || !Array.isArray(questionTypes)) {
      return res.status(400).json({ error: 'Text and question types are required' });
    }
    const questions = await generateQuestions(text, questionTypes);
    console.log('Generated questions:', questions);
    db.run(
      'UPDATE users SET totalQuestionsGenerated = totalQuestionsGenerated + ? WHERE id = ?',
      [questions.length, req.userId],
      (err) => {
        if (err) console.log('Error updating totalQuestionsGenerated:', err.message);
      }
    );
    res.json({ questions });
  } catch (error) {
    console.error('Backend error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/submit', authenticate, (req, res) => {
  const { answers, questions } = req.body;
  let score = 0;
  const feedback = questions.map((q) => {
    const userAnswer = answers[q.question];
    let isCorrect = false;
    if (q.type === 'msq') {
      isCorrect = Array.isArray(userAnswer) && Array.isArray(q.answer) &&
        userAnswer.length === q.answer.length &&
        userAnswer.every((ans) => q.answer.includes(ans)) &&
        q.answer.every((ans) => userAnswer.includes(ans));
    } else {
      isCorrect = q.answer && userAnswer === q.answer;
    }
    if (isCorrect) score++;
    return {
      question: q.question,
      type: q.type,
      options: q.options || [],
      userAnswer: Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer,
      correctAnswer: Array.isArray(q.answer) ? q.answer.join(', ') : q.answer,
      isCorrect,
    };
  });
  db.run(
    'UPDATE users SET totalAssignments = totalAssignments + 1 WHERE id = ?',
    [req.userId],
    (err) => {
      if (err) console.log('Error updating totalAssignments:', err.message);
    }
  );
  res.json({ score, total: questions.length, feedback });
});

router.post('/submit-publication-attempt', authenticate, (req, res) => {
  const { publicationId, score, total, feedback, answers } = req.body;
  if (!publicationId || score === undefined || total === undefined || !feedback) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let calculatedScore = 0;
  const validatedFeedback = feedback.map((f, index) => {
    const isCorrect = f.isCorrect === true;
    if (isCorrect) calculatedScore++;
    return {
      ...f,
      isCorrect,
      userAnswer: f.userAnswer || 'No answer',
      correctAnswer: f.correctAnswer || 'N/A',
    };
  });

  if (calculatedScore !== score) {
    console.warn(`Score mismatch for publication ${publicationId}: Submitted ${score}, Calculated ${calculatedScore}`);
    score = calculatedScore;
  }

  db.run(
    `INSERT INTO publication_attempts (user_id, publication_id, score, total, feedback, answers) 
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, publication_id) 
     DO UPDATE SET score = ?, total = ?, feedback = ?, answers = ?, created_at = CURRENT_TIMESTAMP`,
    [
      req.userId,
      publicationId,
      score,
      total,
      JSON.stringify(validatedFeedback),
      JSON.stringify(answers),
      score,
      total,
      JSON.stringify(validatedFeedback),
      JSON.stringify(answers),
    ],
    (err) => {
      if (err) {
        console.error('Error storing publication attempt:', err.message);
        return res.status(500).json({ error: 'Failed to store attempt' });
      }
      res.json({ message: 'Attempt stored successfully', score, total, feedback: validatedFeedback });
    }
  );
});

router.get('/publication-attempts', authenticate, (req, res) => {
  db.all(
    'SELECT * FROM publication_attempts WHERE user_id = ?',
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching publication attempts:', err.message);
        return res.status(500).json({ error: 'Failed to fetch attempts' });
      }
      const attempts = rows.map(row => ({
        publicationId: row.publication_id,
        score: row.score,
        total: row.total,
        feedback: JSON.parse(row.feedback),
        answers: JSON.parse(row.answers),
      }));
      res.json(attempts);
    }
  );
});

router.post('/publish', authenticate, (req, res) => {
  const { text, questions, domain, answers, feedback, score, total } = req.body;
  console.log('Received publish request with questions:', questions, 'answers:', answers, 'feedback:', feedback);

  if (!text || !questions || !domain) {
    return res.status(400).json({ error: 'Text, questions, and domain are required' });
  }

  // Validate answers and feedback
  if (answers && typeof answers !== 'object') {
    return res.status(400).json({ error: 'Answers must be an object' });
  }
  if (feedback && !Array.isArray(feedback)) {
    return res.status(400).json({ error: 'Feedback must be an array' });
  }

  // Ensure feedback entries have required fields
  const validatedFeedback = feedback ? feedback.map((f, index) => ({
    question: f.question || `Question ${index + 1}`,
    type: f.type || 'unknown',
    options: f.options || [],
    userAnswer: f.userAnswer || 'No answer',
    correctAnswer: f.correctAnswer || 'N/A',
    isCorrect: f.isCorrect === true, // Ensure boolean
  })) : [];

  db.run(
    `INSERT INTO publications (user_id, domain, text, questions, answers, feedback, score, total) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.userId,
      domain,
      text,
      JSON.stringify(questions),
      answers ? JSON.stringify(answers) : JSON.stringify({}),
      JSON.stringify(validatedFeedback),
      score !== undefined ? score : null,
      total !== undefined ? total : null,
    ],
    function (err) {
      if (err) {
        console.log('Error inserting publication:', err.message);
        return res.status(500).json({ error: err.message });
      }
      const pubId = this.lastID;
      db.get('SELECT totalPublications, publicationsByDomain FROM users WHERE id = ?', [req.userId], (err, row) => {
        if (err) {
          console.log('Error fetching user stats:', err.message);
          return res.status(500).json({ error: err.message });
        }
        const totalPublications = (row.totalPublications || 0) + 1;
        const domains = JSON.parse(row.publicationsByDomain || '{}');
        domains[domain] = (domains[domain] || 0) + 1;
        db.run(
          'UPDATE users SET totalPublications = ?, publicationsByDomain = ? WHERE id = ?',
          [totalPublications, JSON.stringify(domains), req.userId],
          (err) => {
            if (err) console.log('Error updating user stats:', err.message);
          }
        );
      });
      res.json({ message: 'Published successfully', id: pubId });
    }
  );
});

router.get('/publications', authenticate, (req, res) => {
  const { domain } = req.query;
  let query = 'SELECT p.*, u.username FROM publications p JOIN users u ON p.user_id = u.id';
  let params = [];
  if (domain && domain !== 'All') {
    query += ' WHERE p.domain = ?';
    params = [domain];
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.log('Error fetching publications:', err.message);
      return res.status(500).json({ error: err.message });
    }
    const publications = rows.map((row) => {
      const publication = {
        id: row.id,
        user_id: row.user_id,
        username: row.username,
        domain: row.domain,
        text: row.text,
        questions: row.questions,
        answers: row.answers || '{}',
        feedback: row.feedback || '[]',
        score: row.score,
        total: row.total,
      };
      console.log('Publication data:', publication); // Debug log
      return publication;
    });
    res.json(publications);
  });
});

router.get('/domains', authenticate, (req, res) => {
  db.all('SELECT DISTINCT domain FROM publications WHERE domain IS NOT NULL AND domain != "" ORDER BY domain ASC', [], (err, rows) => {
    if (err) {
      console.log('Error fetching domains:', err.message);
      return res.status(500).json({ error: err.message });
    }
    const domains = rows.map(row => row.domain).filter(Boolean);
    res.json(['All', ...domains]);
  });
});

router.get('/publications/:pubId', authenticate, (req, res) => {
  const { pubId } = req.params;
  db.get('SELECT * FROM publications WHERE id = ?', [pubId], (err, row) => {
    if (err) {
      console.log('Error fetching publication:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log('Publication not found, pubId:', pubId);
      return res.status(404).json({ error: 'Publication not found' });
    }
    const publication = {
      id: row.id,
      user_id: row.user_id,
      domain: row.domain,
      text: row.text,
      questions: row.questions,
      answers: row.answers || '{}',
      feedback: row.feedback || '[]',
      score: row.score,
      total: row.total,
    };
    console.log('Returning publication:', publication); // Debug log
    res.json(publication);
  });
});

router.post('/like', authenticate, (req, res) => {
  const { publicationId } = req.body;
  if (!publicationId) return res.status(400).json({ error: 'Publication ID is required' });

  db.get(
    'SELECT * FROM publication_likes WHERE user_id = ? AND publication_id = ?',
    [req.userId, publicationId],
    (err, row) => {
      if (err) {
        console.error('Error checking like:', err.message);
        return res.status(500).json({ error: 'Failed to process like' });
      }
      if (row) {
        db.run(
          'DELETE FROM publication_likes WHERE user_id = ? AND publication_id = ?',
          [req.userId, publicationId],
          (err) => {
            if (err) {
              console.error('Error unliking:', err.message);
              return res.status(500).json({ error: 'Failed to unlike' });
            }
            res.json({ message: 'Unliked successfully' });
          }
        );
      } else {
        db.run(
          'INSERT INTO publication_likes (user_id, publication_id) VALUES (?, ?)',
          [req.userId, publicationId],
          (err) => {
            if (err) {
              console.error('Error liking:', err.message);
              return res.status(500).json({ error: 'Failed to like' });
            }
            res.json({ message: 'Liked successfully' });
          }
        );
      }
    }
  );
});

router.get('/likes', authenticate, (req, res) => {
  db.all(
    'SELECT publication_id, COUNT(*) as count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as userLiked FROM publication_likes GROUP BY publication_id',
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching likes:', err.message);
        return res.status(500).json({ error: 'Failed to fetch likes' });
      }
      const likes = rows.reduce((acc, row) => {
        acc[row.publication_id] = { count: row.count, userLiked: !!row.userLiked };
        return acc;
      }, {});
      res.json(likes);
    }
  );
});

router.post('/comment', authenticate, (req, res) => {
  const { publicationId, text } = req.body;
  if (!publicationId || !text) return res.status(400).json({ error: 'Publication ID and comment text are required' });

  db.run(
    'INSERT INTO publication_comments (user_id, publication_id, text) VALUES (?, ?, ?)',
    [req.userId, publicationId, text],
    (err) => {
      if (err) {
        console.error('Error adding comment:', err.message);
        return res.status(500).json({ error: 'Failed to add comment' });
      }
      res.json({ message: 'Comment added successfully' });
    }
  );
});

router.get('/comments', authenticate, (req, res) => {
  db.all(
    'SELECT pc.*, u.username FROM publication_comments pc JOIN users u ON pc.user_id = u.id ORDER BY pc.created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching comments:', err.message);
        return res.status(500).json({ error: 'Failed to fetch comments' });
      }
      res.json(rows.map(row => ({
        publicationId: row.publication_id,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        createdAt: row.created_at,
      })));
    }
  );
});

router.get('/download-publication/:pubId', authenticate, (req, res) => {
  const { pubId } = req.params;
  db.get('SELECT text FROM publications WHERE id = ?', [pubId], (err, row) => {
    if (err) {
      console.error('Error fetching publication:', err.message);
      return res.status(500).json({ error: 'Failed to fetch publication' });
    }
    if (!row) return res.status(404).json({ error: 'Publication not found' });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=publication_${pubId}.txt`);
    res.send(row.text);
  });
});

router.get('/share-publication/:pubId', authenticate, (req, res) => {
  const { pubId } = req.params;
  db.get('SELECT id FROM publications WHERE id = ?', [pubId], (err, row) => {
    if (err) {
      console.error('Error fetching publication:', err.message);
      return res.status(500).json({ error: 'Failed to fetch publication' });
    }
    if (!row) return res.status(404).json({ error: 'Publication not found' });

    const shareLink = `http://localhost:3000/questions/${pubId}`;
    res.json({ shareLink });
  });
});

router.post('/save-publication', authenticate, (req, res) => {
  const { publicationId } = req.body;
  if (!publicationId) return res.status(400).json({ error: 'Publication ID is required' });

  db.get(
    'SELECT * FROM saved_publications WHERE user_id = ? AND publication_id = ?',
    [req.userId, publicationId],
    (err, row) => {
      if (err) {
        console.error('Error checking saved publication:', err.message);
        return res.status(500).json({ error: 'Failed to process save' });
      }
      if (row) {
        db.run(
          'DELETE FROM saved_publications WHERE user_id = ? AND publication_id = ?',
          [req.userId, publicationId],
          (err) => {
            if (err) {
              console.error('Error unsaving:', err.message);
              return res.status(500).json({ error: 'Failed to unsave' });
            }
            res.json({ message: 'Unsaved successfully' });
          }
        );
      } else {
        db.run(
          'INSERT INTO saved_publications (user_id, publication_id) VALUES (?, ?)',
          [req.userId, publicationId],
          (err) => {
            if (err) {
              console.error('Error saving:', err.message);
              return res.status(500).json({ error: 'Failed to save' });
            }
            res.json({ message: 'Saved successfully' });
          }
        );
      }
    }
  );
});

router.get('/saved-publications', authenticate, (req, res) => {
  db.all(
    'SELECT publication_id FROM saved_publications WHERE user_id = ?',
    [req.userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching saved publications:', err.message);
        return res.status(500).json({ error: 'Failed to fetch saved publications' });
      }
      res.json(rows.map(row => ({ id: row.publication_id })));
    }
  );
});

router.post('/create-quiz', authenticate, (req, res) => {
  const { quizName, questions } = req.body;
  console.log('Creating quiz with quizName:', quizName, 'questions:', questions);
  if (!quizName || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Quiz name and questions array are required' });
  }
  db.run(
    'INSERT INTO quizzes (user_id, quiz_name, questions) VALUES (?, ?, ?)',
    [req.userId, quizName, JSON.stringify(questions)],
    (err) => {
      if (err) {
        console.log('Error creating quiz:', err.message);
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT totalQuizzes, quizNames FROM users WHERE id = ?', [req.userId], (err, row) => {
        if (err) {
          console.log('Error fetching user stats:', err.message);
          return res.status(500).json({ error: err.message });
        }
        const totalQuizzes = (row.totalQuizzes || 0) + 1;
        const quizNames = JSON.parse(row.quizNames || '[]');
        quizNames.push(quizName);
        db.run(
          'UPDATE users SET totalQuizzes = ?, quizNames = ? WHERE id = ?',
          [totalQuizzes, JSON.stringify(quizNames), req.userId],
          (err) => {
            if (err) console.log('Error updating user stats:', err.message);
          }
        );
      });
      res.json({ message: 'Quiz created successfully' });
    }
  );
});

router.get('/quizzes', authenticate, (req, res) => {
  db.all('SELECT * FROM quizzes WHERE user_id = ?', [req.userId], (err, rows) => {
    if (err) {
      console.log('Error fetching quizzes:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('Fetched quizzes for user:', req.userId, 'Quizzes:', rows);
    res.json(rows);
  });
});

router.get('/take-quiz/:quizId', authenticate, (req, res) => {
  const quizId = req.params.quizId;
  db.get('SELECT quiz_name AS quizName, questions FROM quizzes WHERE id = ? AND user_id = ?', [quizId, req.userId], (err, row) => {
    if (err || !row) {
      console.log('Quiz not found, quizId:', quizId, 'userId:', req.userId);
      return res.status(404).json({ error: 'Quiz not found' });
    }
    const questions = JSON.parse(row.questions);
    console.log('Fetched quiz:', { quizName: row.quizName, questions });
    res.json({ quizName: row.quizName, questions });
  });
});

router.post('/submit-quiz', authenticate, (req, res) => {
  const { quizId, answers } = req.body;
  db.get('SELECT quiz_name AS quizName, questions FROM quizzes WHERE id = ? AND user_id = ?', [quizId, req.userId], (err, row) => {
    if (err || !row) {
      console.log('Quiz not found for submission, quizId:', quizId, 'userId:', req.userId);
      return res.status(404).json({ error: 'Quiz not found' });
    }
    const questions = JSON.parse(row.questions);
    let score = 0;
    const feedback = questions.map((q) => {
      const userAnswer = answers[q.question];
      let isCorrect = false;
      if (q.type === 'msq') {
        isCorrect = Array.isArray(userAnswer) && Array.isArray(q.answer) &&
          userAnswer.length === q.answer.length &&
          userAnswer.every((ans) => q.answer.includes(ans)) &&
          q.answer.every((ans) => userAnswer.includes(ans));
      } else {
        isCorrect = q.answer && userAnswer === q.answer;
      }
      if (isCorrect) score++;
      return {
        question: q.question,
        userAnswer: Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer,
        correctAnswer: Array.isArray(q.answer) ? q.answer.join(', ') : q.answer,
        isCorrect,
      };
    });
    db.run(
      'UPDATE users SET totalAssignments = totalAssignments + 1 WHERE id = ?',
      [req.userId],
      (err) => {
        if (err) console.log('Error updating totalAssignments:', err.message);
      }
    );
    res.json({ score, total: questions.length, feedback, message: 'Quiz submitted successfully' });
  });
});

router.get('/user', authenticate, (req, res) => {
  console.log('Fetching user data for userId:', req.userId);
  db.get('SELECT * FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err) {
      console.log('Database error fetching user:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      console.log('User not found for userId:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('User data retrieved:', user);
    res.json({
      username: user.username,
      password: user.password,
      email: user.email || '',
      profilePic: user.profilePic || '',
      createdAt: user.createdAt || new Date().toISOString(),
      lastLogin: user.lastLogin || null,
      totalPublications: user.totalPublications || 0,
      publicationsByDomain: JSON.parse(user.publicationsByDomain || '{}'),
      totalQuizzes: user.totalQuizzes || 0,
      quizNames: JSON.parse(user.quizNames || '[]'),
      totalAssignments: user.totalAssignments || 0,
      totalQuestionsGenerated: user.totalQuestionsGenerated || 0,
    });
  });
});

router.post('/upload-profile-pic', authenticate, upload.single('profilePic'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = `/uploads/${req.file.filename}`;
  db.run(
    'UPDATE users SET profilePic = ? WHERE id = ?',
    [filePath, req.userId],
    (err) => {
      if (err) {
        console.log('Error updating profile picture:', err.message);
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: err.message });
      }
      res.json({ profilePicUrl: filePath });
    }
  );
});

router.post('/create-resume', authenticate, (req, res) => {
  const { template, answers } = req.body;
  if (!template || !answers) return res.status(400).json({ error: 'Template and answers are required' });

  console.log('Received answers for PDF generation:', JSON.stringify(answers, null, 2));

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true,
  });

  res.setHeader('Content-Disposition', `attachment; filename=${answers.name || 'Resume'}_CV.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  const primaryColor = '#1a3c34';
  const secondaryColor = '#16a085';
  const textColor = '#2f2f2f';
  const accentColor = '#e74c3c';
  const dividerColor = '#bdc3c7';

  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.font('Helvetica-Bold')
    .fontSize(24)
    .fillColor('#ffffff')
    .text(`${answers.name || 'Your Name'}`, 40, 30, { align: 'left' });
  doc.font('Helvetica')
    .fontSize(10)
    .fillColor('#ffffff')
    .text(`Email: ${answers.email || 'N/A'} | Phone: ${answers.phone || 'N/A'} | Address: ${answers.address || 'N/A'}`, 40, 60, { align: 'left' });
  doc.moveDown(2);

  doc.y = 120;

  const addSection = (title, contentFunc) => {
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(primaryColor)
      .text(title, 40, doc.y, { continued: false })
      .moveDown(0.5);
    doc.strokeColor(dividerColor)
      .lineWidth(1)
      .moveTo(40, doc.y)
      .lineTo(550, doc.y)
      .stroke()
      .moveDown(0.5);
    contentFunc();
    doc.moveDown(1);
  };

  if (Array.isArray(answers.education) && answers.education.length > 0) {
    addSection('Education', () => {
      answers.education.forEach((edu) => {
        if (edu.degree) {
          doc.font('Helvetica-Bold')
            .fontSize(12)
            .fillColor(textColor)
            .text(`${edu.degree}, ${edu.institution || 'N/A'}`, 60)
            .moveDown(0.2);
          doc.font('Helvetica')
            .fontSize(10)
            .fillColor('#7f8c8d')
            .text(`(${edu.years || 'N/A'})`, 60)
            .moveDown(0.5);
        }
      });
    });
  } else {
    addSection('Education', () => {
      doc.fontSize(12).text('No education details provided.');
    });
  }

  if (Array.isArray(answers.skills) && answers.skills.length > 0) {
    addSection('Skills', () => {
      const skills = answers.skills.filter((s) => s && s.trim().length > 0);
      if (skills.length > 0) {
        const midPoint = Math.ceil(skills.length / 2);
        const leftSkills = skills.slice(0, midPoint);
        const rightSkills = skills.slice(midPoint);

        doc.font('Helvetica')
          .fontSize(11)
          .fillColor(textColor);

        leftSkills.forEach((skill) => {
          doc.text(`• ${skill.trim()}`, 60, doc.y, { continued: true })
            .fillColor(accentColor)
            .text('•', 60, doc.y, { continued: false })
            .moveDown(0.3);
        });

        let rightY = doc.y - (leftSkills.length * 15);
        rightSkills.forEach((skill) => {
          doc.text(`• ${skill.trim()}`, 300, rightY, { continued: true })
            .fillColor(accentColor)
            .text('•', 300, rightY, { continued: false });
          rightY += 15;
        });

        doc.y = Math.max(doc.y, rightY);
      }
    });
  } else {
    addSection('Skills', () => {
      doc.fontSize(12).text('No skills provided.');
    });
  }

  if (Array.isArray(answers.certifications) && answers.certifications.length > 0) {
    addSection('Certifications', () => {
      answers.certifications.forEach((cert) => {
        if (cert.name) {
          const certText = `${cert.name.trim()} - ${cert.organization || 'N/A'}${cert.link ? ` (${cert.link.trim()})` : ''}`;
          doc.font('Helvetica')
            .fontSize(11)
            .fillColor(textColor)
            .text(`• ${certText}`, 60, doc.y, { continued: true })
            .fillColor(accentColor)
            .text('•', 60, doc.y, { continued: false })
            .moveDown(0.3);
        }
      });
    });
  } else {
    addSection('Certifications', () => {
      doc.fontSize(12).text('No certifications provided.');
    });
  }

  if (Array.isArray(answers.projects) && answers.projects.length > 0) {
    addSection('Projects', () => {
      answers.projects.forEach((proj) => {
        if (proj.title) {
          doc.font('Helvetica-Bold')
            .fontSize(12)
            .fillColor(textColor)
            .text(proj.title.trim(), 60)
            .moveDown(0.2);
          if (proj.technologies) {
            doc.font('Helvetica')
              .fontSize(10)
              .fillColor('#7f8c8d')
              .text(`Technologies: ${proj.technologies.trim()}`, 80)
              .moveDown(0.2);
          }
          if (proj.description) {
            doc.font('Helvetica')
              .fontSize(10)
              .fillColor(textColor)
              .text(proj.description.trim(), 80, doc.y, { align: 'justify' })
              .moveDown(0.2);
          }
          if (proj.link) {
            doc.fontSize(9)
              .fillColor(secondaryColor)
              .text(`Link: ${proj.link.trim()}`, 80, doc.y, { link: proj.link.trim(), underline: true })
              .moveDown(0.3);
          }
        }
      });
    });
  } else {
    addSection('Projects', () => {
      doc.fontSize(12).text('No projects provided.');
    });
  }

  if (Array.isArray(answers.milestones) && answers.milestones.length > 0) {
    addSection('Milestones', () => {
      answers.milestones.forEach((milestone) => {
        if (milestone.achievement) {
          doc.font('Helvetica')
            .fontSize(11)
            .fillColor(textColor)
            .text(`• ${milestone.achievement.trim()}`, 60, doc.y, { continued: true })
            .fillColor(accentColor)
            .text('•', 60, doc.y, { continued: false })
            .moveDown(0.2);
          doc.font('Helvetica')
            .fontSize(9)
            .fillColor('#7f8c8d')
            .text(`(${milestone.date || 'N/A'})`, 80)
            .moveDown(0.3);
        }
      });
    });
  } else {
    addSection('Milestones', () => {
      doc.fontSize(12).text('No milestones provided.');
    });
  }

  if (Array.isArray(answers.strengths) && answers.strengths.length > 0) {
    addSection('Strengths', () => {
      const strengths = answers.strengths.filter((s) => s && s.trim().length > 0);
      if (strengths.length > 0) {
        const midPoint = Math.ceil(strengths.length / 2);
        const leftStrengths = strengths.slice(0, midPoint);
        const rightStrengths = strengths.slice(midPoint);

        doc.font('Helvetica')
          .fontSize(11)
          .fillColor(textColor);

        leftStrengths.forEach((strength) => {
          doc.text(`• ${strength.trim()}`, 60, doc.y, { continued: true })
            .fillColor(accentColor)
            .text('•', 60, doc.y, { continued: false })
            .moveDown(0.3);
        });

        let rightY = doc.y - (leftStrengths.length * 15);
        rightStrengths.forEach((strength) => {
          doc.text(`• ${strength.trim()}`, 300, rightY, { continued: true })
            .fillColor(accentColor)
            .text('•', 300, rightY, { continued: false });
          rightY += 15;
        });

        doc.y = Math.max(doc.y, rightY);
      }
    });
  } else {
    addSection('Strengths', () => {
      doc.fontSize(12).text('No strengths provided.');
    });
  }

  doc.fontSize(8)
    .fillColor('#7f8c8d')
    .text('Generated by Question Generator App', 40, doc.page.height - 50, { align: 'center' });

  doc.end();
});

module.exports = router;