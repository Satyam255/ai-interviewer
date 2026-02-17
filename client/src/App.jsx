import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import useSpeechToText from "./hooks/useSpeechToText";
import useTextToSpeech from "./hooks/useTextToSpeech";
import "./App.css";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

// SVG AI Avatar Icon
const AiAvatarSVG = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="50"
      cy="50"
      r="40"
      stroke="#00d4ff"
      strokeWidth="1.5"
      opacity="0.3"
    />
    <circle
      cx="50"
      cy="50"
      r="30"
      stroke="#00d4ff"
      strokeWidth="1"
      opacity="0.15"
    />
    {/* Eyes */}
    <ellipse cx="38" cy="44" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
    <ellipse cx="62" cy="44" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
    {/* Eye shine */}
    <circle cx="40" cy="42" r="2" fill="#fff" opacity="0.8" />
    <circle cx="64" cy="42" r="2" fill="#fff" opacity="0.8" />
    {/* Mouth arc */}
    <path
      d="M 38 60 Q 50 68 62 60"
      stroke="#00d4ff"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
    {/* Antenna */}
    <line
      x1="50"
      y1="18"
      x2="50"
      y2="10"
      stroke="#00d4ff"
      strokeWidth="1.5"
      opacity="0.4"
    />
    <circle cx="50" cy="8" r="3" fill="#00d4ff" opacity="0.5" />
  </svg>
);

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [resumeId, setResumeId] = useState(null);
  const [interviewId, setInterviewId] = useState(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [questionLimit, setQuestionLimit] = useState(5);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    setOnResult,
  } = useSpeechToText();
  const { speak, isSpeaking, setOnSpeechEnd } = useTextToSpeech();

  const interviewIdRef = useRef(null);
  const isStreamingRef = useRef(false);
  const autoVoiceRef = useRef(true);
  const feedbackRef = useRef(null);
  const latestAiMessageRef = useRef("");
  const chatEndRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);
  useEffect(() => {
    autoVoiceRef.current = autoVoice;
  }, [autoVoice]);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (isChatActive && !feedback) {
      timerRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isChatActive, feedback]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Auto-send
  const autoSend = useCallback((text) => {
    if (!text.trim() || isStreamingRef.current) return;
    setMessages((prev) => [...prev, { role: "user", parts: [{ text }] }]);
    setInput("");
    setIsStreaming(true);
    isStreamingRef.current = true;
    latestAiMessageRef.current = "";
    socket.emit("chatMessage", {
      message: text,
      interviewId: interviewIdRef.current,
    });
  }, []);

  // TTS finished → auto-listen
  useEffect(() => {
    setOnSpeechEnd(() => {
      if (autoVoiceRef.current && !feedbackRef.current) {
        setTimeout(() => startListening(), 400);
      }
    });
  }, [setOnSpeechEnd, startListening]);

  // STT result → auto-send
  useEffect(() => {
    setOnResult((text) => {
      if (autoVoiceRef.current && text.trim()) {
        autoSend(text);
      }
    });
  }, [setOnResult, autoSend]);

  // Socket events
  useEffect(() => {
    socket.on("aiResponseChunk", (chunk) => {
      latestAiMessageRef.current += chunk;
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "model") {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              parts: [{ text: lastMsg.parts[0].text + chunk }],
            },
          ];
        }
        return [...prev, { role: "model", parts: [{ text: chunk }] }];
      });
    });

    socket.on("aiResponseComplete", () => {
      setIsStreaming(false);
      isStreamingRef.current = false;
      setLoading(false);
      if (latestAiMessageRef.current) speak(latestAiMessageRef.current);
      latestAiMessageRef.current = "";
    });

    socket.on("interviewStarted", ({ interviewId: id }) => {
      setInterviewId(id);
      interviewIdRef.current = id;
      setIsChatActive(true);
      setLoading(false);
      const greeting =
        "I have your resume. Let's begin. Tell me about yourself.";
      setMessages([{ role: "model", parts: [{ text: greeting }] }]);
      speak(greeting);
    });

    socket.on("interviewComplete", (feedbackData) => {
      setFeedback(feedbackData);
      feedbackRef.current = feedbackData;
      setIsStreaming(false);
      isStreamingRef.current = false;
      setLoading(false);
      clearInterval(timerRef.current);
    });

    socket.on("error", (errorMsg) => {
      console.error("Socket error:", errorMsg);
      setIsStreaming(false);
      isStreamingRef.current = false;
      setLoading(false);
    });

    return () => {
      socket.off("aiResponseChunk");
      socket.off("aiResponseComplete");
      socket.off("interviewStarted");
      socket.off("interviewComplete");
      socket.off("error");
    };
  }, [speak]);

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("resume", file);
    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResumeId(res.data.resumeId);
      socket.emit("joinInterview", {
        resumeId: res.data.resumeId,
        limit: questionLimit,
      });
    } catch (error) {
      console.error("Upload failed", error);
      setLoading(false);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || isStreaming) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", parts: [{ text: input }] },
    ]);
    const msg = input;
    setInput("");
    setIsStreaming(true);
    isStreamingRef.current = true;
    latestAiMessageRef.current = "";
    socket.emit("chatMessage", { message: msg, interviewId });
  };

  // Get AI status text
  const getAiStatus = () => {
    if (isSpeaking) return { text: "Speaking", dotClass: "speaking" };
    if (isStreaming) return { text: "Thinking", dotClass: "thinking" };
    if (isListening) return { text: "Listening to you", dotClass: "" };
    return { text: "Ready", dotClass: "" };
  };

  // ============ RENDER ============

  // UPLOAD SCREEN
  if (!isChatActive) {
    return (
      <div className="vc-container">
        <div className="vc-top-bar">
          <div className="title">
            <span className="dot"></span>
            AI Interview System
          </div>
        </div>

        <div className="vc-upload-screen">
          <div className="upload-logo">
            <AiAvatarSVG />
          </div>
          <div className="upload-title">AI Interview</div>
          <div className="upload-subtitle">
            Upload your resume to start a real-time AI-powered mock interview
            with voice interaction and instant feedback.
          </div>

          <div
            className="upload-card"
            onClick={() => document.getElementById("fileInput").click()}
          >
            <div className="upload-icon">📄</div>
            <label htmlFor="fileInput">Click to upload your resume (PDF)</label>
            <input
              id="fileInput"
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
            />
          </div>

          <div className="upload-options">
            <label>Interview Length:</label>
            <select
              value={questionLimit}
              onChange={(e) => setQuestionLimit(Number(e.target.value))}
            >
              <option value={3}>Short (3 Questions)</option>
              <option value={5}>Standard (5 Questions)</option>
              <option value={8}>Extended (8 Questions)</option>
            </select>
          </div>

          {loading && (
            <div className="upload-loading">⏳ Processing your resume...</div>
          )}
        </div>
      </div>
    );
  }

  // FEEDBACK SCREEN
  if (feedback) {
    return (
      <div className="vc-container">
        <div className="vc-top-bar">
          <div className="title">
            <span className="dot"></span>
            Interview Complete
          </div>
          <div className="timer">{formatTime(elapsedTime)}</div>
        </div>

        <div className="vc-feedback-screen">
          <div className="feedback-card">
            <h2>🎯 Interview Report</h2>

            <div className="feedback-scores">
              <div className="score-card">
                <div className="score-value">{feedback.technicalScore}</div>
                <div className="score-label">Technical</div>
              </div>
              <div className="score-card">
                <div className="score-value">{feedback.communicationScore}</div>
                <div className="score-label">Communication</div>
              </div>
            </div>

            <div className="feedback-summary">{feedback.summary}</div>

            <div className="feedback-lists">
              <div className="feedback-list">
                <h4 className="strengths">✅ Strengths</h4>
                <ul>
                  {feedback.strengths?.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="feedback-list">
                <h4 className="weaknesses">⚠️ Improve</h4>
                <ul>
                  {feedback.weaknesses?.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              className="restart-btn"
              onClick={() => window.location.reload()}
            >
              Start New Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN VIDEO CALL SCREEN
  const aiStatus = getAiStatus();

  return (
    <div className="vc-container">
      {/* Top Bar */}
      <div className="vc-top-bar">
        <div className="title">
          <span className="dot"></span>
          AI Interview Session
        </div>
        <div className="controls">
          <div className="auto-voice-toggle">
            <label htmlFor="autoVoice">Auto Voice</label>
            <input
              id="autoVoice"
              type="checkbox"
              checked={autoVoice}
              onChange={(e) => setAutoVoice(e.target.checked)}
            />
          </div>
          <div className="timer">{formatTime(elapsedTime)}</div>
        </div>
      </div>

      {/* Main area */}
      <div className="vc-main">
        {/* AI Section */}
        <div className="vc-ai-section">
          <div
            className={`ai-avatar-container ${isSpeaking ? "ai-speaking" : ""}`}
          >
            <div className="ai-pulse-ring ring-1"></div>
            <div className="ai-pulse-ring ring-2"></div>
            <div className="ai-pulse-ring ring-3"></div>
            <div className="ai-avatar">
              <AiAvatarSVG />
            </div>
          </div>

          <div className="ai-label">AI Interviewer</div>
          <div className="ai-status">
            <span className={`status-dot ${aiStatus.dotClass}`}></span>
            {aiStatus.text}
          </div>

          {/* Sound wave bars */}
          <div className={`sound-wave ${isSpeaking ? "" : ""}`}>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        </div>

        {/* Chat Panel (right side) */}
        {showChat && (
          <div className="vc-chat-panel">
            <div className="chat-header">
              <span>💬 Transcript</span>
              <span style={{ fontSize: "11px", color: "#5a6380" }}>
                {messages.length} messages
              </span>
            </div>

            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-msg ${msg.role === "user" ? "user" : "ai"}`}
                >
                  <div className="msg-role">
                    {msg.role === "user" ? "You" : "AI"}
                  </div>
                  {msg.parts[0].text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-area">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder={
                  isListening
                    ? "Listening..."
                    : isStreaming
                      ? "Waiting for AI..."
                      : "Type a message..."
                }
                disabled={isStreaming || isSpeaking}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={isStreaming || isSpeaking}
              >
                {isStreaming ? "..." : "→"}
              </button>
            </div>
          </div>
        )}

        {/* User PIP */}
        <div className={`vc-user-pip ${isListening ? "listening" : ""}`}>
          <div className="user-avatar-small">👤</div>
          <div className="user-pip-label">You</div>
          {isListening && <div className="user-pip-status">● Recording</div>}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="vc-bottom-bar">
        <button
          className={`vc-btn mic ${isListening ? "active" : ""}`}
          onClick={startListening}
          disabled={isStreaming || isSpeaking}
          title="Toggle Microphone"
        >
          {isListening ? "🎤" : "🎙️"}
        </button>

        <button
          className="vc-btn end-call"
          onClick={() => window.location.reload()}
          title="End Interview"
        >
          📞
        </button>

        <button
          className="vc-btn chat-toggle"
          onClick={() => setShowChat(!showChat)}
          title="Toggle Chat"
        >
          💬
        </button>
      </div>
    </div>
  );
}

export default App;
