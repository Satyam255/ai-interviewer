require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Resume = require("./models/Resume");
const Interview = require("./models/Interview");

// ── PYTHON ATS SERVICE CONFIG ──
const ATS_SERVICE_URL = "http://localhost:8000/calculate_weighted_score";

// ── DUMMY JD FOR ATS TESTING ──
const DUMMY_JD = `
Job Title: Full Stack Software Engineer

We are looking for a skilled Full Stack Software Engineer to join our team.

Requirements:
- 2+ years of experience in software development
- Proficiency in JavaScript, TypeScript, Python, or Java
- Experience with React, Angular, or Vue.js for frontend development
- Backend experience with Node.js, Express, Django, or Spring Boot
- Database experience with MongoDB, PostgreSQL, or MySQL
- Familiarity with RESTful APIs and microservices architecture
- Experience with Git, CI/CD pipelines, and cloud platforms (AWS/GCP/Azure)
- Strong problem-solving and communication skills
- Experience with Docker, Kubernetes, or containerization is a plus
- Knowledge of system design and distributed systems is preferred

Responsibilities:
- Design, develop, and maintain web applications
- Collaborate with cross-functional teams to deliver features
- Write clean, testable, and well-documented code
- Participate in code reviews and mentor junior developers
- Optimize application performance and scalability
`;

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

// 2. Configure Multer (Temporary storage for uploads)
const upload = multer({ dest: "uploads/" });

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" },
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- HELPERS ---

// Robust JSON parser that handles fenced code blocks and markdown from AI
function cleanAndParseJSON(rawText) {
  try {
    // Strip markdown code fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("JSON parse failed:", err.message);
    return null;
  }
}

// Grading Agent — evaluates the interview transcript
async function generateFeedback(interviewHistory) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are an expert technical interviewer. Evaluate the following interview transcript:
    ${JSON.stringify(interviewHistory)}
    
    OUTPUT JSON ONLY in this format:
    {
        "technicalScore": (number 1-10),
        "communicationScore": (number 1-10),
        "strengths": ["list of strengths"],
        "weaknesses": ["list of weaknesses"],
        "summary": "2 sentence summary"
    }
    `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const feedbackData = cleanAndParseJSON(text);

  if (!feedbackData) {
    return {
      technicalScore: 0,
      communicationScore: 0,
      strengths: ["Error generating feedback"],
      weaknesses: ["Please try again"],
      summary: "The AI could not generate a valid report.",
    };
  }

  return feedbackData;
}

// --- ROUTES ---

// Route: Upload & Parse Resume + ATS Check
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("\n" + "=".repeat(60));
    console.log("📥 RESUME UPLOAD STARTED");
    console.log("=".repeat(60));
    console.log("📄 File:", req.file.originalname);

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;
    console.log("✅ PDF parsed. Extracted", extractedText.length, "characters");
    console.log("📝 Resume Preview:", extractedText.substring(0, 200) + "...");

    const newResume = new Resume({
      filename: req.file.originalname,
      textContent: extractedText,
    });

    await newResume.save();
    console.log("✅ Resume saved to MongoDB. ID:", newResume._id);

    fs.unlinkSync(req.file.path);
    console.log("🗑️  Temp file cleaned up");

    // ── ATS CHECK: Call Python service with Dummy JD ──
    let atsResult = null;
    try {
      console.log("\n── ATS CHECK ──");
      console.log("🔄 Calling Python ATS service at", ATS_SERVICE_URL);
      console.log("📋 Using Dummy JD (", DUMMY_JD.length, "chars)");

      const atsResponse = await fetch(ATS_SERVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: DUMMY_JD,
          resume: extractedText,
        }),
      });

      atsResult = await atsResponse.json();

      console.log("\n✅ ATS RESULTS RECEIVED:");
      console.log("   🎯 ATS Score       :", atsResult.ats_score, "%");
      if (atsResult.breakdown) {
        console.log(
          "   📊 Experience Match :",
          atsResult.breakdown.experience,
          "%",
        );
        console.log(
          "   📊 Skills Match     :",
          atsResult.breakdown.skills,
          "%",
        );
        console.log(
          "   📊 Education Match  :",
          atsResult.breakdown.education,
          "%",
        );
        console.log("   🏆 Bonus Points     :", atsResult.breakdown.bonus);
      }
      if (atsResult.keywords) {
        console.log(
          "   ✅ Matched Keywords :",
          atsResult.keywords.matched?.join(", "),
        );
        console.log(
          "   ❌ Missing Keywords  :",
          atsResult.keywords.missing?.slice(0, 10).join(", "),
        );
      }
    } catch (atsError) {
      console.warn("\n⚠️  ATS SERVICE UNAVAILABLE:", atsError.message);
      console.warn("   Make sure python-server is running on port 8000");
      console.warn("   Continuing without ATS score...");
    }

    console.log("\n" + "=".repeat(60));
    console.log("📤 UPLOAD RESPONSE SENT");
    console.log("=".repeat(60) + "\n");

    res.json({
      message: "Resume processed",
      resumeId: newResume._id,
      atsResult: atsResult,
    });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    res.status(500).json({ error: "Failed to process resume" });
  }
});

// --- WEBSOCKET SESSION ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Event: Start a new interview session
  socket.on("joinInterview", async ({ resumeId, limit, jobDescription }) => {
    try {
      const newInterview = new Interview({
        resumeId,
        jobDescription: jobDescription || "",
        messages: [],
        questionLimit: limit || 5,
      });
      await newInterview.save();

      // Join a room so we can target this interview
      socket.join(newInterview._id.toString());
      socket.interviewId = newInterview._id.toString();

      socket.emit("interviewStarted", { interviewId: newInterview._id });
      console.log("Interview started:", newInterview._id);
    } catch (error) {
      console.error("joinInterview Error:", error);
      socket.emit("error", "Failed to start interview");
    }
  });

  // Event: User sends a chat message
  socket.on("chatMessage", async ({ message, interviewId }) => {
    try {
      // A. Retrieve interview + resume context
      const interview =
        await Interview.findById(interviewId).populate("resumeId");

      if (!interview) {
        socket.emit("error", "Interview not found");
        return;
      }

      const resumeText =
        interview.resumeId?.textContent || "No resume provided.";
      const jdText = interview.jobDescription || "";
      const questionLimit = interview.questionLimit || 5;

      // Count how many questions the AI has asked so far
      const aiMessageCount = interview.messages.filter(
        (m) => m.role === "model",
      ).length;

      const isLastQuestion = aiMessageCount >= questionLimit - 1;

      // B. Build the system prompt
      let systemPrompt = `You are an expert technical interviewer. You are conducting a live interview.
The candidate's resume:
---
${resumeText}
---
${jdText ? `The job description for the role:\n---\n${jdText}\n---` : ""}
Rules:
- Ask ONE question at a time, then wait for the candidate's answer.
- Base questions on the candidate's resume skills and experience.${jdText ? "\n- Also tailor questions to match the job description requirements." : ""}
- Start with easier questions and progressively increase difficulty.
- Keep responses concise (2-3 sentences max per turn).
- You have a limit of ${questionLimit} questions total.`;

      if (isLastQuestion) {
        systemPrompt += `\n- This is your LAST question. After the candidate answers, thank them and say the interview is complete. Do NOT ask another question.`;
      }

      // C. Build Gemini-format conversation history
      const contents = [];

      // System instruction as the first user turn
      contents.push({
        role: "user",
        parts: [{ text: systemPrompt }],
      });
      contents.push({
        role: "model",
        parts: [
          {
            text: "Understood. I'll conduct the interview following these guidelines. Let's begin.",
          },
        ],
      });

      // Append stored conversation history
      for (const msg of interview.messages) {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.content }],
        });
      }

      // Append the new user message
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      // D. Stream response from Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContentStream({ contents });

      let fullResponse = "";

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        socket.emit("aiResponseChunk", chunkText);
      }

      // E. Save messages to DB
      interview.messages.push({ role: "user", content: message });
      interview.messages.push({ role: "model", content: fullResponse });
      await interview.save();

      socket.emit("aiResponseComplete");

      // F. If question limit reached, generate feedback and end interview
      const updatedAiCount = interview.messages.filter(
        (m) => m.role === "model",
      ).length;

      if (updatedAiCount >= questionLimit) {
        console.log("Question limit reached, generating feedback...");

        const feedback = await generateFeedback(interview.messages);

        interview.status = "completed";
        interview.feedback = feedback;
        await interview.save();

        socket.emit("interviewComplete", feedback);
        console.log("Interview completed:", interviewId);
      }
    } catch (error) {
      console.error("chatMessage Error:", error);
      socket.emit("error", "Something went wrong during the interview");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
