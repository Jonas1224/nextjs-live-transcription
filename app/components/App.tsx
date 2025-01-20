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
  const [summary, setSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showLineBreaks, setShowLineBreaks] = useState(false);

  // Batch size and timer configurations
  const BATCH_SIZE = 5; // Number of transcripts to collect before translating
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
    if (targetLanguage === 'Original' || textsToTranslate.length === 0) {
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

  // Modified onTranscript function with fixed batching
  const onTranscript = (data: LiveTranscriptionEvent) => {
    const { is_final: isFinal } = data;
    let thisCaption = data.channel.alternatives[0].transcript;

    if (thisCaption !== "" && isFinal) {
      setTranscripts(prev => [...prev, thisCaption]);
      
      // Add to pending transcripts and process
      setPendingTranscripts(prev => {
        const newPending = [...prev, thisCaption];
        
        // Clear any existing timeout
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }

        // If we have enough transcripts, translate immediately
        if (newPending.length >= BATCH_SIZE) {
          // Process in the next tick to avoid state update conflicts
          setTimeout(() => {
            translateBatch(newPending);
            setPendingTranscripts([]); // Clear pending after translation
          }, 0);
          return []; // Clear pending immediately
        }

        // Set new timeout for remaining transcripts
        batchTimeoutRef.current = setTimeout(() => {
          if (newPending.length > 0) {
            translateBatch(newPending);
            setPendingTranscripts([]); // Clear pending after timeout translation
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

  const generateSummary = async () => {
    if (transcripts.length === 0) return;
    
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: transcripts.join(' ')
        }),
      });

      const data = await response.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <>
      <div className="flex h-full antialiased">
        <div className="flex flex-col h-full w-full overflow-x-hidden p-4">
          {/* Control button and language selector */}
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-4">
              <span className="text-gray-700 font-medium">
                Target Language:
              </span>
              <select
                value={targetLanguage}
                onChange={(e) => {
                  setTargetLanguage(e.target.value);
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

              {/* Add format toggle button */}
              <button
                onClick={() => setShowLineBreaks(!showLineBreaks)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-800 font-medium hover:bg-gray-50"
              >
                {showLineBreaks ? 'Show Continuous' : 'Show Segments'}
              </button>
            </div>
          </div>

          {/* Main content container */}
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {/* Transcription & Translation section */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Transcription & Translation</h2>
              </div>
              
              <div className="p-6">
                <div className={`${targetLanguage === 'Original' ? '' : 'grid grid-cols-2 gap-6'}`}>
                  {/* Original text */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-gray-700">Original Text</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 min-h-[300px]">
                      {transcripts.length > 0 ? (
                        <div className={showLineBreaks ? 'space-y-2' : ''}>
                          {transcripts.map((transcript, index) => (
                            <span 
                              key={index} 
                              className={`text-gray-700 ${showLineBreaks ? 'block' : 'inline'}`}
                            >
                              {transcript}
                              {!showLineBreaks && index < transcripts.length - 1 && ' '}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500">No transcription yet...</div>
                      )}
                    </div>
                  </div>

                  {/* Translated text */}
                  {targetLanguage !== 'Original' && (
                    <div>
                      <div className="mb-4">
                        <h3 className="text-xl font-semibold text-gray-700">Translated Text</h3>
                      </div>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 min-h-[300px]">
                        {translations.length > 0 ? (
                          <div className={showLineBreaks ? 'space-y-2' : ''}>
                            {translations.map((translation, index) => (
                              <span 
                                key={index} 
                                className={`text-gray-700 ${showLineBreaks ? 'block' : 'inline'}`}
                              >
                                {translation}
                                {!showLineBreaks && index < translations.length - 1 && ' '}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500">No translation yet...</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary section */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Summary & Key Points</h2>
                <button
                  onClick={generateSummary}
                  disabled={isSummarizing || transcripts.length === 0}
                  className={`px-4 py-2 rounded-md font-medium ${
                    transcripts.length === 0
                      ? 'bg-gray-300 cursor-not-allowed'
                      : isSummarizing
                      ? 'bg-blue-400 cursor-wait'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white transition-colors`}
                >
                  {isSummarizing ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
              <div className="p-6 min-h-[200px]">
                {summary ? (
                  <div className="whitespace-pre-wrap text-gray-700">
                    {summary}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center">
                    Click "Generate Summary" to get a summary and key points of the transcript
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Audio visualizer */}
          <div className="absolute bottom-0 left-0 right-0 h-16 opacity-0">
            {microphone && <Visualizer microphone={microphone} />}
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
