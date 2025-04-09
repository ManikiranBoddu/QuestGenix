import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Modal from 'react-modal';

// Set app element for accessibility (required for react-modal)
Modal.setAppElement('#root');

function Register({ setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const navigate = useNavigate();
  const [redirectTimeout, setRedirectTimeout] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setModalMessage('Passwords do not match. Please try again.');
      setModalIsOpen(true);
      return;
    }

    try {
      const res = await axios.post('http://localhost:5000/api/register', { username, password, email });
      const token = res.data.token;
      console.log('Registration successful, token received:', token);
      localStorage.setItem('token', token);
      console.log('Token set in localStorage:', localStorage.getItem('token'));

      // Set token and trigger redirect
      setToken(token, password, () => {
        console.log('Token set in App.js, preparing to redirect');
        setShouldRedirect(true);
        setModalMessage('Registration successful! Redirecting to home...');
        setModalIsOpen(true);
        console.log('Forcing immediate redirect to home...');
        navigate('/', { replace: true });
      });
    } catch (err) {
      console.log('Registration error:', err.response?.data?.error || err.message);
      setModalMessage(err.response?.data?.error || 'Registration failed');
      setModalIsOpen(true);
    }
  };

  useEffect(() => {
    if (shouldRedirect && modalIsOpen) {
      console.log('shouldRedirect and modalIsOpen are true, setting timeout for redirect');
      const timeoutId = setTimeout(() => {
        console.log('Executing redirect to home via timeout...');
        navigate('/', { replace: true });
      }, 2000);
      setRedirectTimeout(timeoutId);
    }
  }, [shouldRedirect, modalIsOpen, navigate]);

  const closeModal = () => {
    console.log('Closing modal...');
    setModalIsOpen(false);
    setModalMessage('');

    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      setRedirectTimeout(null);
    }

    if (modalMessage.includes('successful') && shouldRedirect) {
      console.log('Redirecting to home on modal close...');
      navigate('/', { replace: true });
    }
  };

  useEffect(() => {
    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [redirectTimeout]);

  return (
    <div className="auth">
      <img
        src="https://res.cloudinary.com/dzjzfju4l/image/upload/v1741950576/QuestGenix-removebg-preview_1_s7llgk.png"
        alt="QuestGenix Logo"
        className="login-logo"
      />
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px' }}>
        <h1 style={{ fontSize: '22px', marginTop: '15px', marginBottom: '3px', color: '#363737' }}>Create Account</h1>
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
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
          <div className="form-group">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
            />
          </div>
          <button type="submit" style={{ borderRadius: '20px', borderWidth: '0px' }}>Create Account</button>
        </form>
      </div>
      <p>
        Already have an account? <Link to="/login">Sign In</Link>
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
        <h2>{modalMessage.includes('successful') ? 'Success' : 'Error'}</h2>
        <p>{modalMessage}</p>
        <button onClick={closeModal} className="modal-button">Close</button>
      </Modal>
    </div>
  );
}

export default Register;