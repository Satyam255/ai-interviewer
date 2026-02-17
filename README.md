# 🤖 AI Mock Interviewer (MERN + Gemini + WebSockets)

A full-stack, real-time AI interview platform that conducts voice-enabled technical interviews, analyzes resumes, and provides detailed feedback scores. Now powered by **WebSockets** for streaming responses and a **Live Video Interface** for a realistic interview experience.

## 🚀 Features

- **⚡ Real-Time Streaming:** Uses **Socket.io** to stream AI responses letter-by-letter, eliminating wait times.
- **📹 Live Video Interface:** A realistic video-call UI that renders the user's camera feed alongside the AI agent.
- **📄 Resume Parsing (RAG):** Upload a PDF resume; the AI extracts skills and tailors questions to your specific experience.
- **🗣️ Voice Interaction:** Speak your answers naturally using the **Web Speech API** (Speech-to-Text) and listen to the AI (Text-to-Speech).
- **🧠 Context-Aware Memory:** The AI remembers your previous answers and asks relevant follow-up questions.
- **📊 Smart Grading System:** Generates a JSON-based report card with scores (0-10) for Technical Skills, Communication, and actionable feedback.

## 🛠️ Tech Stack

- **Frontend:** React (Vite), Socket.io-Client, Web Speech API
- **Backend:** Node.js, Express.js, Socket.io (WebSockets)
- **Database:** MongoDB (Mongoose)
- **AI Engine:** Google Gemini 1.5 Flash (Stream API)
- **Tools:** Multer (File Uploads), PDF-Parse

## 🧩 System Architecture



1. **Initialization:** User uploads Resume (HTTP) → Text extracted & stored in MongoDB.
2. **Connection:** Client establishes a **WebSocket** connection with the Backend.
3. **The Interview Loop:**
   - **User Speaks:** Audio converted to text via Browser API.
   - **Socket Emit:** Text sent to Node.js server.
   - **AI Stream:** Server pipes text to Gemini Stream API.
   - **Real-Time Render:** AI response chunks are pushed to the Frontend instantly.
4. **Completion:** Session ends → Full transcript sent to "Grader AI" → JSON Report generated.

## 📸 Screenshots


## 🏃‍♂️ How to Run

1. **Clone the Repo**
   ```bash
   git clone [https://github.com/Satyam255/ai-interviewer.git](https://github.com/Satyam255/ai-interviewer.git)
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
