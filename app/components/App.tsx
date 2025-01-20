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
  const [isListening, setIsListening] = useState(false);
  const { connection, connectToDeepgram, disconnectFromDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, stopMicrophone, microphoneState } = useMicrophone();
  const keepAliveInterval = useRef<any>();

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

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      if (e.data.size > 0) {
        connection?.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      if (thisCaption !== "") {
        if (isFinal) {
          setTranscripts(prev => [...prev, thisCaption]);
        }
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
            <div className="relative w-full h-full">
              {microphone && <Visualizer microphone={microphone} />}
              
              {/* Add control button */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
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

              {/* Transcript display */}
              <div className="absolute bottom-[8rem] inset-x-0 max-w-4xl mx-auto text-center">
                <div className="bg-black/70 p-8 max-h-[60vh] overflow-y-auto">
                  {transcripts.map((transcript, index) => (
                    <div key={index} className="mb-2">
                      {transcript}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
