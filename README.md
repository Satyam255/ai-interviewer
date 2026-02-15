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

### 🎤 How to Talk About This in an Interview

When a recruiter asks, *"Tell me about a challenging project you built,"* here is your script:

> "I built an AI Interview Agent because I wanted to understand how to integrate LLMs into a real-world web app.
>
> The biggest technical challenge was **State Management and Context**.
>
> Initially, the AI would forget the candidate's resume halfway through the chat. I solved this by implementing a **Context Injection** strategy where the parsed resume text is fed into the 'System Instruction' of the model.
>
> I also had to deal with **Non-Deterministic Outputs**. The AI would sometimes return broken JSON when grading the candidate. I wrote a custom middleware to sanitize the string output before parsing it, which prevented the app from crashing.
>
> Finally, I added **Voice Support** using the Web Speech API to make it accessible and interactive without incurring extra API costs."

---
