require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const pdf = require("pdf-parse");
const fs = require("fs");
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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- ROUTES ---

// Route 1: Upload & Parse Resume
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;

    // --- FIX: Use 'textContent' to match your Schema ---
    const newResume = new Resume({
      filename: req.file.originalname,
      textContent: extractedText, // <--- CHANGED from 'text' to 'textContent'
    });

    console.log("Saving Resume:", newResume); // Log it to check before saving
    await newResume.save();

    fs.unlinkSync(req.file.path);

    res.json({ message: "Resume processed", resumeId: newResume._id });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Failed to process resume" });
  }
});
// --- HELPER: The Grading Agent ---
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

  // Use our new robust parser
  const feedbackData = cleanAndParseJSON(text);

  // Fallback if AI fails completely
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

// Route: Start New Interview
app.post("/start", async (req, res) => {
  const { resumeId, limit } = req.body; // Receive limit
  const newInterview = new Interview({
    resumeId,
    messages: [],
    questionLimit: limit || 5, // Default to 5 if missing
  });
  await newInterview.save();
  res.json({ interviewId: newInterview._id });
});

// Route: Chat (Modified for Phase 3)
app.post("/chat", async (req, res) => {
  try {
    const { message, interviewId } = req.body;

    // 1. Fetch Interview Session
    const interview =
      await Interview.findById(interviewId).populate("resumeId");
    if (!interview)
      return res.status(404).json({ error: "Interview not found" });

    // 2. Add User Message to DB
    interview.messages.push({ role: "user", content: message });

    // 3. CHECK END CONDITION (e.g., 5 exchanges)
    // We count how many times the user has replied.
    // Check dynamic limit
    const userReplies = interview.messages.filter(
      (m) => m.role === "user",
    ).length;

    if (userReplies >= interview.questionLimit) {
      // --- END INTERVIEW MODE ---
      const feedback = await generateFeedback(interview.messages);

      interview.status = "completed";
      interview.feedback = feedback;
      interview.messages.push({
        role: "model",
        content: "Interview complete. Generating feedback...",
      });
      await interview.save();

      return res.json({
        reply: "Thank you for your time. The interview is now closed.",
        isComplete: true,
        feedback: feedback,
      });
    }

    // 4. CONTINUE INTERVIEW MODE
    // Build Context
    let contextInstruction = "";
    if (interview.resumeId) {
      contextInstruction = `Candidate Resume Context: "${interview.resumeId.textContent}"`;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `
            You are a strict but fair technical interviewer. 
            ${contextInstruction}
            
            GUIDELINES:
            1. Ask ONE question at a time.
            2. Do NOT be repetitive. If the candidate answered well, move to a new topic.
            3. If the candidate gives a very short or vague answer, ask a follow-up question like "Can you explain that in more detail?"
            4. Do NOT provide feedback (like "That is correct") yet. Just move to the next question.
            5. Keep your tone professional and neutral.
            `,
    });

    // Convert DB messages to Gemini API format
    const historyForGemini = interview.messages.map((m) => ({
      role: m.role, // 'user' or 'model'
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: historyForGemini });
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    // 5. Save AI Response to DB
    interview.messages.push({ role: "model", content: aiResponse });
    await interview.save();

    res.json({
      reply: aiResponse,
      isComplete: false,
    });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// Helper: Clean and Parse JSON from AI
function cleanAndParseJSON(text) {
  // 1. Remove markdown code blocks (e.g., ```json ... ```)
  let cleanText = text.replace(/```json/g, "").replace(/```/g, "");

  // 2. Find the first '{' and the last '}'
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  // 3. Parse
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error. Raw text:", text);
    return null; // Return null so we can handle the error gracefully
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
