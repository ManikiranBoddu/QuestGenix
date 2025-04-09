import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Home({ token }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [image, setImage] = useState(null);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const isImage = selectedFile.type.startsWith('image/');
      if (isImage) {
        setImage(selectedFile);
        setText('');
        setFile(null);
      } else {
        setFile(selectedFile);
        setText('');
        setImage(null);
      }
    }
  };

  const handleCheckbox = (e) => {
    const value = e.target.value;
    setQuestionTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    if (!text && !file && !image) {
      setModalMessage('Please enter text, upload a file, or upload an image.');
      setModalIsOpen(true);
      return;
    }
    if (questionTypes.length === 0) {
      setModalMessage('Please select at least one question type.');
      setModalIsOpen(true);
      return;
    }

    setIsGenerating(true);

    try {
      let extractedText = text;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('http://localhost:5000/api/upload-file', formData, {
          headers: { Authorization: token, 'Content-Type': 'multipart/form-data' },
        });
        extractedText = res.data.text;
      } else if (image) {
        const formData = new FormData();
        formData.append('image', image);
        const res = await axios.post('http://localhost:5000/api/upload-image', formData, {
          headers: { Authorization: token, 'Content-Type': 'multipart/form-data' },
        });
        extractedText = res.data.text;
      }

      if (!extractedText) {
        throw new Error('No text available to generate questions');
      }

      console.log('Sending generate request with text:', extractedText, 'and questionTypes:', questionTypes);
      const generateRes = await axios.post(
        'http://localhost:5000/api/generate',
        { text: extractedText, questionTypes },
        { headers: { Authorization: token } }
      );
      const generatedQuestions = generateRes.data.questions;

      console.log('Received questions:', generatedQuestions);

      if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('No valid questions generated');
      }

      console.log('Navigating to /questions with state:', { questions: generatedQuestions, text: extractedText });
      navigate('/questions', {
        state: {
          questions: generatedQuestions,
          text: extractedText,
        },
      });
    } catch (err) {
      console.error('Failed to generate or navigate:', err.response?.data?.error || err.message);
      setModalMessage(err.response?.data?.error || 'Failed to generate questions or navigate. Check console for details.');
      setModalIsOpen(true);
      setIsGenerating(false); // Ensure isGenerating is reset on error
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalMessage('');
  };

  return (
    <div className="home">
      <h1>Question Generator</h1>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text here..."
        rows="10"
        cols="50"
        disabled={file !== null || image !== null || isGenerating}
      />
      <p>OR</p>
      <input
        type="file"
        accept=".pdf,.docx,.txt,image/*"
        onChange={handleFileChange}
        disabled={text.length > 0 || isGenerating}
      />
      <div className="question-types">
        <label>
          <input type="checkbox" value="mcq" onChange={handleCheckbox} disabled={isGenerating} /> MCQs
        </label>
        <label>
          <input type="checkbox" value="fill_in_the_blanks" onChange={handleCheckbox} disabled={isGenerating} /> Fill in the Blanks
        </label>
        <label>
          <input type="checkbox" value="descriptive" onChange={handleCheckbox} disabled={isGenerating} /> Descriptive
        </label>
        <label>
          <input type="checkbox" value="msq" onChange={handleCheckbox} disabled={isGenerating} /> MSQs
        </label>
      </div>
      <button
        onClick={handleGenerate}
        disabled={(!text && !file && !image) || questionTypes.length === 0 || isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Questions'}
      </button>
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

export default Home;