import { useState, useEffect } from "react"; // Added useEffect
import axios from "axios";
import useSpeechToText from "./hooks/useSpeechToText"; // Import Hook
import useTextToSpeech from "./hooks/useTextToSpeech"; // Import Hook
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [resumeId, setResumeId] = useState(null);
  const [interviewId, setInterviewId] = useState(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [questionLimit, setQuestionLimit] = useState(5);

  // Initialize Voice Hooks
  const { isListening, transcript, startListening } = useSpeechToText();
  const { speak, isSpeaking } = useTextToSpeech();

  // 1. Sync Voice Input to Text Box
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleFileUpload = async (event) => {
    // ... (Keep existing upload logic)
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("resume", file);
    try {
      const res = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResumeId(res.data.resumeId);
      startInterview(res.data.resumeId); // Call start
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  const startInterview = async (resId) => {
    try {
      const res = await axios.post("http://localhost:5000/start", {
        resumeId: resId,
        limit: questionLimit,
      });
      setInterviewId(res.data.interviewId);
      setIsChatActive(true);

      const greeting =
        "I have your resume. Let's begin. Tell me about yourself.";
      setMessages([{ role: "model", parts: [{ text: greeting }] }]);

      // AI Speaks Greeting
      speak(greeting);
    } catch (error) {
      console.error("Start failed", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [
      ...messages,
      { role: "user", parts: [{ text: input }] },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/chat", {
        message: input,
        interviewId: interviewId,
      });

      const aiReply = response.data.reply;
      setMessages([
        ...newMessages,
        { role: "model", parts: [{ text: aiReply }] },
      ]);

      // AI Speaks Reply
      speak(aiReply);

      if (response.data.isComplete) {
        setFeedback(response.data.feedback);
      }
    } catch (error) {
      console.error("Error", error);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>AI Interviewer (Voice Enabled 🎙️)</h1>

      {/* Upload Section */}
      {!isChatActive && (
        <div
          style={{
            border: "2px dashed #ccc",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <h3>Upload Resume to Start</h3>
          <input type="file" accept=".pdf" onChange={handleFileUpload} />

          <div style={{ marginTop: "20px" }}>
            <label>Length: </label>
            <select
              value={questionLimit}
              onChange={(e) => setQuestionLimit(Number(e.target.value))}
            >
              <option value={3}>Short (3 Qs)</option>
              <option value={5}>Standard (5 Qs)</option>
            </select>
          </div>
        </div>
      )}

      {/* Chat Section */}
      {isChatActive && !feedback && (
        <>
          <div
            style={{
              height: "400px",
              overflowY: "scroll",
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "10px",
              background: "#f9f9f9",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  textAlign: msg.role === "user" ? "right" : "left",
                  margin: "10px 0",
                }}
              >
                <span
                  style={{
                    background: msg.role === "user" ? "#007bff" : "#ffffff",
                    color: msg.role === "user" ? "#fff" : "#000",
                    border: msg.role === "model" ? "1px solid #ddd" : "none",
                    padding: "10px 15px",
                    borderRadius: "15px",
                    display: "inline-block",
                    maxWidth: "80%",
                  }}
                >
                  {msg.parts[0].text}
                </span>
              </div>
            ))}
            {loading && <p style={{ color: "#888" }}>AI is thinking...</p>}
            {isSpeaking && (
              <p style={{ color: "green", fontWeight: "bold" }}>
                🔊 AI is speaking...
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Mic Button */}
            <button
              onClick={startListening}
              style={{
                padding: "10px 15px",
                borderRadius: "50%",
                background: isListening ? "red" : "#28a745",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
              title="Click to Speak"
            >
              {isListening ? "🛑" : "🎤"}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={
                isListening ? "Listening..." : "Type or speak your answer..."
              }
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "5px",
                border: "1px solid #ccc",
              }}
            />

            <button
              onClick={sendMessage}
              disabled={loading}
              style={{ padding: "10px 20px" }}
            >
              Send
            </button>
          </div>
        </>
      )}

      {/* Feedback Section */}
      {feedback && (
        <div
          style={{ background: "#eef", padding: "20px", borderRadius: "10px" }}
        >
          <h2>Interview Result</h2>
          <p>
            <strong>Technical:</strong> {feedback.technicalScore}/10
          </p>
          <p>
            <strong>Communication:</strong> {feedback.communicationScore}/10
          </p>
          <p>{feedback.summary}</p>
          <button onClick={() => window.location.reload()}>Restart</button>
        </div>
      )}
    </div>
  );
}

export default App;
