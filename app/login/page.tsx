'use client';

import AuthUI from '../components/Auth/AuthUI';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import Image from 'next/image';

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    // Check if the URL is an email sign-in link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation');
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            router.push('/');
          })
          .catch((error) => {
            setError(error.message);
          });
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white bg-app relative">
      <div className="absolute top-16 right-20">
        <Image 
          src="/action.png" 
          alt="decorative"
          width={720}
          height={250}
          className="w-[720px] h-auto"
          priority={false}
        />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          上课开会偷个懒 
        </h1>
        <p className="mt-2 text-gray-600">
          {isSignUp ? '创建账号开始使用' : '登录账号继续使用'}
        </p>
      </div>

      <div className="max-w-md w-full p-6 bg-white/90 rounded-lg shadow-sm border backdrop-blur-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isSignUp ? '注册' : '登录'}
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        <AuthUI onModeChange={(mode) => setIsSignUp(mode)} />
      </div>
    </div>
  );
} 