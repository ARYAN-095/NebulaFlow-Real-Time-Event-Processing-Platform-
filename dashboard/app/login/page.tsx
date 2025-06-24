'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': process.env.NEXT_PUBLIC_MASTER_KEY!,
        },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || res.statusText);
      }
      const { token } = await res.json();
      localStorage.setItem('token', token);
      router.push('/'); // go to dashboard
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login / Select Tenant</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Tenant ID</label>
          <input
            type="text"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="e.g. tenant-1"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded"
          disabled={!tenantId}
        >
          Get Token &amp; Continue
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </form>
    </main>
  );
}
