import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ResumeCV({ token }) {
  const [isStarted, setIsStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    milestones: [],
    strengths: [],
  });
  const [tempAnswer, setTempAnswer] = useState({});
  const [currentSkill, setCurrentSkill] = useState(''); // New state for the current skill input
  const [currentStrength, setCurrentStrength] = useState(''); // New state for the current strength input
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Define the question flow
  const questions = [
    // Personal Information
    { id: 'name', question: 'What is your full name?', type: 'text', field: 'name' },
    { id: 'email', question: 'What is your email address?', type: 'email', field: 'email' },
    { id: 'phone', question: 'What is your phone number?', type: 'text', field: 'phone' },
    { id: 'address', question: 'What is your address?', type: 'text', field: 'address' },

    // Education (Multiple entries possible)
    { id: 'education-degree', question: 'What degree did you earn?', type: 'text', field: 'education', subfield: 'degree' },
    { id: 'education-institution', question: 'Which institution did you attend?', type: 'text', field: 'education', subfield: 'institution' },
    { id: 'education-years', question: 'What years did you attend (e.g., 2018-2022)?', type: 'text', field: 'education', subfield: 'years' },
    { id: 'education-more', question: 'Would you like to add another degree? (Yes/No)', type: 'yesno', field: 'education' },

    // Skills (Multiple entries possible)
    { id: 'skills', question: 'What is one of your skills?', type: 'text', field: 'skills' },
    { id: 'skills-more', question: 'Would you like to add another skill? (Yes/No)', type: 'yesno', field: 'skills' },

    // Certifications (Multiple entries possible)
    { id: 'certifications-name', question: 'What is the name of a certification you have?', type: 'text', field: 'certifications', subfield: 'name' },
    { id: 'certifications-organization', question: 'Which organization issued this certification?', type: 'text', field: 'certifications', subfield: 'organization' },
    { id: 'certifications-link', question: 'Do you have a link to this certification? (Leave blank if none)', type: 'text', field: 'certifications', subfield: 'link' },
    { id: 'certifications-more', question: 'Would you like to add another certification? (Yes/No)', type: 'yesno', field: 'certifications' },

    // Projects (Multiple entries possible)
    { id: 'projects-title', question: 'What is the title of a project you worked on?', type: 'text', field: 'projects', subfield: 'title' },
    { id: 'projects-description', question: 'Please describe this project briefly.', type: 'text', field: 'projects', subfield: 'description' },
    { id: 'projects-technologies', question: 'What technologies did you use in this project?', type: 'text', field: 'projects', subfield: 'technologies' },
    { id: 'projects-link', question: 'Do you have a link to this project? (Leave blank if none)', type: 'text', field: 'projects', subfield: 'link' },
    { id: 'projects-more', question: 'Would you like to add another project? (Yes/No)', type: 'yesno', field: 'projects' },

    // Milestones (Multiple entries possible)
    { id: 'milestones-achievement', question: 'What is a milestone or achievement you are proud of?', type: 'text', field: 'milestones', subfield: 'achievement' },
    { id: 'milestones-date', question: 'When did you achieve this milestone? (e.g., 2023)', type: 'text', field: 'milestones', subfield: 'date' },
    { id: 'milestones-more', question: 'Would you like to add another milestone? (Yes/No)', type: 'yesno', field: 'milestones' },

    // Strengths (Multiple entries possible)
    { id: 'strengths', question: 'What is one of your strengths?', type: 'text', field: 'strengths' },
    { id: 'strengths-more', question: 'Would you like to add another strength? (Yes/No)', type: 'yesno', field: 'strengths' },
  ];

  const handleStart = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsStarted(true);
      setIsTransitioning(false);
    }, 500); // Simulate a brief transition
  };

  const handleAnswer = (value) => {
    const currentQuestion = questions[currentStep];
    if (currentQuestion.type === 'yesno') {
      if (value.toLowerCase() === 'yes') {
        // For skills and strengths, reset the current input field but stay on the same question
        if (currentQuestion.field === 'skills') {
          setCurrentSkill(''); // Clear the skill input field for a new entry
          setCurrentStep(currentStep - 1); // Go back to the skill question
        } else if (currentQuestion.field === 'strengths') {
          setCurrentStrength(''); // Clear the strength input field for a new entry
          setCurrentStep(currentStep - 1); // Go back to the strength question
        } else {
          // For multi-part sections (education, certifications, projects, milestones), reset tempAnswer
          setTempAnswer({});
          // Go back to the first question of the section
          setCurrentStep(
            currentStep -
              (currentQuestion.field === 'education'
                ? 3
                : currentQuestion.field === 'certifications'
                ? 3
                : currentQuestion.field === 'projects'
                ? 4
                : currentQuestion.field === 'milestones'
                ? 2
                : 1)
          );
        }
      } else {
        // Move to the next question if "No" is selected
        setCurrentStep(currentStep + 1);
      }
    } else {
      if (currentQuestion.subfield) {
        // Update tempAnswer for multi-part sections like education, certifications, etc.
        setTempAnswer((prev) => ({ ...prev, [currentQuestion.subfield]: value }));
        setCurrentStep(currentStep + 1);

        // If this is the last subfield question for a section, save the tempAnswer to the main answers
        if (
          (currentQuestion.id === 'education-years' && questions[currentStep + 1].id === 'education-more') ||
          (currentQuestion.id === 'certifications-link' && questions[currentStep + 1].id === 'certifications-more') ||
          (currentQuestion.id === 'projects-link' && questions[currentStep + 1].id === 'projects-more') ||
          (currentQuestion.id === 'milestones-date' && questions[currentStep + 1].id === 'milestones-more')
        ) {
          setAnswers((prev) => ({
            ...prev,
            [currentQuestion.field]: [...prev[currentQuestion.field], { ...tempAnswer, [currentQuestion.subfield]: value }],
          }));
        }
      } else {
        // Handle single-field answers (name, email, phone, address, skills, strengths)
        if (currentQuestion.field === 'skills') {
          if (value.trim() && !answers.skills.includes(value.trim())) {
            setAnswers((prev) => ({
              ...prev,
              skills: [...prev.skills, value.trim()],
            }));
          }
          setCurrentSkill(''); // Clear the input field after adding
        } else if (currentQuestion.field === 'strengths') {
          if (value.trim() && !answers.strengths.includes(value.trim())) {
            setAnswers((prev) => ({
              ...prev,
              strengths: [...prev.strengths, value.trim()],
            }));
          }
          setCurrentStrength(''); // Clear the input field after adding
        } else {
          setAnswers((prev) => ({
            ...prev,
            [currentQuestion.field]: value,
          }));
        }
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevQuestion = questions[currentStep - 1];
      if (prevQuestion.type === 'yesno') {
        // Remove the last entry if the user goes back from a "more" question
        setAnswers((prev) => ({
          ...prev,
          [prevQuestion.field]: prev[prevQuestion.field].slice(0, -1),
        }));
        setTempAnswer({});
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!token) return navigate('/login');
    setLoading(true);
    try {
      console.log('Submitting answers:', answers); // Log for debugging
      const response = await axios.post(
        'http://localhost:5000/api/create-resume',
        { template: 'Professional', answers },
        { headers: { Authorization: token }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${answers.name || 'Resume'}_CV.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert('Resume downloaded successfully!');
    } catch (err) {
      console.error('Error generating resume:', err);
      alert('Failed to generate resume: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setIsStarted(false);
    setCurrentStep(0);
    setAnswers({
      name: '',
      email: '',
      phone: '',
      address: '',
      education: [],
      skills: [],
      certifications: [],
      projects: [],
      milestones: [],
      strengths: [],
    });
    setTempAnswer({});
    setCurrentSkill('');
    setCurrentStrength('');
  };

  const currentQuestion = questions[currentStep];

  return (
    <div style={{ marginTop: '80px' }} className="resume-cv">
      <h1>Resume/CV Builder</h1>
      {!isStarted ? (
        <div className="intro-screen">
          <h2>Build Your Professional Resume Today!</h2>
          <p>Answer a few simple questions to create a good and efficient resume in minutes. Let’s get started!</p>
          <button onClick={handleStart} disabled={isTransitioning}>
            {isTransitioning ? 'Starting...' : 'Start Building'}
          </button>
        </div>
      ) : currentStep < questions.length ? (
        <div className="question-flow">
          <h2>Question {currentStep + 1} of {questions.length}</h2>
          <div className="progress-bar">
            <div style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}></div>
          </div>
          <p>{currentQuestion.question}</p>
          {currentQuestion.type === 'yesno' ? (
            <div>
              <button onClick={() => handleAnswer('Yes')} disabled={loading}>
                Yes
              </button>
              <button onClick={() => handleAnswer('No')} disabled={loading}>
                No
              </button>
            </div>
          ) : (
            <input
              type={currentQuestion.type}
              value={
                currentQuestion.field === 'skills'
                  ? currentSkill
                  : currentQuestion.field === 'strengths'
                  ? currentStrength
                  : currentQuestion.subfield
                  ? tempAnswer[currentQuestion.subfield] || ''
                  : answers[currentQuestion.field] || ''
              }
              onChange={(e) => {
                if (currentQuestion.field === 'skills') {
                  setCurrentSkill(e.target.value);
                } else if (currentQuestion.field === 'strengths') {
                  setCurrentStrength(e.target.value);
                } else if (currentQuestion.subfield) {
                  setTempAnswer((prev) => ({ ...prev, [currentQuestion.subfield]: e.target.value }));
                } else {
                  setAnswers((prev) => ({ ...prev, [currentQuestion.field]: e.target.value }));
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const value =
                    currentQuestion.field === 'skills'
                      ? currentSkill
                      : currentQuestion.field === 'strengths'
                      ? currentStrength
                      : currentQuestion.subfield
                      ? tempAnswer[currentQuestion.subfield]
                      : e.target.value;
                  handleAnswer(value);
                }
              }}
              placeholder="Type your answer here"
              required
            />
          )}
          <div className="navigation-buttons">
            {currentStep > 0 && (
              <button type="button" onClick={handlePrevious} disabled={loading}>
                Previous
              </button>
            )}
            {currentQuestion.type !== 'yesno' && (
              <button
                type="button"
                onClick={() =>
                  handleAnswer(
                    currentQuestion.field === 'skills'
                      ? currentSkill
                      : currentQuestion.field === 'strengths'
                      ? currentStrength
                      : currentQuestion.subfield
                      ? tempAnswer[currentQuestion.subfield]
                      : answers[currentQuestion.field]
                  )
                }
                disabled={loading}
              >
                Next
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="completion-screen">
          <h2>All Questions Answered!</h2>
          <p>Your resume is ready! Click below to download it, or restart to build a new one.</p>
          <div className="completion-buttons">
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Generating...' : 'Download Resume'}
            </button>
            <button onClick={handleRestart} disabled={loading}>
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResumeCV;