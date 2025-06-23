'use client';

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Reading = { t: number; temp: number; hum: number };
type Device  = { device_id: string; label: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const WS_URL  = process.env.NEXT_PUBLIC_WS_URL!;

let socket: Socket;

/** Generic authenticated fetcher */
const fetcher = (url: string) => {
  const token = localStorage.getItem('token');
  if (!token) return Promise.reject(new Error('No auth token'));
  return fetch(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
};

export default function LiveChart() {
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [data, setData] = useState<Reading[]>([]);

  // Fetch devices for the dropdown
  const { data: devices } = useSWR<Device[]>('/api/devices', fetcher);

  // Fetch historical data for the selected device
  const { data: history, error } = useSWR<Reading[]>(
    selectedDevice ? `/api/history?since=60&device_id=${selectedDevice}` : null,
    fetcher
  );

  // Initialize chart data when history loads
  useEffect(() => {
    if (history) {
      setData(history);
    }
  }, [history]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!selectedDevice) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect_error', err => {
      console.error('Socket error:', err.message);
    });

    socket.on('new_reading', (msg: any) => {
      // msg.deviceId comes from your simulator → Kafka pipeline
      if (msg.deviceId !== selectedDevice) return;
      const reading: Reading = {
        t: Number(msg.timestamp),
        temp: Number(msg.temperature),
        hum:  Number(msg.humidity),
      };
      setData(prev => [...prev.slice(-99), reading]);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedDevice]);

  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700">Select Device:</label>
        <select
          className="border rounded px-3 py-2 w-full md:w-1/2 text-gray-800"
          value={selectedDevice}
          onChange={e => setSelectedDevice(e.target.value)}
        >
          <option value="">-- Choose a device --</option>
          {devices?.map(d => (
            <option key={d.device_id} value={d.device_id}>
              {d.label} ({d.device_id})
            </option>
          ))}
        </select>
      </div>

      {selectedDevice ? (
        <div className="w-full h-[400px]">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['auto', 'auto']}
                tickFormatter={t => new Date(t).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip labelFormatter={t => new Date(t).toLocaleTimeString()} />
              <Legend />
              <Line dataKey="temp" name="Temperature (°C)" stroke="#f97316" dot={false} />
              <Line dataKey="hum"  name="Humidity (%)"     stroke="#3b82f6" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-600">Please select a device to view the chart.</p>
      )}
    </div>
  );
}
