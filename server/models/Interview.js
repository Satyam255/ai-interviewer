const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume" },
  questionLimit: { type: Number, default: 5 },
  messages: [
    {
      role: String, // 'user' or 'model'
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  status: { type: String, default: "ongoing" }, // 'ongoing' or 'completed'
  feedback: {
    technicalScore: Number, // 0-10
    communicationScore: Number, // 0-10
    strengths: [String],
    weaknesses: [String],
    summary: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Interview", interviewSchema);
