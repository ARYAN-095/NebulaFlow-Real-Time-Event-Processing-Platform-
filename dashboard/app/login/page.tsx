'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  const handleLogin = () => {
    localStorage.setItem('token', token);
    router.push('/');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen px-4">
      <h1 className="text-2xl font-bold mb-4">Paste Your JWT Token</h1>
      <textarea
        className="w-full max-w-md h-32 p-3 border rounded mb-4"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        onClick={handleLogin}
      >
        Save & Continue
      </button>
    </div>
  );
}
