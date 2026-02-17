import { useState, useEffect, useRef, useCallback } from "react";

const useSpeechToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const onEndCallbackRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "en-US";

      recog.onstart = () => setIsListening(true);

      recog.onend = () => {
        setIsListening(false);
      };

      recog.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        // Fire the onEnd callback with the recognized text
        if (onEndCallbackRef.current) {
          onEndCallbackRef.current(text);
        }
      };

      recog.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recog;
    } else {
      alert("Browser does not support speech recognition. Try Chrome.");
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Let the consumer register a callback for when speech recognition
  // produces a final result. This is used for auto-send.
  const setOnResult = useCallback((callback) => {
    onEndCallbackRef.current = callback;
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript: () => setTranscript(""),
    setOnResult,
  };
};

export default useSpeechToText;
