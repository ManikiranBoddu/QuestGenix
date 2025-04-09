import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

function Navbar({ token, setToken, userData, setUserData }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setUserData({
      username: '',
      profilePic: '',
      email: '',
      createdAt: '',
      lastLogin: '',
      totalPublications: 0,
      publicationsByDomain: {},
      totalQuizzes: 0,
      quizNames: [],
      totalAssignments: 0,
      totalQuestionsGenerated: 0,
      password: '',
    });
    navigate('/register');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img
          src="https://res.cloudinary.com/dzjzfju4l/image/upload/v1741950576/QuestGenix-removebg-preview_1_s7llgk.png"
          alt="QuestGenix Logo"
          className="navbar-logo"
        />
        <span className="navbar-title">
          <img src="https://res.cloudinary.com/dzjzfju4l/image/upload/v1741957736/QuestGenix-removebg-preview_2_vgz6lr.png" className='title-logo'/>
        </span>
      </div>
      <ul className="navbar-links">
        <li>
          <Link to="/" className="nav-link">Home</Link>
        </li>
        <li>
          <Link to="/publications" className="nav-link">Publications</Link>
        </li>
        <li>
          <Link to="/resume" className="nav-link">Resume/CV Builder</Link>
        </li>
        <li>
          <Link to="/my-quizzes" className="nav-link">My Quizzes</Link>
        </li>
        {token ? (
          <>
            <li>
              <Link to="/account" className="nav-link profile-pic-link">
                {userData.profilePic ? (
                  <img
                    src={userData.profilePic}
                    alt="Profile"
                    className="nav-profile-pic"
                    onError={(e) => {
                      e.target.src = 'https://res.cloudinary.com/dzjzfju4l/image/upload/v1741846028/account_image-removebg-preview_gtfhsa.png'; // Fallback image
                    }}
                  />
                ) : (
                  <span><img alt="Profile"
                  className="nav-profile-pic" src="https://res.cloudinary.com/dzjzfju4l/image/upload/v1741846028/account_image-removebg-preview_gtfhsa.png"/></span> // Fallback if no profile picture
                )}
              </Link>
            </li>
            <li>
              <button onClick={handleLogout} className="nav-button">Logout</button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" className="nav-link">Login</Link>
            </li>
            <li>
              <Link to="/register" className="nav-link">Register</Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;