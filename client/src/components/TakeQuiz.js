import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function TakeQuiz({ token }) {
  const { quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!token) return navigate('/login');
      setLoading(true);
      try {
        const response = await axios.get(`http://localhost:5000/api/take-quiz/${quizId}`, {
          headers: { Authorization: token },
        });
        console.log('Fetched quiz data:', response.data); // Debug log
        setQuiz(response.data);
      } catch (err) {
        setError('Failed to fetch quiz: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId, token, navigate]);

  const handleAnswerChange = (question, value, isChecked) => {
    setAnswers((prev) => {
      if (isChecked !== undefined) {
        const currentAnswers = prev[question] || [];
        if (isChecked) {
          return { ...prev, [question]: [...currentAnswers, value] };
        } else {
          return { ...prev, [question]: currentAnswers.filter((ans) => ans !== value) };
        }
      } else {
        return { ...prev, [question]: value };
      }
    });
  };

  const handleSubmitQuiz = async () => {
    if (!token) return navigate('/login');
    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:5000/api/submit-quiz',
        { quizId, answers },
        { headers: { Authorization: token } }
      );
      setResults(response.data);
    } catch (err) {
      setError('Failed to submit quiz: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setResults(null);
  };

  if (loading) return <p className="loading">Loading quiz...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!quiz || !quiz.questions) return <p>Quiz not found or no questions available.</p>;

  return (
    <div className="practice">
      <h1>{quiz.quizName || 'Untitled Quiz'}</h1>
      {results ? (
        <div>
          <h2>Quiz Results</h2>
          <p>
            <strong>Score:</strong> {results.score} out of {results.total}
          </p>
          <p>{results.message}</p>
          {results.feedback && results.feedback.length > 0 && (
            <div>
              <h3>Feedback:</h3>
              {results.feedback.map((fb, index) => (
                <div key={index} className="feedback-item">
                  <p>
                    <strong>Question {index + 1}:</strong> {fb.question}
                  </p>
                  <p>
                    <strong>Your Answer:</strong> {fb.userAnswer || 'Not answered'}
                    {fb.isCorrect ? (
                      <span style={{ color: 'green', marginLeft: '10px' }}>✓ Correct</span>
                    ) : (
                      <span style={{ color: 'red', marginLeft: '10px' }}>
                        ✗ Wrong{' '}
                        <span style={{ color: 'black' }}>(Correct: {fb.correctAnswer})</span>
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleRestart}>Retake Quiz</button>
          <button onClick={() => navigate('/my-quizzes')}>Back to My Quizzes</button>
        </div>
      ) : (
        <div>
          {quiz.questions.map((question, index) => (
            <div key={index} className="question">
              <p>
                <strong>Question {index + 1}:</strong> {question.question}
              </p>
              {question.type === 'mcq' ? (
                <div>
                  {question.options.map((option, optIndex) => (
                    <label key={optIndex} style={{ display: 'block', marginBottom: '5px' }}>
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option}
                        checked={answers[question.question] === option}
                        onChange={(e) => handleAnswerChange(question.question, e.target.value)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : question.type === 'msq' ? (
                <div>
                  {question.options.map((option, optIndex) => (
                    <label key={optIndex} style={{ display: 'block', marginBottom: '5px' }}>
                      <input
                        type="checkbox"
                        value={option}
                        checked={(answers[question.question] || []).includes(option)}
                        onChange={(e) => handleAnswerChange(question.question, option, e.target.checked)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : question.type === 'fill_in_the_blanks' ? (
                <input
                  type="text"
                  value={answers[question.question] || ''}
                  onChange={(e) => handleAnswerChange(question.question, e.target.value)}
                  placeholder="Your answer"
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              ) : (
                <textarea
                  value={answers[question.question] || ''}
                  onChange={(e) => handleAnswerChange(question.question, e.target.value)}
                  placeholder="Your answer"
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              )}
            </div>
          ))}
          <button onClick={handleSubmitQuiz} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      )}
    </div>
  );
}

export default TakeQuiz;