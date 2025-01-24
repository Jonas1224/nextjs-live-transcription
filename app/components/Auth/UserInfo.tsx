'use client';

import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/app/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function UserInfo() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="absolute top-4 right-4 flex items-center gap-4">
      <span className="text-gray-700 font-medium">
        {user?.email}
      </span>
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
      >
        Logout
      </button>
    </div>
  );
} 