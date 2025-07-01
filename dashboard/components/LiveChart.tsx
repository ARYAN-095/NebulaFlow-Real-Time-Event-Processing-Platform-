'use client';

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Reading = { t: number; temp: number; hum: number };
type Device = { device_id: string; label: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL!;

let socket: Socket;

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
  const [mode, setMode] = useState<'raw' | '1m' | '5m'>('raw');
  const [data, setData] = useState<Reading[]>([]);
  const [showTemp, setShowTemp] = useState(true);
  const [showHum, setShowHum] = useState(true);

  const { data: devices } = useSWR<Device[]>('/api/devices', fetcher);

  const path = selectedDevice
    ? mode === 'raw'
      ? `/api/history?since=60&device_id=${selectedDevice}`
      : `/api/aggregates?since=60&window=${mode === '1m' ? '1 minute' : '5 minute'}&device_id=${selectedDevice}`
    : null;

  const { data: series, error } = useSWR<Reading[]>(path, fetcher);

  useEffect(() => {
    if (series) setData(series);
  }, [series]);

  useEffect(() => {
    if (!selectedDevice || mode !== 'raw') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect_error', (err: Error) => {
      console.error('Socket error:', err.message);
    });

    socket.on('new_reading', (msg: {
      deviceId: string;
      timestamp: number;
      temperature: number;
      humidity: number;
    }) => {
      if (msg.deviceId !== selectedDevice) return;
      const reading: Reading = {
        t: Number(msg.timestamp),
        temp: Number(msg.temperature),
        hum: Number(msg.humidity),
      };
      setData(prev => [...prev.slice(-99), reading]);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedDevice, mode]);

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token');

      const w = mode === '1m'
        ? '1 minute'
        : mode === '5m'
        ? '5 minute'
        : '';
      const url = `${API_URL}/api/aggregates?since=60${
        w ? `&window=${encodeURIComponent(w)}` : ''
      }&device_id=${selectedDevice}&download=true`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const blob = await res.blob();
      const filename = `aggregates_${selectedDevice}_${mode}.csv`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      const e = err as Error;
      console.error('CSV download error:', e);
      alert(`Download error: ${e.message}`);
    }
  };

  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="space-y-4">
      {/* Device selector */}
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

      {/* Mode & Download controls */}
      {selectedDevice && (
        <div className="flex items-center space-x-4 mb-2">
          {/* Mode toggle */}
          <div className="flex space-x-2">
            {[
              { key: 'raw', label: 'Raw' },
              { key: '1m', label: '1-min Avg' },
              { key: '5m', label: '5-min Avg' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key as 'raw' | '1m' | '5m')}
                className={`px-3 py-1 rounded ${
                  mode === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Download CSV */}
          <button
            onClick={handleDownload}
            className="ml-auto px-3 py-1 bg-green-600 text-white rounded"
          >
            Download CSV
          </button>
        </div>
      )}

      {/* Legend toggles */}
      {selectedDevice && (
        <div className="flex gap-4 items-center mb-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showTemp}
              onChange={() => setShowTemp(prev => !prev)}
            />
            <span className="text-orange-500">Temperature</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showHum}
              onChange={() => setShowHum(prev => !prev)}
            />
            <span className="text-blue-500">Humidity</span>
          </label>
        </div>
      )}

      {/* Chart */}
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
              {showTemp && (
                <Line
                  dataKey="temp"
                  name={mode === 'raw' ? 'Temp (°C)' : `${mode}-avg Temp`}
                  stroke="#f97316"
                  dot={false}
                />
              )}
              {showHum && (
                <Line
                  dataKey="hum"
                  name={mode === 'raw' ? 'Hum (%)' : `${mode}-avg Hum`}
                  stroke="#3b82f6"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-600">Please select a device to view the chart.</p>
      )}
    </div>
  );
}
