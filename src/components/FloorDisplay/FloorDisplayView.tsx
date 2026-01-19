import { useEffect, useState, useCallback } from 'react';
import {
  getDisplayByIdPublic,
  getDisplayByCode,
  subscribeToDisplay,
  recordHeartbeat,
} from '@/lib/displayManager';
import type { FloorDisplay } from '@/types/display';
import { AsisOverviewWidget } from './widgets/AsisOverviewWidget';
import { AsisLoadsWidget } from './widgets/AsisLoadsWidget';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import supabase from '@/lib/supabase';
import { useTheme } from '@/components/theme-provider';

type Props = {
  displayId: string | null;
};

export function FloorDisplayView({ displayId }: Props) {
  const [display, setDisplay] = useState<FloorDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const { setTheme } = useTheme();
  const [locationLabel, setLocationLabel] = useState<{
    locationName: string;
    companyName?: string | null;
  } | null>(null);
  const [liveStatus, setLiveStatus] = useState<'live' | 'connecting' | 'offline'>('connecting');

  const generatePairingCode = useCallback(() => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }, []);

  const initializePairingCode = useCallback(() => {
    const storedCode = localStorage.getItem('floor_display_pairing_code');
    const nextCode = storedCode ?? generatePairingCode();
    localStorage.setItem('floor_display_pairing_code', nextCode);
    setPendingCode(nextCode);
  }, [generatePairingCode]);

  const loadDisplay = useCallback(async (id: string) => {
    setLoading(true);
    const { data, error } = await getDisplayByIdPublic(id);
    if (error || !data) {
      setError('Display not found');
      localStorage.removeItem('floor_display_id');
      setDisplay(null);
      initializePairingCode();
      setLoading(false);
      return;
    }
    setDisplay(data);
    setLoading(false);

    localStorage.setItem('floor_display_id', id);
  }, [initializePairingCode]);

  useEffect(() => {
    const storedId = localStorage.getItem('floor_display_id');
    const idToLoad = displayId || storedId;

    if (idToLoad) {
      loadDisplay(idToLoad);
    } else {
      initializePairingCode();
      setLoading(false);
    }
  }, [displayId, initializePairingCode, loadDisplay]);

  useEffect(() => {
    if (!display) return;

    setLiveStatus('connecting');

    const unsubscribe = subscribeToDisplay(
      display.id,
      (updatedDisplay) => {
        setDisplay(updatedDisplay);
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          setLiveStatus('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLiveStatus('offline');
        } else {
          setLiveStatus('connecting');
        }
      }
    );

    return unsubscribe;
  }, [display?.id]);

  useEffect(() => {
    const nextTheme = display?.stateJson?.theme ?? 'light';
    setTheme(nextTheme);
  }, [display?.stateJson?.theme, setTheme]);

  useEffect(() => {
    if (display || !pendingCode) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const { data } = await getDisplayByCode(pendingCode);
      if (!cancelled && data?.paired) {
        setDisplay(data);
        localStorage.setItem('floor_display_id', data.id);
        localStorage.removeItem('floor_display_pairing_code');
        setPendingCode(null);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [display, pendingCode]);

  useEffect(() => {
    if (!display) return;

    const interval = setInterval(() => {
      recordHeartbeat(display.id);
    }, 30000);

    recordHeartbeat(display.id);

    return () => clearInterval(interval);
  }, [display?.id]);

  useEffect(() => {
    if (!display?.locationId) {
      setLocationLabel(null);
      return;
    }

    let cancelled = false;

    const loadLocation = async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('name, companies:company_id (name)')
        .eq('id', display.locationId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setLocationLabel(null);
        return;
      }

      setLocationLabel({
        locationName: data.name,
        companyName: data.companies?.name ?? null,
      });
    };

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, [display?.locationId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-2xl text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  // Pairing screen - matches LoginCard pattern exactly
  if (!display) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 space-y-6">
          <div className="flex flex-col items-center justify-center gap-2 pb-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect width="20" height="14" x="2" y="3" rx="2"/>
                <line x1="8" x2="16" y1="21" y2="21"/>
                <line x1="12" x2="12" y1="17" y2="21"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Floor Display</h1>
            <p className="text-sm text-muted-foreground text-center">
              Enter this code in the app to complete pairing.
            </p>
          </div>

          {pendingCode && (
            <div className="space-y-2">
              <Label>Pairing Code</Label>
              <div className="rounded-md border border-border bg-muted px-6 py-4 text-center text-4xl font-mono tracking-widest text-foreground">
                {pendingCode}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </Card>
      </div>
    );
  }

  const tenantLogoUrl = '/blue-jacket.png';
  const companyName = locationLabel?.companyName ?? 'Company';
  const locationName = locationLabel?.locationName ?? display.name ?? 'Location';
  const displayLabel = display.name ?? locationLabel?.locationName ?? 'Floor Display';
  const liveLabel = liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Connecting' : 'Offline';
  const liveDotClass =
    liveStatus === 'live'
      ? 'bg-primary animate-pulse'
      : liveStatus === 'connecting'
      ? 'bg-muted-foreground/40'
      : 'bg-muted-foreground/30';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-xl border border-border bg-muted overflow-hidden">
              <img src={tenantLogoUrl} alt={`${companyName} logo`} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold text-foreground truncate">{companyName}</div>
              <div className="text-base text-muted-foreground truncate">{locationName}</div>
            </div>
          </div>
          <div className="text-right min-w-0 space-y-2">
            <div className="flex items-center justify-end gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${liveDotClass}`} />
              <span>{liveLabel}</span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Display</div>
              <div className="text-base font-medium text-foreground truncate">{displayLabel}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-6 py-4 min-h-0">
        <AsisOverviewWidget
          title="ASIS Overview"
          locationId={display.locationId}
          variant="compact"
          className="shrink-0"
        />
        <AsisLoadsWidget
          title="ASIS Load Board"
          locationId={display.locationId}
          config={display.stateJson?.loadBoard}
          className="flex-1 min-h-0"
        />
      </main>
    </div>
  );
}
