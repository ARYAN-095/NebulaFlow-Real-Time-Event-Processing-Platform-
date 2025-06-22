'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LiveChart from '@/components/LiveChart';

export default function Home() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
    } else {
      setIsReady(true);
    }
  }, [router]);

  if (!isReady) {
    return <p className="text-center mt-10">🔒 Redirecting to login...</p>;
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-4 text-center">
        🌡️ IoT Live Dashboard
      </h1>
      <LiveChart />
    </main>
  );
}
