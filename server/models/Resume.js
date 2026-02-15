const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  filename: String,
  textContent: String, // <--- LOOK HERE. It expects "textContent"
  skills: [String],
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Resume", resumeSchema);
