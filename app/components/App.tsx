"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "../context/MicrophoneContextProvider";
import Visualizer from "./Visualizer";

const App: () => JSX.Element = () => {
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [pendingTranscripts, setPendingTranscripts] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Original'); // Changed default to Original
  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState } = useMicrophone();
  const keepAliveInterval = useRef<any>();

  // Batch size and timer configurations
  const BATCH_SIZE = 3; // Number of transcripts to collect before translating
  const BATCH_TIMEOUT = 5000; // 10 seconds
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = async () => {
    if (!isListening) {
      // Start listening
      if (microphoneState === MicrophoneState.Ready || microphoneState === MicrophoneState.Paused) {
        try {
          await connectToDeepgram({
            model: "nova-2",
            interim_results: true,
            smart_format: true,
            filler_words: true,
            utterance_end_ms: 3000,
          });
          setIsListening(true);
        } catch (error) {
          console.error("Failed to connect:", error);
          // Reset states on error
          await stopMicrophone();
          await disconnectFromDeepgram();
          await setupMicrophone(); // Re-setup microphone
          setIsListening(false);
        }
      } else {
        // If microphone isn't ready, try to set it up again
        await setupMicrophone();
      }
    } else {
      // Stop listening
      await stopMicrophone();
      await disconnectFromDeepgram();
      await setupMicrophone(); // Re-setup microphone for next use
      setIsListening(false);
    }
  };

  // Function to translate multiple transcripts at once
  const translateBatch = async (textsToTranslate: string[]) => {
    // Skip translation if 'Original' is selected
    if (targetLanguage === 'Original') {
      return;
    }

    try {
      const combinedText = textsToTranslate.join(' ');
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: combinedText,
          targetLanguage,
        }),
      });

      const data = await response.json();
      if (data.translation) {
        setTranslations(prev => [...prev, data.translation]);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  };

  // Modified onTranscript function
  const onTranscript = (data: LiveTranscriptionEvent) => {
    const { is_final: isFinal } = data;
    let thisCaption = data.channel.alternatives[0].transcript;

    if (thisCaption !== "" && isFinal) {
      setTranscripts(prev => [...prev, thisCaption]);
      
      // Add to pending transcripts and process immediately if batch size reached
      setPendingTranscripts(prev => {
        const newPending = [...prev, thisCaption];
        
        // If we have enough transcripts, translate immediately
        if (newPending.length >= BATCH_SIZE) {
          translateBatch(newPending);
          return []; // Clear the pending transcripts
        }

        // Otherwise, set a timeout for remaining transcripts
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }

        batchTimeoutRef.current = setTimeout(() => {
          if (newPending.length > 0) {
            translateBatch(newPending);
            setPendingTranscripts([]); // Clear pending transcripts
          }
        }, BATCH_TIMEOUT);

        return newPending;
      });
    }
  };

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      if (e.data.size > 0) {
        connection?.send(e.data);
      }
    };

    if (connectionState === LiveConnectionState.OPEN && isListening) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
      startMicrophone();
    }

    return () => {
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, isListening]);

  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState]);

  return (
    <>
      <div className="flex h-full antialiased">
        <div className="flex flex-row h-full w-full overflow-x-hidden">
          <div className="flex flex-col flex-auto h-full">
            <div className="relative w-full h-full p-4">
              {/* Control button and language selector */}
              <div className="mb-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-gray-700 font-medium">
                    Target Language:
                  </span>
                  <select
                    value={targetLanguage}
                    onChange={(e) => {
                      setTargetLanguage(e.target.value);
                      // Clear translations when switching to Original
                      if (e.target.value === 'Original') {
                        setTranslations([]);
                      }
                    }}
                    className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-800 font-medium shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="Original">Original</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Spanish">Spanish</option>
                  </select>

                  <button
                    onClick={toggleListening}
                    className={`px-6 py-2 rounded-full font-semibold ${
                      isListening 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white transition-colors`}
                  >
                    {isListening ? 'Stop Listening' : 'Start Listening'}
                  </button>
                </div>
              </div>

              {/* Original and translated text sections */}
              <div className={`max-w-4xl mx-auto ${targetLanguage === 'Original' ? '' : 'grid grid-cols-2 gap-6'}`}>
                {/* Original text */}
                <div>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Original Text</h2>
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 min-h-[300px]">
                    {transcripts.length > 0 ? (
                      transcripts.map((transcript, index) => (
                        <div key={index} className="mb-2 text-gray-700">
                          {transcript}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500">No transcription yet...</div>
                    )}
                  </div>
                </div>

                {/* Translated text - only show if not Original */}
                {targetLanguage !== 'Original' && (
                  <div>
                    <div className="mb-4">
                      <h2 className="text-2xl font-bold text-gray-800">Translated Text</h2>
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 min-h-[300px]">
                      {translations.length > 0 ? (
                        translations.map((translation, index) => (
                          <div key={index} className="mb-2 text-gray-700">
                            {translation}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500">No translation yet...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio visualizer */}
              <div className="absolute bottom-0 left-0 right-0 h-16 opacity-0">
                {microphone && <Visualizer microphone={microphone} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
