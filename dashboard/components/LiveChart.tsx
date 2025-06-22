'use client';

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Reading = { t: number; temp: number; hum: number };

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const WS_URL  = process.env.NEXT_PUBLIC_WS_URL!;

let socket: Socket;

/** Authenticated fetcher for SWR */
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
  const [data, setData] = useState<Reading[]>([]);

  // 1️⃣ Fetch historical data from /api/history (returns { t, temp, hum }[])
  const { data: history, error } = useSWR<Reading[]>(
    '/api/history?since=60',
    fetcher
  );

  // 2️⃣ Initialize with historical data
  useEffect(() => {
    if (history) {
      console.log('✅ Historical data:', history);
      setData(history);
    }
  }, [history]);

  // 3️⃣ Connect WebSocket for real-time "new_reading" events
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'] // force websocket
    });

    socket.on('connect_error', err => {
      console.error('Socket connection error:', err.message);
    });

    socket.on('new_reading', (msg: any) => {
      // msg should be { t, temp, hum }
      const reading: Reading = {
        t: Number(msg.t),
        temp: Number(msg.temp),
        hum:  Number(msg.hum),
      };
      console.log('📡 New reading:', reading);
      setData(prev => [...prev.slice(-99), reading]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (error) return <p className="text-red-500">Error: {error.message}</p>;
  if (!history) return <p>Loading…</p>;

  return (
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
  );
}
