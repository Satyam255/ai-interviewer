import { useState, useEffect } from "react";

const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1; // Normal speed (0.1 to 10)
      utterance.pitch = 1; // Normal pitch (0 to 2)

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Browser does not support text-to-speech.");
    }
  };

  return { speak, isSpeaking };
};

export default useTextToSpeech;
