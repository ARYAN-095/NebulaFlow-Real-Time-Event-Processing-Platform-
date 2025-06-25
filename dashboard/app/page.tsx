'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LiveChart from '@/components/LiveChart';
import DeviceManager from '@/components/DeviceManager';

export default function Home() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  useEffect(() => {
    // Redirect to login if token is missing
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">🌡️ IoT Live Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>

      <LiveChart />
      <DeviceManager />
    </main>
  );
}
