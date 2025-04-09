import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function Account({ token, userData, setUserData, plainPassword }) {
  const [file, setFile] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const BASE_URL = 'http://localhost:5000';

  useEffect(() => {
    // No need to fetch here; use userData from App.js
  }, [token, userData]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setModalMessage('Please select an image to upload.');
      setModalIsOpen(true);
      return;
    }

    const formData = new FormData();
    formData.append('profilePic', file);

    try {
      const res = await axios.post('http://localhost:5000/api/upload-profile-pic', formData, {
        headers: { Authorization: token, 'Content-Type': 'multipart/form-data' },
      });
      const newProfilePic = `${BASE_URL}${res.data.profilePicUrl}`;
      setUserData({ ...userData, profilePic: newProfilePic });
      setModalMessage('Profile picture updated successfully!');
      setModalIsOpen(true);
      setFile(null);
    } catch (err) {
      setModalMessage(err.response?.data?.error || 'Failed to upload profile picture');
      setModalIsOpen(true);
    }
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setModalMessage('');
  };

  // Use plainPassword if available; otherwise, show a placeholder
  const realPassword = plainPassword || 'Not available';

  return (
    <div className="account">
      <h1>Account</h1>
      <div className="profile-section">
        <img
          src={userData.profilePic || 'https://res.cloudinary.com/dzjzfju4l/image/upload/v1741846028/account_image-removebg-preview_gtfhsa.png'}
          alt="Profile"
          className="account-profile-pic"
          onError={(e) => (e.target.src = 'https://res.cloudinary.com/dzjzfju4l/image/upload/v1741846028/account_image-removebg-preview_gtfhsa.png')}
        />
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload}>Edit Profile Picture</button>
      </div>
      <div className="user-info">
        <p><strong>Username:</strong> {userData.username}</p>
        <p>
          <strong>Password:</strong>{' '}
          {showPassword ? realPassword : '********'}
          <button onClick={togglePassword} className="show-password">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </p>
        <p><strong>Email:</strong> {userData.email}</p>
        <p><strong>Account Created:</strong> {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Not available'}</p>
        <p><strong>Last Login:</strong> {userData.lastLogin ? new Date(userData.lastLogin).toLocaleString() : 'Not available'}</p>
      </div>
      <div className="user-stats">
        <h2>Your Stats</h2>
        <p><strong>Total Publications:</strong> {userData.totalPublications}</p>
        <p><strong>Publications by Domain:</strong></p>
        <ul>
          {Object.entries(userData.publicationsByDomain).map(([domain, count]) => (
            <li key={domain}>{domain}: {count}</li>
          ))}
        </ul>
        <p><strong>Total Quizzes:</strong> {userData.totalQuizzes}</p>
        <p><strong>Quiz Names:</strong></p>
        <ul>
          {userData.quizNames.map((name, index) => (
            <li key={index}>{name}</li>
          ))}
        </ul>
        <p><strong>Total Assignments Completed:</strong> {userData.totalAssignments}</p>
        <p><strong>Total Questions Generated:</strong> {userData.totalQuestionsGenerated}</p>
      </div>
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

export default Account;