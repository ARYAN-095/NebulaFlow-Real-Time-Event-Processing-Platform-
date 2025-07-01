'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

type TokenPayload = {
  tenant_id: string;
  exp: number;
};

export default function Navbar() {
  const router = useRouter();
  const [tenant, setTenant] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = jwtDecode<TokenPayload>(token);
        setTenant(payload.tenant_id);
      } catch {
        console.error('Invalid token');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <nav className="flex justify-between items-center px-6 py-4 bg-gray-800 text-white shadow">
      <div className="text-xl font-semibold">🌐 NebulaFlow</div>
      <div className="flex items-center gap-4">
        {tenant && (
          <span className="text-sm text-gray-200">
            Tenant: <span className="font-medium">{tenant}</span>
          </span>
        )}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
