import { useState, useEffect } from "react";

const useSpeechToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false; // Stop after one sentence
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      setRecognition(recognition);
    } else {
      alert("Browser does not support speech recognition. Try Chrome.");
    }
  }, []);

  const startListening = () => {
    if (recognition) recognition.start();
  };

  const stopListening = () => {
    if (recognition) recognition.stop();
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript: () => setTranscript(""),
  };
};

export default useSpeechToText;
