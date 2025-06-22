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

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // ✅ Load token from localStorage (only in browser)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) setToken(storedToken);
    }
  }, []);

  // ✅ Fetch devices once token is ready
  useEffect(() => {
    if (!token) return;

    const fetchDevices = async () => {
      try {
        const res = await fetch(`${API_URL}/api/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setDevices(data);
      } catch (err) {
        setError('Failed to fetch devices');
      }
    };

    fetchDevices();
  }, [token]);

  const addDevice = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ device_id: deviceId, label }),
      });

      if (!res.ok) throw new Error('Add failed');
      setDeviceId('');
      setLabel('');
      // refresh devices
      const res2 = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res2.json();
      setDevices(data);
    } catch (err) {
      setError('Failed to add device');
    }
  };

  return (
    <div className="p-4 border rounded shadow bg-white">
      <h2 className="border p-1 mr-2 text-gray-800 bg-white hover:border-blue-500 focus:border-blue-500 focus:outline-none">🧩 Devices</h2>

      <ul className="mb-4">
        {devices.map((d) => (
          <li key={d.device_id}>
            <strong>{d.device_id}</strong> — {d.label}
          </li>
        ))}
      </ul>

      <input
  type="text"
  placeholder="Device ID"
  value={deviceId}
  onChange={(e) => setDeviceId(e.target.value)}
  className="border p-1 mr-2 text-gray-800"  // Added text-gray-800
/>
<input
  type="text"
  placeholder="Label"
  value={label}
  onChange={(e) => setLabel(e.target.value)}
  className="border p-1 mr-2 text-gray-800"  // Added text-gray-800
/>
      <button
        onClick={addDevice}
        className="bg-blue-600 text-white px-3 py-1 rounded"
        disabled={!deviceId || !label}
      >
        ➕ Add Device
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
