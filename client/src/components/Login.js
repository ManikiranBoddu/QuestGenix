import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Modal from 'react-modal';

// Set app element for accessibility (required for react-modal)
Modal.setAppElement('#root');

function Login({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token, password); // Pass token and password
      const from = location.state?.from?.pathname || '/'; // Redirect to previous page or home
      navigate(from);
    } catch (err) {
      setModalMessage(err.response?.data?.error || 'Login failed');
      setModalIsOpen(true);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalMessage('');
  };

  return (
    <div className="auth">
      <img
        src="https://res.cloudinary.com/dzjzfju4l/image/upload/v1741774598/required_logo-removebg-preview_fimms3.png"
        alt="QuestGenix Logo"
        className="login-logo"
      />
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px' }}>
        <h1 style={{ fontSize: '22px', marginTop: '15px', marginBottom: '3px', color: '#363737' }}>Sign In</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </div>
          <button type="submit" style={{ borderRadius: '20px', borderWidth: '0px' }}>Sign In</button>
        </form>
      </div>
      <p>
        Don't have an account? <Link to="/register">Create Account</Link>
      </p>
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
        <h2>Error</h2>
        <p>{modalMessage}</p>
        <button onClick={closeModal} className="modal-button">Close</button>
      </Modal>
    </div>
  );
}

export default Login;