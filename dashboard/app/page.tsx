import LiveChart from '@/components/LiveChart';
import DeviceManager from '@/components/DeviceManager';

export default function Home() {
  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold text-center">🌡️ IoT Live Dashboard</h1>
      <LiveChart />
      <DeviceManager />
    </main>
  );
}
