import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Questions({ token }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pubId } = useParams();
  const { questions: initialQuestions, text, isGenerating: initialGenerating = false, answers: initialAnswers, feedback: initialFeedback, viewOnly = false } = location.state || {};
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback || null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [quizName, setQuizName] = useState('');
  const [isLoading, setIsLoading] = useState(initialGenerating);
  const [questions, setQuestions] = useState(initialQuestions || []);

  useEffect(() => {
    const fetchData = async () => {
      if (pubId && !initialQuestions) {
        try {
          const pubRes = await axios.get(`http://localhost:5000/api/publications/${pubId}`, {
            headers: { Authorization: token },
          });
          setQuestions(pubRes.data.questions ? JSON.parse(pubRes.data.questions) : []);
          setDomain(pubRes.data.domain || '');

          const attemptRes = await axios.get(`http://localhost:5000/api/publication-attempts/${pubId}`, {
            headers: { Authorization: token },
          });
          if (attemptRes.data && attemptRes.data.feedback) {
            setAnswers(attemptRes.data.answers ? JSON.parse(attemptRes.data.answers) : {});
            setFeedback(JSON.parse(attemptRes.data.feedback));
          }
        } catch (err) {
          console.error('Error fetching data:', err);
          setModalMessage('Failed to load publication or attempt data');
          setModalIsOpen(true);
        }
      } else if (initialQuestions && isLoading) {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
      }
    };

    fetchData();
  }, [pubId, initialQuestions, isLoading, token]);

  const handleChange = (question, value, isChecked) => {
    setAnswers((prev) => {
      if (isChecked !== undefined) {
        const currentAnswers = Array.isArray(prev[question]) ? prev[question] : [];
        return {
          ...prev,
          [question]: isChecked ? [...currentAnswers, value] : currentAnswers.filter((ans) => ans !== value),
        };
      } else {
        return { ...prev, [question]: value };
      }
    });
  };

  const handleQuestionSelect = (index) => {
    setSelectedQuestions((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSubmit = async () => {
    if (!questions || questions.length === 0) {
      setModalMessage('No questions available to submit');
      setModalIsOpen(true);
      return;
    }

    try {
      const formattedAnswers = {};
      questions.forEach((q) => {
        const answer = answers[q.question] || (q.type === 'msq' ? [] : '');
        formattedAnswers[q.question] = answer;
      });

      const res = await axios.post(
        'http://localhost:5000/api/submit',
        { answers: formattedAnswers, questions },
        { headers: { Authorization: token }
      });

      const { feedback: submitFeedback, score, total } = res.data;
      setFeedback(submitFeedback);
      setModalMessage(`Score: ${score}/${total}`);
      setModalIsOpen(true);

      await axios.post(
        'http://localhost:5000/api/submit-publication-attempt',
        { publicationId: pubId, score, total, feedback: submitFeedback, answers: formattedAnswers },
        { headers: { Authorization: token } }
      );
    } catch (err) {
      console.error('Submission error:', err.response?.data || err.message);
      setModalMessage(err.response?.data?.error || 'Submission failed');
      setModalIsOpen(true);
    }
  };

  const handlePublish = async () => {
    const finalDomain = customDomain.trim() || domain;
    if (!finalDomain) {
      setModalMessage('Please select or add a domain');
      setModalIsOpen(true);
      return;
    }
    if (!text || !questions || questions.length === 0) {
      setModalMessage('No text or questions available to publish');
      setModalIsOpen(true);
      return;
    }

    try {
      console.log('Publishing with questions:', questions);
      const publishData = {
        text,
        questions,
        domain: finalDomain,
        answers: answers || {},
        feedback: feedback || [],
        score: feedback ? feedback.filter((f) => f.isCorrect).length : 0,
        total: questions.length,
      };

      await axios.post('http://localhost:5000/api/publish', publishData, {
        headers: { Authorization: token },
      });
      setModalMessage('Published successfully!');
      setModalIsOpen(true);
      setTimeout(() => navigate('/publications'), 1000);
    } catch (err) {
      console.error('Publishing error:', err.response?.data || err.message);
      setModalMessage(err.response?.data?.error || 'Publishing failed');
      setModalIsOpen(true);
    }
  };

  const handleCreateQuiz = async () => {
    if (selectedQuestions.length === 0) {
      setModalMessage('Please select at least one question to create a quiz.');
      setModalIsOpen(true);
      return;
    }
    if (!quizName.trim()) {
      setModalMessage('Please enter a quiz name.');
      setModalIsOpen(true);
      return;
    }
    const quizQuestions = selectedQuestions.map((index) => questions[index]);
    try {
      await axios.post(
        'http://localhost:5000/api/create-quiz',
        { quizName, questions: quizQuestions },
        { headers: { Authorization: token } }
      );
      setModalMessage('Quiz created successfully!');
      setModalIsOpen(true);
      setQuizName('');
      setSelectedQuestions([]);
    } catch (error) {
      setModalMessage('Failed to create quiz.');
      setModalIsOpen(true);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalMessage('');
  };

  if (!questions) {
    return (
      <div className="questions">
        {isLoading ? (
          <div className="generating-message" style={{ textAlign: 'center', marginTop: '20px' }}>
            <h2>Generating...</h2>
            <p>Please wait while we generate your questions.</p>
          </div>
        ) : (
          <p>No questions available</p>
        )}
      </div>
    );
  }

  return (
    <div className="questions">
      {isLoading ? (
        <div className="generating-message" style={{ textAlign: 'center', marginTop: '20px' }}>
          <h2>Generating...</h2>
          <p>Please wait while we generate your questions.</p>
        </div>
      ) : (
        <>
          <h1>{viewOnly ? 'Published Results' : 'Generated Questions'}</h1>
          {questions.map((q, i) => (
            <div key={i} className="question">
              {!viewOnly && (
                <label>
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(i)}
                    onChange={() => handleQuestionSelect(i)}
                    disabled={feedback !== null}
                  />
                  Select for Quiz
                </label>
              )}
              <p>
                {q.question}
                {feedback && feedback[i] && (
                  <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                    {feedback[i].isCorrect ? '✅' : '❌'}
                  </span>
                )}
              </p>
              {q.type === 'mcq' ? (
                q.options.map((opt, j) => (
                  <label key={j}>
                    <input
                      type="radio"
                      name={q.question}
                      value={opt}
                      onChange={(e) => handleChange(q.question, e.target.value)}
                      disabled={feedback !== null || viewOnly}
                      checked={answers[q.question] === opt}
                    />
                    {opt}
                    {feedback && feedback[i] && answers[q.question] === opt && (
                      <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {feedback[i].isCorrect ? ' (Your Answer ✅)' : ' (Your Answer ❌)'}
                      </span>
                    )}
                    {feedback && feedback[i] && !feedback[i].isCorrect && answers[q.question] === opt && (
                      <span className="correct-answer"> (Correct: {feedback[i].correctAnswer})</span>
                    )}
                    <br />
                  </label>
                ))
              ) : q.type === 'msq' ? (
                q.options.map((opt, j) => (
                  <label key={j} style={{ display: 'block', marginBottom: '5px' }}>
                    <input
                      type="checkbox"
                      value={opt}
                      onChange={(e) => handleChange(q.question, opt, e.target.checked)}
                      disabled={feedback !== null || viewOnly}
                      checked={(answers[q.question] || []).includes(opt)}
                    />
                    {opt}
                    {feedback && feedback[i] && (answers[q.question] || []).includes(opt) && (
                      <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {feedback[i].isCorrect ? ' (Your Answer ✅)' : ' (Your Answer ❌)'}
                      </span>
                    )}
                    {feedback && feedback[i] && !feedback[i].isCorrect && (answers[q.question] || []).includes(opt) && (
                      <span className="correct-answer"> (Correct: {feedback[i].correctAnswer.join(', ')})</span>
                    )}
                    <br />
                  </label>
                ))
              ) : q.type === 'fill_in_the_blanks' ? (
                <>
                  <input
                    type="text"
                    value={answers[q.question] || ''}
                    onChange={(e) => handleChange(q.question, e.target.value)}
                    disabled={feedback !== null || viewOnly}
                  />
                  {feedback && feedback[i] && (
                    <p className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                      Your answer: "{answers[q.question] || 'Not answered'}" {feedback[i].isCorrect ? '✅' : '❌'}
                      {!feedback[i].isCorrect && feedback[i].correctAnswer && (
                        <span> (Correct: "{feedback[i].correctAnswer}")</span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <textarea
                    value={answers[q.question] || ''}
                    onChange={(e) => handleChange(q.question, e.target.value)}
                    disabled={feedback !== null || viewOnly}
                  />
                  {feedback && feedback[i] && (
                    <p className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                      Your answer: "{answers[q.question] || 'Not answered'}" {feedback[i].isCorrect ? '✅' : '❌'}
                      {!feedback[i].isCorrect && feedback[i].correctAnswer && (
                        <span> (Expected: "{feedback[i].correctAnswer}")</span>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
          {!feedback && !viewOnly && (
            <div className="action-buttons" style={{ marginTop: '20px' }}>
              <input
                type="text"
                value={quizName}
                onChange={(e) => setQuizName(e.target.value)}
                placeholder="Enter Quiz Name"
                style={{ marginRight: '10px', padding: '5px', width: '200px' }}
              />
              <button onClick={handleSubmit} style={{ marginRight: '10px' }}>
                Submit Assignment
              </button>
              <button onClick={handleCreateQuiz} style={{ marginRight: '10px' }}>
                Create Quiz
              </button>
            </div>
          )}
          {!viewOnly && (
            <div className="publish-section" style={{ marginTop: '20px' }}>
              <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">Select Domain</option>
                {['Science', 'History', 'Math', 'Literature'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Add Custom Domain"
                style={{ marginRight: '10px', width: '200px' }}
              />
              <button onClick={handlePublish} disabled={!domain && !customDomain}>
                Publish Results
              </button>
            </div>
          )}
          {feedback && (
            <p className="final-score" style={{ marginTop: '20px' }}>
              Final Score: {feedback.filter((f) => f.isCorrect).length}/{feedback.length}
            </p>
          )}
        </>
      )}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={{
          overlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
            background: 'linear-gradient(135deg, #ffffff, #f9f9f9)',
            padding: '20px',
          },
        }}
      >
        <h2>{modalMessage.includes('Error') ? 'Error' : 'Success'}</h2>
        <p>{modalMessage}</p>
        <button onClick={closeModal} className="modal-button">Close</button>
      </Modal>
    </div>
  );
}

export default Questions;