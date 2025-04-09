import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function MyQuizzes({ token }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!token) return navigate('/login');
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/api/quizzes', {
          headers: { Authorization: token },
        });
        console.log('Fetched quizzes:', response.data);
        setQuizzes(response.data);
      } catch (err) {
        setError('Failed to fetch quizzes: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, [token, navigate]);

  const handleTakeQuiz = (quizId) => {
    navigate(`/take-quiz/${quizId}`);
  };

  return (
    <div className="questions">
      <h1>My Quizzes</h1>
      {loading && <p className="loading">Loading quizzes...</p>}
      {error && <p className="error-message">{error}</p>}
      {quizzes.length === 0 && !loading && !error && <p>No quizzes found. Create a quiz from the Questions page!</p>}
      {quizzes.length > 0 && (
        <div>
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="publication-card">
              <p>
                <strong>Quiz Name:</strong> {quiz.quiz_name || quiz.quizName || 'Untitled Quiz'}
              </p>
              <button className="practice-button" onClick={() => handleTakeQuiz(quiz.id)}>
                Take Quiz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyQuizzes;