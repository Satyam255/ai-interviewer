import { useState, useCallback, useRef } from "react";

const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const onEndCallbackRef = useRef(null);

  const speak = useCallback((text) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        // Fire callback so the app can auto-start listening
        if (onEndCallbackRef.current) {
          onEndCallbackRef.current();
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Browser does not support text-to-speech.");
    }
  }, []);

  // Let the consumer register a callback for when speech finishes
  const setOnSpeechEnd = useCallback((callback) => {
    onEndCallbackRef.current = callback;
  }, []);

  return { speak, isSpeaking, setOnSpeechEnd };
};

export default useTextToSpeech;
