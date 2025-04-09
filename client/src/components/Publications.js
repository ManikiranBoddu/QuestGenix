import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Publications({ token }) {
  const [publications, setPublications] = useState([]);
  const [domainFilter, setDomainFilter] = useState('');
  const [domains, setDomains] = useState(['All']);
  const [expandedPub, setExpandedPub] = useState(null);
  const [attempts, setAttempts] = useState({});
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [savedPubs, setSavedPubs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/domains', {
          headers: { Authorization: token },
        });
        setDomains(['All', ...res.data.sort()]);
      } catch (err) {
        console.error('Failed to fetch domains:', err.response?.data?.error || err.message);
      }
    };

    const fetchPublications = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/publications', {
          headers: { Authorization: token },
          params: { domain: domainFilter || undefined },
        });
        setPublications(res.data);
        await fetchAttempts();
        await fetchLikes();
        await fetchComments();
        await fetchSavedPublications();
      } catch (err) {
        console.error('Failed to fetch publications:', err.response?.data?.error || err.message);
      }
    };

    if (token) {
      fetchDomains();
      fetchPublications();
    }
  }, [token, domainFilter]);

  const fetchAttempts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/publication-attempts', {
        headers: { Authorization: token },
      });
      const attemptsByPub = res.data.reduce((acc, attempt) => {
        acc[attempt.publicationId] = attempt;
        return acc;
      }, {});
      setAttempts(attemptsByPub);
    } catch (err) {
      console.error('Failed to fetch attempts:', err.message);
    }
  };

  const fetchLikes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/likes', {
        headers: { Authorization: token },
      });
      setLikes(res.data);
    } catch (err) {
      console.error('Failed to fetch likes:', err.message);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/comments', {
        headers: { Authorization: token },
      });
      const commentsByPub = res.data.reduce((acc, comment) => {
        if (!acc[comment.publicationId]) acc[comment.publicationId] = [];
        acc[comment.publicationId].push(comment);
        return acc;
      }, {});
      setComments(commentsByPub);
    } catch (err) {
      console.error('Failed to fetch comments:', err.message);
    }
  };

  const fetchSavedPublications = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/saved-publications', {
        headers: { Authorization: token },
      });
      setSavedPubs(res.data.map((pub) => pub.id));
    } catch (err) {
      console.error('Failed to fetch saved publications:', err.message);
    }
  };

  const toggleExpand = (pubId) => {
    setExpandedPub(expandedPub === pubId ? null : pubId);
  };

  const handleLike = async (pubId) => {
    try {
      await axios.post('http://localhost:5000/api/like', { publicationId: pubId }, {
        headers: { Authorization: token },
      });
      fetchLikes();
    } catch (err) {
      console.error('Failed to like:', err.message);
    }
  };

  const handleDownload = async (pubId, text) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/download-publication/${pubId}`, {
        headers: { Authorization: token },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `publication_${pubId}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err.message);
    }
  };

  const handleCommentSubmit = async (pubId) => {
    if (!newComment.trim()) return;
    try {
      await axios.post('http://localhost:5000/api/comment', { publicationId: pubId, text: newComment }, {
        headers: { Authorization: token },
      });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Failed to comment:', err.message);
    }
  };

  const handleShare = async (pubId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/share-publication/${pubId}`, {
        headers: { Authorization: token },
      });
      navigator.clipboard.writeText(res.data.shareLink);
      alert('Share link copied to clipboard!');
    } catch (err) {
      console.error('Failed to share:', err.message);
    }
  };

  const handleSave = async (pubId) => {
    try {
      await axios.post('http://localhost:5000/api/save-publication', { publicationId: pubId }, {
        headers: { Authorization: token },
      });
      fetchSavedPublications();
    } catch (err) {
      console.error('Failed to save:', err.message);
    }
  };

  const handlePractice = async (publication) => {
    try {
      // Default question types for practice (you can make this configurable if needed)
      const questionTypes = ['mcq', 'fill_in_the_blanks', 'descriptive', 'msq'];

      // Generate new questions using the publication's text
      const generateRes = await axios.post(
        'http://localhost:5000/api/generate',
        { text: publication.text, questionTypes },
        { headers: { Authorization: token } }
      );
      const generatedQuestions = generateRes.data.questions;

      if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('No valid questions generated');
      }

      // Navigate to the practice route with the generated questions and publication ID
      navigate(`/practice/${publication.id}`, {
        state: {
          questions: generatedQuestions,
          text: publication.text,
          domain: publication.domain, // Pass the domain for publishing
        },
      });
    } catch (err) {
      console.error('Failed to generate questions for practice:', err.response?.data?.error || err.message);
      alert(err.response?.data?.error || 'Failed to generate questions for practice.');
    }
  };

  const handleRetake = (pubId, questions, text) => {
    navigate(`/questions/${pubId}`, { state: { questions: JSON.parse(questions) || [], text, retake: true } });
  };

  const tryParseJSON = (jsonString) => {
    if (jsonString === undefined || jsonString === null || typeof jsonString !== 'string') {
      return [];
    }
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse JSON:', jsonString, error);
      return [];
    }
  };

  return (
    <div className="publications">
      <h1>PUBLICATIONS</h1>
      <div className="filter">
        <label>Filter by Domain: </label>
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
          {domains.map((domain, index) => (
            <option key={index} value={domain === 'All' ? '' : domain}>{domain}</option>
          ))}
        </select>
      </div>
      {publications.length === 0 ? (
        <p style={{ color: 'blue' }}>Loading...</p>
      ) : (
        <>
          {savedPubs.length > 0 && (
            <div className="saved-publications">
              <h2>Saved Publications</h2>
              {savedPubs.map((pubId) =>
                publications.find((pub) => pub.id === pubId) && (
                  <div key={pubId} className="publication-card">
                    <p><strong>User:</strong> {publications.find((pub) => pub.id === pubId).username}</p>
                    <p><strong>Domain:</strong> {publications.find((pub) => pub.id === pubId).domain}</p>
                    <p><strong>Text:</strong> {publications.find((pub) => pub.id === pubId).text.substring(0, 100) + (publications.find((pub) => pub.id === pubId).text.length > 100 ? '...' : '')}</p>
                    <button onClick={() => toggleExpand(pubId)} className="view-questions">
                      {expandedPub === pubId ? 'Close' : 'View Results'}
                    </button>
                    {expandedPub === pubId && (
                      <div className="publication-expanded">
                        <h3>Results:</h3>
                        {renderResults(publications.find((pub) => pub.id === pubId))}
                        <button onClick={() => handlePractice(publications.find((pub) => pub.id === pubId))} className="practice-button">
                          Practice
                        </button>
                        <button onClick={() => toggleExpand(null)} className="close-view">Close</button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
          {publications.map((pub) => (
            <div key={pub.id} className="publication-card">
              {!expandedPub || expandedPub !== pub.id ? (
                <>
                  <p><strong>User:</strong> {pub.username}</p>
                  <p><strong>Domain:</strong> {pub.domain}</p>
                  <p><strong>Text:</strong> {pub.text.substring(0, 100) + (pub.text.length > 100 ? '...' : '')}</p>
                  {pub.score !== undefined && pub.total !== undefined && (
                    <p><strong>Score:</strong> {pub.score}/{pub.total}</p>
                  )}
                  <button onClick={() => toggleExpand(pub.id)} className="view-questions">
                    View Results
                  </button>
                  <button onClick={() => handleLike(pub.id)} className="like-button">
                    Like {likes[pub.id]?.count || 0} {likes[pub.id]?.userLiked ? '❤️' : '🤍'}
                  </button>
                  <button onClick={() => handleDownload(pub.id, pub.text)} className="download-button">
                    Download
                  </button>
                  <button onClick={() => handleShare(pub.id)} className="share-button">
                    Share
                  </button>
                  <button onClick={() => handleSave(pub.id)} className="save-button">
                    {savedPubs.includes(pub.id) ? 'Unsave' : 'Save'}
                  </button>
                </>
              ) : (
                <div className="publication-expanded">
                  <p><strong>User:</strong> {pub.username}</p>
                  <p><strong>Domain:</strong> {pub.domain}</p>
                  <p><strong>Text:</strong> {pub.text}</p>
                  <h3>Results:</h3>
                  {renderResults(pub)}
                  <button onClick={() => handlePractice(pub)} className="practice-button">
                    Practice
                  </button>
                  <button onClick={() => toggleExpand(null)} className="close-view">Close</button>
                </div>
              )}
              <hr />
            </div>
          ))}
        </>
      )}
    </div>
  );

  function renderResults(pub) {
    const questions = tryParseJSON(pub.questions);
    const answers = pub.answers ? JSON.parse(pub.answers) : {};
    const feedback = tryParseJSON(pub.feedback);

    if (!questions || questions.length === 0) {
      return <p>No results available. Questions may not have been stored correctly.</p>;
    }

    return (
      <>
        <p><strong>Score:</strong> {pub.score}/{pub.total}</p>
        {questions.map((q, i) => (
          <div key={i} className="published-question">
            <p>
              <strong>{i + 1}. {q.question}</strong>
              {feedback[i] && (
                <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                  {feedback[i].isCorrect ? ' ✅' : ' ❌'}
                </span>
              )}
            </p>
            {q.type === 'mcq' && (
              <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                {q.options.map((opt, j) => (
                  <li key={j}>
                    {opt}
                    {answers[q.question] === opt && (
                      <span className={feedback[i]?.isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {feedback[i]?.isCorrect ? ' (Right Answer ✅)' : ' (Wrong Answer ❌)'}
                      </span>
                    )}
                    {answers[q.question] === opt && !feedback[i]?.isCorrect && (
                      <span className="correct-answer"> (Correct: {q.answer})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {q.type === 'msq' && (
              <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                {q.options.map((opt, j) => (
                  <li key={j}>
                    {opt}
                    {(answers[q.question] || []).includes(opt) && (
                      <span className={feedback[i]?.isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                        {feedback[i]?.isCorrect ? ' (Your Answer ✅)' : ' (Your Answer ❌)'}
                      </span>
                    )}
                    {(answers[q.question] || []).includes(opt) && !feedback[i]?.isCorrect && (
                      <span className="correct-answer"> (Correct: {q.answer.join(', ')})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {q.type === 'fill_in_the_blanks' && (
              <p>
                Your Answer: {answers[q.question] || 'Not answered'}
                {feedback[i] && (
                  <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                    {feedback[i].isCorrect ? ' ✅' : ' ❌'}
                  </span>
                )}
                {feedback[i] && !feedback[i].isCorrect && (
                  <span className="correct-answer"> (Correct: {q.answer})</span>
                )}
              </p>
            )}
            {q.type === 'descriptive' && (
              <p>
                Your Answer: {answers[q.question] || 'Not answered'}
                {feedback[i] && (
                  <span className={feedback[i].isCorrect ? 'feedback-correct' : 'feedback-wrong'}>
                    {feedback[i].isCorrect ? ' ✅' : ' ❌'}
                  </span>
                )}
                {feedback[i] && !feedback[i].isCorrect && feedback[i].correctAnswer && (
                  <span className="correct-answer"> (Expected: {feedback[i].correctAnswer})</span>
                )}
              </p>
            )}
          </div>
        ))}
      </>
    );
  }
}

export default Publications;