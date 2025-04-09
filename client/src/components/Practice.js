import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import { Howl } from 'howler';

Modal.setAppElement('#root');

function Practice({ token }) {
  const { pubId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [domain, setDomain] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(null);
  const [total, setTotal] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [quizName, setQuizName] = useState('');

  const sound = new Howl({
    src: ['/path/to/click-sound.mp3'],
    volume: 0.5,
  });

  useEffect(() => {
    if (state && state.questions && state.text && state.domain) {
      setGeneratedQuestions(state.questions);
      setText(state.text);
      setDomain(state.domain);
    } else {
      setModalMessage('No questions or text provided. Please try again from the Publications page.');
      setModalIsOpen(true);
    }
  }, [state]);

  const handleChange = (question, value, isChecked) => {
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

  const handleSubmitAnswers = async () => {
    if (generatedQuestions.length === 0) {
      setModalMessage('No questions available to submit.');
      setModalIsOpen(true);
      return;
    }
    sound.play();
    try {
      console.log('Submitting answers:', answers);
      const res = await axios.post(
        'http://localhost:5000/api/submit',
        { answers, questions: generatedQuestions },
        { headers: { Authorization: token } }
      );
      console.log('Submission feedback:', res.data.feedback);
      setFeedback(res.data.feedback);
      setScore(res.data.score);
      setTotal(res.data.total);
      setModalMessage(`Score: ${res.data.score}/${res.data.total}`);
      setModalIsOpen(true);

      await axios.post(
        'http://localhost:5000/api/submit-publication-attempt',
        { publicationId: pubId, score: res.data.score, total: res.data.total, feedback: res.data.feedback, answers },
        { headers: { Authorization: token } }
      );
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to submit assignment';
      console.error('Submission error:', errorMsg);
      setModalMessage(`Error: ${errorMsg}`);
      setModalIsOpen(true);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizName.trim()) {
      setModalMessage('Please enter a quiz name.');
      setModalIsOpen(true);
      return;
    }
    if (generatedQuestions.length === 0) {
      setModalMessage('No questions available to create a quiz.');
      setModalIsOpen(true);
      return;
    }
    sound.play();
    try {
      await axios.post(
        'http://localhost:5000/api/create-quiz',
        { quizName, questions: generatedQuestions },
        { headers: { Authorization: token } }
      );
      setModalMessage('Quiz created successfully!');
      setModalIsOpen(true);
      setQuizName('');
      navigate('/my-quizzes');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create quiz';
      console.error('Quiz creation error:', errorMsg);
      setModalMessage(`Error: ${errorMsg}`);
      setModalIsOpen(true);
    }
  };

  const handlePublish = async () => {
    if (!domain) {
      setModalMessage('No domain available for this publication');
      setModalIsOpen(true);
      return;
    }
    if (!feedback) {
      setModalMessage('Please submit answers before publishing.');
      setModalIsOpen(true);
      return;
    }
    sound.play();
    try {
      await axios.post(
        'http://localhost:5000/api/publish',
        {
          text,
          questions: generatedQuestions,
          domain,
          answers,
          feedback,
          score,
          total,
        },
        { headers: { Authorization: token } }
      );
      setModalMessage('Publication successful!');
      setModalIsOpen(true);
      navigate('/publications');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Publishing failed';
      console.error('Publishing error:', errorMsg);
      setModalMessage(`Error: ${errorMsg}`);
      setModalIsOpen(true);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalMessage('');
  };

  if (!text) return <p>Loading...</p>;

  return (
    <div className="questions">
      <h1>Practice Assignment</h1>
      <p><strong>Text:</strong> {text}</p>
      {generatedQuestions.length > 0 && !feedback ? (
        <>
          {generatedQuestions.map((q, i) => (
            <div key={i} className="question">
              <p>{q.question}</p>
              {q.type === 'mcq' ? (
                q.options.map((opt, j) => (
                  <label key={j}>
                    <input
                      type="radio"
                      name={q.question}
                      value={opt}
                      onChange={(e) => handleChange(q.question, e.target.value)}
                      checked={answers[q.question] === opt}
                    />
                    {opt}
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
                      checked={(answers[q.question] || []).includes(opt)}
                    />
                    {opt}
                    <br />
                  </label>
                ))
              ) : q.type === 'fill_in_the_blanks' ? (
                <input
                  type="text"
                  value={answers[q.question] || ''}
                  onChange={(e) => handleChange(q.question, e.target.value)}
                />
              ) : (
                <textarea
                  value={answers[q.question] || ''}
                  onChange={(e) => handleChange(q.question, e.target.value)}
                />
              )}
            </div>
          ))}
          <button
            onClick={handleSubmitAnswers}
            disabled={Object.keys(answers).length === 0}
            className="submit-answers-button"
          >
            Submit Answers
          </button>
        </>
      ) : feedback ? (
        <>
          {feedback.map((q, i) => (
            <div key={i} className="question">
              <p>
                {q.question}
                <span className={q.isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                  {q.isCorrect ? '✅' : '❌'}
                </span>
              </p>
              {q.type === 'mcq' ? (
                q.options.map((opt, j) => (
                  <label key={j}>
                    <input
                      type="radio"
                      name={q.question}
                      value={opt}
                      disabled
                      checked={q.userAnswer === opt}
                    />
                    {opt}
                    {q.userAnswer === opt && (
                      <span className={q.isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {q.isCorrect ? '✅' : '❌'}
                      </span>
                    )}
                    {q.userAnswer === opt && !q.isCorrect && (
                      <span className="correct-answer">
                        {' (Correct: ' + q.correctAnswer + ')'}
                      </span>
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
                      disabled
                      checked={(q.userAnswer || '').split(', ').includes(opt)}
                    />
                    {opt}
                    {(q.userAnswer || '').split(', ').includes(opt) && (
                      <span className={q.isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {q.isCorrect ? '✅' : '❌'}
                      </span>
                    )}
                    {(q.userAnswer || '').split(', ').includes(opt) && !q.isCorrect && (
                      <span className="correct-answer">
                        {' (Correct: ' + q.correctAnswer + ')'}
                      </span>
                    )}
                    <br />
                  </label>
                ))
              ) : q.type === 'fill_in_the_blanks' ? (
                <div>
                  <input type="text" value={q.userAnswer || ''} disabled />
                  {!q.isCorrect && q.correctAnswer && (
                    <p className="feedback-wrong">
                      Your answer: "{q.userAnswer}" ❌ (Correct: "{q.correctAnswer}")
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <textarea value={q.userAnswer || ''} disabled />
                  {!q.isCorrect && q.correctAnswer && (
                    <p className="feedback-wrong">
                      Your answer: "{q.userAnswer}" ❌ (Correct: "{q.correctAnswer}")
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="publish-section">
            <select value={domain} disabled>
              <option value={domain}>{domain}</option>
            </select>
            <button onClick={handlePublish}>Publish</button>
          </div>
          <div className="create-quiz-section">
            <input
              type="text"
              value={quizName}
              onChange={(e) => setQuizName(e.target.value)}
              placeholder="Enter quiz name"
            />
            <button onClick={handleCreateQuiz}>Create Quiz</button>
          </div>
          <p className="final-score">
            Final Score: {score}/{total}
          </p>
        </>
      ) : (
        <p>No questions available. Please try again.</p>
      )}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
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
            animation: 'fadeIn 0.8s ease-in-out',
          },
        }}
      >
        <h2>{modalMessage.includes('success') || modalMessage.includes('Error') || modalMessage.includes('Score') ? 'Notice' : 'Success'}</h2>
        <p>{modalMessage}</p>
        <button onClick={closeModal} className="modal-button">
          Close
        </button>
      </Modal>
    </div>
  );
}

export default Practice;