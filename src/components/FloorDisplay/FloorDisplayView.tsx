import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToDisplay,
} from '@/lib/displayManager';
import type { FloorDisplay } from '@/types/display';
import { AsisOverviewWidget } from './widgets/AsisOverviewWidget';
import { AsisLoadsWidget } from './widgets/AsisLoadsWidget';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/components/theme-provider';
import {
  useDisplayByCode,
  useDisplayLocationLabel,
  usePublicDisplay,
  useRecordDisplayHeartbeat,
} from '@/hooks/queries/useDisplays';

type Props = {
  displayId: string | null;
};

export function FloorDisplayView({ displayId }: Props) {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [display, setDisplay] = useState<FloorDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [resolvedDisplayId, setResolvedDisplayId] = useState<string | null>(null);
  const { setTheme } = useTheme();
  const [liveStatus, setLiveStatus] = useState<'live' | 'connecting' | 'offline'>('connecting');
  const displayIdValue = display?.id ?? null;
  const displayLocationId = display?.locationId ?? null;
  const displayQuery = usePublicDisplay(resolvedDisplayId);
  const pairingQuery = useDisplayByCode(pendingCode, pendingCode ? 3000 : undefined);
  const heartbeatMutation = useRecordDisplayHeartbeat();
  const locationLabel = useDisplayLocationLabel(displayLocationId).data ?? null;
  const loading = displayQuery.isLoading && !!resolvedDisplayId;

  const generatePairingCode = useCallback(() => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }, []);

  const initializePairingCode = useCallback(() => {
    const storedCode = localStorage.getItem('floor_display_pairing_code');
    const nextCode = storedCode ?? generatePairingCode();
    localStorage.setItem('floor_display_pairing_code', nextCode);
    setPendingCode(nextCode);
  }, [generatePairingCode]);

  useEffect(() => {
    const storedId = localStorage.getItem('floor_display_id');
    const idToLoad = displayId || storedId;

    if (idToLoad) {
      setResolvedDisplayId(idToLoad);
      setPendingCode(null);
    } else {
      if (!isPreview) {
        initializePairingCode();
      }
    }
  }, [displayId, initializePairingCode, isPreview]);

  useEffect(() => {
    if (!displayQuery.data) return;
    setDisplay(displayQuery.data);
    setError(null);
    setPendingCode(null);
    setResolvedDisplayId(displayQuery.data.id);
    if (!isPreview) {
      localStorage.setItem('floor_display_id', displayQuery.data.id);
    }
  }, [displayQuery.data]);

  useEffect(() => {
    if (!displayQuery.error || !resolvedDisplayId) return;
    setError('Display not found');
    setDisplay(null);
    if (!isPreview) {
      localStorage.removeItem('floor_display_id');
      if (!displayId) {
        setResolvedDisplayId(null);
      }
      initializePairingCode();
    }
  }, [displayQuery.error, resolvedDisplayId, displayId, initializePairingCode, isPreview]);

  useEffect(() => {
    if (!displayIdValue) return;

    setLiveStatus('connecting');

    const unsubscribe = subscribeToDisplay(
      displayIdValue,
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
  }, [displayIdValue]);

  useEffect(() => {
    const nextTheme = display?.stateJson?.theme ?? 'light';
    setTheme(nextTheme);
  }, [display?.stateJson?.theme, setTheme]);

  useEffect(() => {
    if (displayIdValue || !pendingCode) return;
    if (pairingQuery.data?.paired) {
      setDisplay(pairingQuery.data);
      setResolvedDisplayId(pairingQuery.data.id);
      if (!isPreview) {
        localStorage.setItem('floor_display_id', pairingQuery.data.id);
        localStorage.removeItem('floor_display_pairing_code');
      }
      setPendingCode(null);
      setError(null);
    }
  }, [displayIdValue, pendingCode, pairingQuery.data, isPreview]);

  useEffect(() => {
    if (!displayIdValue || isPreview) return;

    const interval = setInterval(() => {
      heartbeatMutation.mutate(displayIdValue);
    }, 30000);

    heartbeatMutation.mutate(displayIdValue);

    return () => clearInterval(interval);
  }, [displayIdValue, isPreview]);

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
