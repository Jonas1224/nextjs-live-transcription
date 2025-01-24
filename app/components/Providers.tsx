'use client';

import { AuthContextProvider } from "../context/AuthContext";
import { DeepgramContextProvider } from "../context/DeepgramContextProvider";
import { MicrophoneContextProvider } from "../context/MicrophoneContextProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContextProvider>
      <MicrophoneContextProvider>
        <DeepgramContextProvider>{children}</DeepgramContextProvider>
      </MicrophoneContextProvider>
    </AuthContextProvider>
  );
} 