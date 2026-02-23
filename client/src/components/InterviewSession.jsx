import { useEffect, useState, useRef, useCallback } from "react";
import useSpeechToText from "../hooks/useSpeechToText";
import useTextToSpeech from "../hooks/useTextToSpeech";
import io from "socket.io-client";
import "./InterviewSession.css";

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
    <ellipse cx="38" cy="44" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
    <ellipse cx="62" cy="44" rx="6" ry="7" fill="#00d4ff" opacity="0.9" />
    <circle cx="40" cy="42" r="2" fill="#fff" opacity="0.8" />
    <circle cx="64" cy="42" r="2" fill="#fff" opacity="0.8" />
    <path
      d="M 38 60 Q 50 68 62 60"
      stroke="#00d4ff"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.6"
    />
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

/**
 * InterviewSession — a self-contained, reusable React component for AI interviews.
 *
 * Props:
 *  - resumeId       (string, required)  — MongoDB ID of the uploaded resume
 *  - jobDescription  (string, optional)  — JD text to tailor interview questions
 *  - questionLimit   (number, optional)  — default 5
 *  - serverUrl       (string, optional)  — default "http://localhost:5000"
 *  - onComplete      (fn, optional)      — called with feedbackData when interview ends
 *  - onEnd           (fn, optional)      — called when user clicks "End Interview" or "Start New"
 */
export default function InterviewSession({
  resumeId,
  jobDescription = "",
  questionLimit = 5,
  serverUrl = "http://localhost:5000",
  onComplete,
  onEnd,
}) {
  // ── State ──
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [interviewId, setInterviewId] = useState(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // ── Hooks ──
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    setOnResult,
  } = useSpeechToText();
  const { speak, isSpeaking, setOnSpeechEnd } = useTextToSpeech();

  // ── Refs ──
  const socketRef = useRef(null);
  const interviewIdRef = useRef(null);
  const isStreamingRef = useRef(false);
  const autoVoiceRef = useRef(true);
  const feedbackRef = useRef(null);
  const latestAiMessageRef = useRef("");
  const chatEndRef = useRef(null);
  const timerRef = useRef(null);

  // Keep refs in sync
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
    if (started && !feedback) {
      timerRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [started, feedback]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Auto-send logic ──
  const autoSend = useCallback((text) => {
    if (!text.trim() || isStreamingRef.current) return;
    setMessages((prev) => [...prev, { role: "user", parts: [{ text }] }]);
    setInput("");
    setIsStreaming(true);
    isStreamingRef.current = true;
    latestAiMessageRef.current = "";
    socketRef.current?.emit("chatMessage", {
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

  // ── Socket lifecycle ──
  useEffect(() => {
    const socket = io(serverUrl);
    socketRef.current = socket;

    // Socket events
    socket.on("aiResponseChunk", (chunk) => {
      latestAiMessageRef.current += chunk;
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "model") {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, parts: [{ text: lastMsg.parts[0].text + chunk }] },
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
      setStarted(true);
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
      if (onComplete) onComplete(feedbackData);
    });

    socket.on("error", (errorMsg) => {
      console.error("Socket error:", errorMsg);
      setIsStreaming(false);
      isStreamingRef.current = false;
      setLoading(false);
    });

    // Auto-start the interview
    socket.emit("joinInterview", {
      resumeId,
      limit: questionLimit,
      jobDescription,
    });

    return () => {
      socket.off("aiResponseChunk");
      socket.off("aiResponseComplete");
      socket.off("interviewStarted");
      socket.off("interviewComplete");
      socket.off("error");
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, serverUrl]);

  // Sync transcript → input field
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // ── Manual send ──
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
    socketRef.current?.emit("chatMessage", { message: msg, interviewId });
  };

  // AI status text
  const getAiStatus = () => {
    if (isSpeaking) return { text: "Speaking", dotClass: "speaking" };
    if (isStreaming) return { text: "Thinking", dotClass: "thinking" };
    if (isListening) return { text: "Listening to you", dotClass: "" };
    return { text: "Ready", dotClass: "" };
  };

  // ── RENDER ──

  // Loading state
  if (loading && !started) {
    return (
      <div className="interview-session">
        <div className="is-container">
          <div className="is-top-bar">
            <div className="title">
              <span className="dot"></span>
              Connecting…
            </div>
          </div>
          <div className="is-loading-screen">
            <div className="is-loading-spinner"></div>
            <div className="is-loading-text">Setting up your interview…</div>
          </div>
        </div>
      </div>
    );
  }

  // Feedback screen
  if (feedback) {
    return (
      <div className="interview-session">
        <div className="is-container">
          <div className="is-top-bar">
            <div className="title">
              <span className="dot"></span>
              Interview Complete
            </div>
            <div className="timer">{formatTime(elapsedTime)}</div>
          </div>

          <div className="is-feedback-screen">
            <div className="feedback-card">
              <h2>🎯 Interview Report</h2>

              <div className="feedback-scores">
                <div className="score-card">
                  <div className="score-value">{feedback.technicalScore}</div>
                  <div className="score-label">Technical</div>
                </div>
                <div className="score-card">
                  <div className="score-value">
                    {feedback.communicationScore}
                  </div>
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

              {onEnd && (
                <button className="restart-btn" onClick={onEnd}>
                  Start New Interview
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main interview screen
  const aiStatus = getAiStatus();

  return (
    <div className="interview-session">
      <div className="is-container">
        {/* Top Bar */}
        <div className="is-top-bar">
          <div className="title">
            <span className="dot"></span>
            AI Interview Session
          </div>
          <div className="controls">
            <div className="auto-voice-toggle">
              <label htmlFor="isAutoVoice">Auto Voice</label>
              <input
                id="isAutoVoice"
                type="checkbox"
                checked={autoVoice}
                onChange={(e) => setAutoVoice(e.target.checked)}
              />
            </div>
            <div className="timer">{formatTime(elapsedTime)}</div>
          </div>
        </div>

        {/* Main area */}
        <div className="is-main">
          {/* AI Section */}
          <div className="is-ai-section">
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
            <div className="sound-wave">
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
            <div className="is-chat-panel">
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
          <div className={`is-user-pip ${isListening ? "listening" : ""}`}>
            <div className="user-avatar-small">👤</div>
            <div className="user-pip-label">You</div>
            {isListening && <div className="user-pip-status">● Recording</div>}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="is-bottom-bar">
          <button
            className={`is-btn mic ${isListening ? "active" : ""}`}
            onClick={startListening}
            disabled={isStreaming || isSpeaking}
            title="Toggle Microphone"
          >
            {isListening ? "🎤" : "🎙️"}
          </button>

          <button
            className="is-btn end-call"
            onClick={onEnd}
            title="End Interview"
          >
            📞
          </button>

          <button
            className="is-btn chat-toggle"
            onClick={() => setShowChat(!showChat)}
            title="Toggle Chat"
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}
