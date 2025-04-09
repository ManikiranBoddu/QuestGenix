## QuestGenix

🚀 QuestGenix is an AI-powered question generation and evaluation platform built with Google Generative AI (Gemini API). Users can upload documents and receive intelligently crafted questions with scoring and feedback.

---

## 🧠 Features

- Upload PDF, DOCX, or text-based question papers
- Extract questions and answers using NLP
- Score user answers and provide detailed feedback
- Track results and likes
- JWT-based authentication and authorization
- SQLite database with Express.js backend

---

## 🛠 Tech Stack

- **Frontend**: React, React Router, Axios, Dropzone
- **Backend**: Node.js, Express.js, Multer, bcryptjs
- **Database**: SQLite
- **AI**: Google Generative AI (Gemini API)
- **Auth**: JWT
- **Hosting**: Render (backend) + Vercel (frontend)

---

## ⚙️ Setup Locally

```bash
# Clone the repository
git clone https://github.com/ManikiranBoddu/QuestGenix.git
cd QuestGenix

## Backend setup
cd server
npm install
cp .env.example .env
node server.js

# Frontend setup (in a new terminal)
cd ../client
npm install
npm start
