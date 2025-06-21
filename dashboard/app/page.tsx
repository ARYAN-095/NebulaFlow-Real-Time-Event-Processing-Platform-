 
import LiveChart from '@/components/LiveChart';

export default function Home() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-4 text-center">
        🌡️ IoT Live Dashboard
      </h1>
      <LiveChart />
    </main>
  );
}
