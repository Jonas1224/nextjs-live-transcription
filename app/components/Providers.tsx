'use client';

import { AuthContextProvider } from "../context/AuthContext";
import { MicrophoneContextProvider } from "../context/MicrophoneContextProvider";
import { DeepgramContextProvider } from "../context/DeepgramContextProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContextProvider>
      <MicrophoneContextProvider>
        <DeepgramContextProvider>
          {children}
        </DeepgramContextProvider>
      </MicrophoneContextProvider>
    </AuthContextProvider>
  );
} 