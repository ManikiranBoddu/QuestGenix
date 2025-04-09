import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Publications from './components/Publications';
import Questions from './components/Questions';
import Login from './components/Login';
import Register from './components/Register';
import Practice from './components/Practice';
import ResumeCV from './components/ResumeCV';
import MyQuizzes from './components/MyQuizzes';
import TakeQuiz from './components/TakeQuiz';
import Account from './components/Account';
import './styles.css';

const ProtectedRoute = ({ token, children }) => {
  console.log('ProtectedRoute checking token:', token);
  const storedToken = localStorage.getItem('token');
  console.log('ProtectedRoute stored token:', storedToken);
  const location = useLocation();
  console.log('ProtectedRoute current location:', location.pathname);

  if ((token || storedToken) && location.pathname === '/') {
    console.log('User is authenticated and on home page, allowing access');
    return children;
  }

  if (!token && !storedToken) {
    console.log('No token, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  return children;
};

const WithNavbar = ({ children, token, setToken, userData, setUserData, plainPassword }) => {
  const location = useLocation();
  const hideNavbarPaths = ['/login', '/register'];

  return (
    <>
      {!hideNavbarPaths.includes(location.pathname) && (
        <Navbar token={token} setToken={setToken} userData={userData} setUserData={setUserData} />
      )}
      {children}
    </>
  );
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [plainPassword, setPlainPassword] = useState('');
  const [userData, setUserData] = useState({
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

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    console.log('Initial token check - token:', token, 'storedToken:', storedToken);
    if (storedToken && !token) {
      console.log('Found token in localStorage, setting token:', storedToken);
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!token) {
          console.log('No token, skipping user data fetch');
          return;
        }
        console.log('Fetching user data with token:', token);
        const res = await fetch('http://localhost:5000/api/user', {
          headers: { Authorization: token },
        });
        if (res.ok) {
          const data = await res.json();
          console.log('Fetched user data:', data);
          setUserData({
            username: data.username || '',
            profilePic: data.profilePic ? `http://localhost:5000${data.profilePic}` : '',
            email: data.email || '',
            createdAt: data.createdAt || '',
            lastLogin: data.lastLogin || '',
            totalPublications: data.totalPublications || 0,
            publicationsByDomain: data.publicationsByDomain || {},
            totalQuizzes: data.totalQuizzes || 0,
            quizNames: data.quizNames || [],
            totalAssignments: data.totalAssignments || 0,
            totalQuestionsGenerated: data.totalQuestionsGenerated || 0,
            password: data.password || '',
          });
        } else {
          console.error('Failed to fetch user data:', res.status, await res.text());
          if (res.status === 401) {
            console.log('Unauthorized error, clearing token');
            setToken('');
            localStorage.removeItem('token');
          } else {
            console.log('Non-auth error, keeping token');
          }
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        console.log('Network error, keeping token');
      }
    };

    if (token) {
      console.log('Token exists, setting in localStorage:', token);
      localStorage.setItem('token', token);
      fetchUserData();
    } else {
      console.log('No token, clearing user data');
      localStorage.removeItem('token');
      setUserData((prev) => ({ ...prev, profilePic: '', password: '' }));
      setPlainPassword('');
    }
  }, [token]);

  const handleAuthSuccess = (token, password, callback) => {
    console.log('Handling auth success with token:', token, 'and password:', password);
    setToken(token);
    setPlainPassword(password);
    setUserData((prev) => ({ ...prev, password }));
    if (callback && typeof callback === 'function') {
      console.log('Calling callback after token set');
      callback();
    } else {
      console.log('No callback provided or callback is not a function');
    }
  };

  return (
    <Router>
      <div className="App">
        <WithNavbar
          token={token}
          setToken={setToken}
          userData={userData}
          setUserData={setUserData}
          plainPassword={plainPassword}
        >
          <Routes>
            <Route
              path="/login"
              element={<Login setToken={(token, password, callback) => handleAuthSuccess(token, password, callback)} />}
            />
            <Route
              path="/register"
              element={<Register setToken={(token, password, callback) => handleAuthSuccess(token, password, callback)} />}
            />
            <Route
              path="/"
              element={
                <ProtectedRoute token={token}>
                  <Home token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/questions"
              element={
                <ProtectedRoute token={token}>
                  <Questions token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/questions/:pubId"
              element={
                <ProtectedRoute token={token}>
                  <Questions token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/publications"
              element={
                <ProtectedRoute token={token}>
                  <Publications token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice"
              element={
                <ProtectedRoute token={token}>
                  <Navigate to="/publications" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/practice/:pubId"
              element={
                <ProtectedRoute token={token}>
                  <Practice token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resume"
              element={
                <ProtectedRoute token={token}>
                  <ResumeCV token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-quizzes"
              element={
                <ProtectedRoute token={token}>
                  <MyQuizzes token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/take-quiz/:quizId"
              element={
                <ProtectedRoute token={token}>
                  <TakeQuiz token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute token={token}>
                  <Account token={token} userData={userData} setUserData={setUserData} plainPassword={plainPassword} />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={
                token || localStorage.getItem('token') ? (
                  <Navigate to="/" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </WithNavbar>
        <footer>© 2025 QuestGenix</footer>
      </div>
    </Router>
  );
}

export default App;