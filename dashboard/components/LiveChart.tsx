'use client';

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Reading = {
  t: number;
  temp: number;
  hum: number;
};

const fetcher = (url: string) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`).then(res => res.json());

let socket: Socket;

export default function LiveChart() {
  const [data, setData] = useState<Reading[]>([]);

  // 1️⃣ Fetch historical data
  const { data: history, error } = useSWR<Reading[]>(
    '/api/history?since=60',
    fetcher,
    { refreshInterval: 0 }
  );

  useEffect(() => {
    if (history) setData(history);
  }, [history]);

  // 2️⃣ Connect WebSocket once
  useEffect(() => {
    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_WS_URL!);
    }

    socket.on('new_reading', (msg: Reading) => {
      setData(prev => [...prev.slice(-99), msg]);
    });
    return () => {
      socket.off('new_reading');
    };
  }, []);

  if (error) return <p className="text-red-500">Failed to load data</p>;
  if (!history) return <p>Loading historical data…</p>;

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={t => new Date(t).toLocaleTimeString()}
            domain={['auto', 'auto']}
          />
          <YAxis />
          <Tooltip
            labelFormatter={t => new Date(t).toLocaleTimeString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="temp"
            name="Temperature (°C)"
            dot={false}
            stroke="red"
          />
          <Line
            type="monotone"
            dataKey="hum"
            name="Humidity (%)"
            dot={false}
            stroke="blue"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
