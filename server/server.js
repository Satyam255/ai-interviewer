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

// Route: Upload & Parse Resume (kept as HTTP — file uploads don't benefit from WS)
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;

    const newResume = new Resume({
      filename: req.file.originalname,
      textContent: extractedText,
    });

    console.log("Saving Resume:", newResume);
    await newResume.save();

    fs.unlinkSync(req.file.path);

    res.json({ message: "Resume processed", resumeId: newResume._id });
  } catch (error) {
    console.error("Upload Error:", error);
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
