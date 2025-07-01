'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const MASTER_KEY = process.env.NEXT_PUBLIC_MASTER_KEY!;

const fetcher = async (url: string): Promise<string[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function LoginPage() {
  const router = useRouter();
  const { data: tenants, error } = useSWR<string[]>(
    '/api/tenants',
    (url: string) => fetcher(API_URL + url)
  );

  const [tenant, setTenant] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      if (!isExpired && window.location.pathname === '/login') {
        router.push('/');
      } else {
        localStorage.removeItem('token');
      }
    } catch {
      localStorage.removeItem('token');
    }
  }, [router]);

  const handleLogin = async () => {
    if (!tenant) {
      setErrMsg('Please select a tenant');
      return;
    }

    setErrMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': MASTER_KEY,
        },
        body: JSON.stringify({ tenant_id: tenant }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || res.statusText);
      }

      const { token } = await res.json();
      localStorage.setItem('token', token);
      router.push('/');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErrMsg(e.message);
      } else {
        setErrMsg('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasMounted) return null;
  if (error) return <p className="p-6 text-red-500">Failed to load tenants</p>;
  if (!tenants) return <p className="p-6">Loading tenants…</p>;

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Choose your Tenant</h1>
      <select
        className="w-full border rounded px-3 py-2 mb-4"
        value={tenant}
        onChange={(e) => setTenant(e.target.value)}
      >
        <option value="">— select tenant —</option>
        {tenants.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {errMsg && <p className="text-red-500 mb-2">{errMsg}</p>}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </div>
  );
}
