'use client';

import { useEffect, useState } from 'react';

type Device = {
  device_id: string;
  label: string;
  created_at?: string;
};

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL!;

  // Load token from localStorage in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('token');
      if (stored) setToken(stored);
    }
  }, []);

  // Fetch devices once token is available
 useEffect(() => {
  if (!token) return;
  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDevices(data);
    } catch {
      setError('Failed to fetch devices');
    }
  })();
}, [token, API_URL]);

  const addDevice = async () => {
    if (!deviceId || !label) return;
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ device_id: deviceId, label }),
      });
      if (!res.ok) throw new Error();
      setDeviceId('');
      setLabel('');
      // Refresh list
      const res2 = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res2.json();
      setDevices(data);
    } catch {
      setError('Failed to add device');
    }
  };

  return (
    <div className="p-4 border rounded shadow bg-white">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">🧩 Devices</h2>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      <ul className="mb-4 space-y-2">
        {devices.map(d => (
          <li key={d.device_id} className="text-gray-700">
            <strong>{d.device_id}</strong> — {d.label}
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
        <input
          type="text"
          placeholder="Device ID"
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
          className="border p-2 flex-1 text-gray-800 rounded"
        />
        <input
          type="text"
          placeholder="Label"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="border p-2 flex-1 text-gray-800 rounded"
        />
        <button
          onClick={addDevice}
          disabled={!deviceId || !label}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          ➕ Add Device
        </button>
      </div>
    </div>
  );
}
