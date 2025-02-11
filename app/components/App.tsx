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

type DownloadContent = {
  transcript: boolean;
  translation: boolean;
  summary: boolean;
};

const formatContent = (
  transcripts: string[],
  translations: string[],
  summary: string,
  selection: DownloadContent
): string => {
  let content = '';
  
  if (selection.transcript) {
    content += '# Original Text\n\n';
    content += transcripts.join(' ') + '\n\n';
  }
  
  if (selection.translation) {
    content += '# Translated Text\n\n';
    content += translations.join(' ') + '\n\n';
  }
  
  if (selection.summary) {
    content += '# Summary\n\n';
    content += summary + '\n';
  }
  
  return content;
};

const App: () => JSX.Element = () => {
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [pendingTranscripts, setPendingTranscripts] = useState<string[]>([]);
  const [processedTranscripts, setProcessedTranscripts] = useState<Set<string>>(new Set());
  const [isListening, setIsListening] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Original'); // Changed default to Original
  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState } = useMicrophone();
  const keepAliveInterval = useRef<any>();
  const [summary, setSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState<DownloadContent>({
    transcript: true,
    translation: true,
    summary: true,
  });

  // Batch size and timer configurations
  const BATCH_SIZE = 5; // Number of transcripts to collect before translating
  const BATCH_TIMEOUT = 5000; // 10 seconds
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Add a constant for group size
  const TRANSCRIPTS_PER_LINE = 6; // or 4, depending on preference

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

  // Modified translateBatch function without logs
  const translateBatch = async (textsToTranslate: string[]) => {
    if (targetLanguage === 'Original' || textsToTranslate.length === 0) {
      return;
    }

    const newTexts = textsToTranslate.filter(text => !processedTranscripts.has(text));
    if (newTexts.length === 0) return;

    try {
      const combinedText = newTexts.join(' ');
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combinedText, targetLanguage }),
      });

      const data = await response.json();
      if (data.translation) {
        const newProcessed = new Set(processedTranscripts);
        newTexts.forEach(text => newProcessed.add(text));
        setProcessedTranscripts(newProcessed);
        setTranslations(prev => [...prev, data.translation]);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  };

  // Modified onTranscript function without logs
  const onTranscript = (data: LiveTranscriptionEvent) => {
    const { is_final: isFinal } = data;
    let thisCaption = data.channel.alternatives[0].transcript;

    if (thisCaption !== "" && isFinal) {
      setTranscripts(prev => [...prev, thisCaption]);
      
      if (!processedTranscripts.has(thisCaption)) {
        setPendingTranscripts(prev => {
          const newPending = [...prev, thisCaption];
          
          if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
            batchTimeoutRef.current = undefined;
          }

          // For batch size case, just return empty array
          if (newPending.length >= BATCH_SIZE) {
            if (!batchTimeoutRef.current) {
              batchTimeoutRef.current = setTimeout(() => {
                translateBatch([...newPending]);
                batchTimeoutRef.current = undefined;
              }, 0);
            }
            return [];
          }

          // For timeout case
          batchTimeoutRef.current = setTimeout(() => {
            translateBatch([...newPending]);
            setPendingTranscripts([]);
          }, BATCH_TIMEOUT);

          return newPending;
        });
      }
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

  // Add cleanup for language change
  useEffect(() => {
    // Clear translations and processed transcripts when language changes
    setTranslations([]);
    setProcessedTranscripts(new Set());
    setPendingTranscripts([]);
  }, [targetLanguage]);

  const handleDownload = () => {
    const content = formatContent(transcripts, translations, summary, downloadSelection);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription-content.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                          {showLineBreaks ? (
                            // Group transcripts when showing line breaks
                            Array.from({ length: Math.ceil(transcripts.length / TRANSCRIPTS_PER_LINE) }).map((_, groupIndex) => (
                              <div key={groupIndex} className="block">
                                {transcripts
                                  .slice(groupIndex * TRANSCRIPTS_PER_LINE, (groupIndex + 1) * TRANSCRIPTS_PER_LINE)
                                  .map((transcript, index) => (
                                    <span key={index} className="text-gray-700">
                                      {transcript}
                                      {index < TRANSCRIPTS_PER_LINE - 1 && ' '}
                                    </span>
                                  ))}
                              </div>
                            ))
                          ) : (
                            // Original continuous display
                            transcripts.map((transcript, index) => (
                              <span 
                                key={index} 
                                className="text-gray-700 inline"
                              >
                                {transcript}
                                {index < transcripts.length - 1 && ' '}
                              </span>
                            ))
                          )}
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

            {/* Download content section - moved here */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Download Content</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-6 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={downloadSelection.transcript}
                      onChange={(e) => setDownloadSelection(prev => ({
                        ...prev,
                        transcript: e.target.checked
                      }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-gray-700">Original Text</span>
                  </label>
                  
                  {targetLanguage !== 'Original' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={downloadSelection.translation}
                        onChange={(e) => setDownloadSelection(prev => ({
                          ...prev,
                          translation: e.target.checked
                        }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Translation</span>
                    </label>
                  )}
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={downloadSelection.summary}
                      onChange={(e) => setDownloadSelection(prev => ({
                        ...prev,
                        summary: e.target.checked
                      }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-gray-700">Summary</span>
                  </label>
                </div>
                
                <button
                  onClick={handleDownload}
                  disabled={!downloadSelection.transcript && !downloadSelection.translation && !downloadSelection.summary}
                  className={`px-4 py-2 rounded-md font-medium ${
                    !downloadSelection.transcript && !downloadSelection.translation && !downloadSelection.summary
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white transition-colors`}
                >
                  Download Selected Content
                </button>
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
