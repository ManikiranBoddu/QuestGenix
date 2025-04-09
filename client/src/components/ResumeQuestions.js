import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ResumeQuestions({ token }) {
  const { state } = useLocation();
  const { questions, resumeId } = state || {};
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAnswerChange = (index, value) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const handleSubmit = async () => {
    try {
      setError('');
      const res = await axios.post(
        'http://localhost:5000/api/submit-resume-questions',
        { resumeId, answers: Object.values(answers) },
        { headers: { Authorization: token } }
      );
      setFeedback(res.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to submit answers.');
      console.error('Error:', error);
    }
  };

  const handlePublish = async () => {
    try {
      setError('');
      await axios.post(
        'http://localhost:5000/api/publish-resume',
        { resumeId, domain: 'CareerPrep' },
        { headers: { Authorization: token } }
      );
      navigate('/publications');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to publish.');
      console.error('Error:', error);
    }
  };

  if (!questions || !resumeId) {
    return <div className="questions"><p className="error-message">No questions available. Please generate questions first.</p></div>;
  }

  return (
    <div className="questions">
      <h1>Resume Questions</h1>
      {questions.map((q, index) => (
        <div key={index} className="question">
          <p>{q.question} ({q.type})</p>
          {q.type === 'mcq' ? (
            q.options.map((option, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name={`question-${index}`}
                  value={option}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  disabled={feedback}
                />
                {option}
              </label>
            ))
          ) : (
            <input
              type="text"
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              disabled={feedback}
            />
          )}
          {feedback && feedback.feedback[index] && (
            <>
              {feedback.feedback[index].isCorrect ? (
                <span className="feedback-correct">✔</span>
              ) : (
                <span className="feedback-wrong">✘</span>
              )}
              {!feedback.feedback[index].isCorrect && q.answer && (
                <span className="correct-answer">Correct: {q.answer}</span>
              )}
            </>
          )}
        </div>
      ))}
      {error && <p className="error-message">{error}</p>}
      {feedback ? (
        <p className="success-message">Score: {feedback.score} / {feedback.total}</p>
      ) : (
        <button onClick={handleSubmit}>Submit Answers</button>
      )}
      {feedback && <button onClick={handlePublish}>Publish Results</button>}
    </div>
  );
}

export default ResumeQuestions;