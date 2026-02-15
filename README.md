# 🤖 AI Mock Interviewer (MERN + Gemini)

A full-stack AI interview platform that conducts voice-enabled technical interviews, analyzes resumes, and provides detailed feedback scores.

## 🚀 Features

- **📄 Resume Analysis:** Upload a PDF resume; the AI extracts skills and tailors questions to your experience.
- **🗣️ Voice Interaction:** Speak your answers naturally using the Web Speech API (no keyboard needed).
- **🧠 Context-Aware Questions:** The AI remembers your previous answers and asks relevant follow-up questions.
- **📊 Smart Grading System:** Generates a JSON-based report card with scores (0-10) for Technical Skills and Communication.
- **⚡ Real-time Latency:** Optimized for fast response times using Google Gemini 1.5 Flash.

## 🛠️ Tech Stack

- **Frontend:** React (Vite), Axios, Tailwind CSS (optional)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **AI Engine:** Google Gemini API (Generative AI)
- **Tools:** Multer (File Uploads), PDF-Parse, Web Speech API

## 🧩 System Architecture

1. **User Uploads Resume** → Parsed by Backend → Text Stored in MongoDB.
2. **Interview Starts** → System injects Resume Text into System Prompt.
3. **User Speaks/Types** → Text sent to Gemini API with Chat History.
4. **AI Responds** → Frontend uses Text-to-Speech to read the question.
5. **Session Ends** → Transcript sent to "Grader AI" for evaluation.


## 🏃‍♂️ How to Run

1. **Clone the Repo**
   ```bash
   git clone [https://github.com/Satyam255/ai-interviewer.git]

2. **Setup Backend**
   ```bash
   cd server
   npm install
    # Create .env file with GEMINI_API_KEY and MONGO_URI
    node server.js
3. **Setup Frontend**
  ```bash
    cd client
    npm install
    npm run dev 
```


---
