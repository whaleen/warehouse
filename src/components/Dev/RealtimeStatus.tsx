import { Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '@/context/RealtimeContext';

/**
 * Visual indicator for Realtime connection status
 * Shows in corner of app during development
 *
 * Usage: Add to App.tsx or AppHeader
 */
export function RealtimeStatus() {
  const { connected } = useRealtime();

  if (import.meta.env.PROD) return null; // Only show in dev

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium ${
          connected
            ? 'bg-green-500/10 text-green-600 border border-green-500/20'
            : 'bg-red-500/10 text-red-600 border border-red-500/20'
        }`}
      >
        {connected ? (
          <>
            <Wifi className="h-3 w-3 animate-pulse" />
            <span>Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
}
