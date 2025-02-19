'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/app/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from 'firebase/auth';

// Add prop type for onModeChange
interface AuthUIProps {
  onModeChange: (isSignUp: boolean) => void;
}

export default function AuthUI({ onModeChange }: AuthUIProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  // Commented out but kept for reference
  // const [verificationSent, setVerificationSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isSignUp) {
        /* Commented out email verification flow
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Send verification email
        await sendEmailVerification(userCredential.user, {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        });
        
        setVerificationSent(true);
        */

        // New simplified signup without verification
        await createUserWithEmailAndPassword(auth, email, password);
        router.push('/');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/');
      }
    } catch (error: any) {
      setError(error.message);
      console.error('Auth error:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      setError(error.message);
      console.error('Google auth error:', error);
    }
  };

  // Update mode change handler
  const handleModeChange = () => {
    const newMode = !isSignUp;
    setIsSignUp(newMode);
    onModeChange(newMode);
  };

  return (
    <div className="space-y-6">
      {/* Commented out verification message
      {verificationSent ? (
        <div className="text-center p-4 bg-green-50 rounded-md">
          <p className="text-green-800">
            Please check your email to verify your account.
            You can sign in after verifying your email address.
          </p>
        </div>
      ) : (
      */}
      
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          {isSignUp ? '注册' : '登录'}
        </button>
      </form>

      {/* Commented out closing tags for verification message
      )} */}
      {/*}
      <button
        onClick={handleGoogleSignIn}
        className="w-full bg-white text-gray-700 border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button> */}

      <div className="text-center">
        <button
          onClick={handleModeChange}
          className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
        >
          {isSignUp ? '已经有帐号了？那直接登录' : '没有账号？那就注册一个'}
        </button>
      </div>
    </div>
  );
} 