import { useState } from "react";
import axios from "axios";
import InterviewSession from "./components/InterviewSession";
import "./App.css";

const SERVER_URL = "http://localhost:5000";

function App() {
  const [resumeId, setResumeId] = useState(null);
  const [questionLimit, setQuestionLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [interviewActive, setInterviewActive] = useState(false);
  const [atsResult, setAtsResult] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("resume", file);
    try {
      setLoading(true);
      setAtsResult(null);
      console.log("📤 Uploading resume:", file.name);

      const res = await axios.post(`${SERVER_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("📥 Upload response:", res.data);
      setResumeId(res.data.resumeId);

      // Store ATS result if available
      if (res.data.atsResult) {
        console.log("🎯 ATS Score:", res.data.atsResult.ats_score, "%");
        console.log("📊 Breakdown:", res.data.atsResult.breakdown);
        console.log("🔑 Keywords:", res.data.atsResult.keywords);
        setAtsResult(res.data.atsResult);
      } else {
        console.warn(
          "⚠️ No ATS result returned (Python service may be offline)",
        );
      }

      setLoading(false);
    } catch (error) {
      console.error("❌ Upload failed", error);
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    console.log("🎙️ Starting interview with resumeId:", resumeId);
    setInterviewActive(true);
  };

  const handleEnd = () => {
    setInterviewActive(false);
    setResumeId(null);
    setAtsResult(null);
  };

  const handleComplete = (feedback) => {
    console.log("✅ Interview completed with feedback:", feedback);
  };

  // ── Score color helper ──
  const getScoreColor = (score) => {
    if (score >= 70) return "#22c55e";
    if (score >= 50) return "#eab308";
    return "#ef4444";
  };

  // ── Interview active → render the component full-screen ──
  if (interviewActive && resumeId) {
    return (
      <div style={{ width: "100vw", height: "100vh" }}>
        <InterviewSession
          resumeId={resumeId}
          questionLimit={questionLimit}
          serverUrl={SERVER_URL}
          onComplete={handleComplete}
          onEnd={handleEnd}
        />
      </div>
    );
  }

  // ── Upload screen ──
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
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
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
            <ellipse
              cx="38"
              cy="44"
              rx="6"
              ry="7"
              fill="#00d4ff"
              opacity="0.9"
            />
            <ellipse
              cx="62"
              cy="44"
              rx="6"
              ry="7"
              fill="#00d4ff"
              opacity="0.9"
            />
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
        </div>
        <div className="upload-title">AI Interview</div>
        <div className="upload-subtitle">
          Upload your resume to start a real-time AI-powered mock interview with
          voice interaction and instant feedback.
        </div>

        {/* ── ATS Results Card ── */}
        {atsResult && (
          <div className="ats-results-card">
            <div className="ats-header">
              <span className="ats-badge">📊 ATS Score Report</span>
              <span
                className="ats-score-big"
                style={{ color: getScoreColor(atsResult.ats_score) }}
              >
                {atsResult.ats_score}%
              </span>
            </div>

            <div className="ats-breakdown">
              <div className="ats-bar-group">
                <div className="ats-bar-label">
                  <span>Experience</span>
                  <span>{atsResult.breakdown?.experience}%</span>
                </div>
                <div className="ats-bar-track">
                  <div
                    className="ats-bar-fill"
                    style={{
                      width: `${atsResult.breakdown?.experience}%`,
                      background: getScoreColor(
                        atsResult.breakdown?.experience,
                      ),
                    }}
                  />
                </div>
              </div>
              <div className="ats-bar-group">
                <div className="ats-bar-label">
                  <span>Skills</span>
                  <span>{atsResult.breakdown?.skills}%</span>
                </div>
                <div className="ats-bar-track">
                  <div
                    className="ats-bar-fill"
                    style={{
                      width: `${atsResult.breakdown?.skills}%`,
                      background: getScoreColor(atsResult.breakdown?.skills),
                    }}
                  />
                </div>
              </div>
              <div className="ats-bar-group">
                <div className="ats-bar-label">
                  <span>Education</span>
                  <span>{atsResult.breakdown?.education}%</span>
                </div>
                <div className="ats-bar-track">
                  <div
                    className="ats-bar-fill"
                    style={{
                      width: `${atsResult.breakdown?.education}%`,
                      background: getScoreColor(atsResult.breakdown?.education),
                    }}
                  />
                </div>
              </div>
              {atsResult.breakdown?.bonus > 0 && (
                <div className="ats-bonus">
                  🏆 Bonus Points: +{atsResult.breakdown.bonus}
                </div>
              )}
            </div>

            {atsResult.keywords?.matched?.length > 0 && (
              <div className="ats-keywords">
                <div className="ats-kw-title">✅ Matched Keywords</div>
                <div className="ats-kw-tags">
                  {atsResult.keywords.matched.slice(0, 12).map((kw, i) => (
                    <span key={i} className="ats-tag matched">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {atsResult.keywords?.missing?.length > 0 && (
              <div className="ats-keywords">
                <div className="ats-kw-title">❌ Missing Keywords</div>
                <div className="ats-kw-tags">
                  {atsResult.keywords.missing.slice(0, 10).map((kw, i) => (
                    <span key={i} className="ats-tag missing">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button className="ats-start-btn" onClick={handleStartInterview}>
              🎙️ Continue to Interview →
            </button>
          </div>
        )}

        {/* ── File Upload Card (hidden after ATS results shown) ── */}
        {!atsResult && (
          <>
            <div
              className="upload-card"
              onClick={() => document.getElementById("fileInput").click()}
            >
              <div className="upload-icon">📄</div>
              <label htmlFor="fileInput">
                Click to upload your resume (PDF)
              </label>
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
          </>
        )}

        {loading && (
          <div className="upload-loading">
            ⏳ Processing resume & running ATS check...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
