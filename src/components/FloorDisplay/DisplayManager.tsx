import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Monitor, Trash2 } from 'lucide-react';
import {
  getAllDisplays,
  deleteDisplay,
  pairDisplay,
  updateDisplayName,
  updateDisplayState,
} from '@/lib/displayManager';
import type { FloorDisplaySummary, LoadBoardConfig } from '@/types/display';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

type DisplaySection = 'setup' | 'list' | 'settings' | 'all';

type DisplayManagerProps = {
  section?: DisplaySection;
};

const defaultLoadBoard: LoadBoardConfig = {
  statusFilter: 'both',
  pageSize: 8,
  autoRotate: false,
  rotateIntervalSec: 12,
};

export function DisplayManager({ section = 'all' }: DisplayManagerProps) {
  const [displays, setDisplays] = useState<FloorDisplaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSuccess, setPairSuccess] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingThemeId, setSavingThemeId] = useState<string | null>(null);
  const [savingLoadBoardId, setSavingLoadBoardId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [themeDrafts, setThemeDrafts] = useState<Record<string, 'light' | 'dark'>>({});
  const [loadBoardDrafts, setLoadBoardDrafts] = useState<Record<string, LoadBoardConfig>>({});
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('displayId');
  });
  const showSetup = section === 'setup' || section === 'all';
  const showList = section === 'list' || section === 'all';
  const showSettings = section === 'settings' || section === 'all';

  const fetchDisplays = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await getAllDisplays();
    if (error) {
      setError('Failed to load displays');
      setDisplays([]);
    } else {
      setDisplays(data ?? []);
      setNameDrafts((prev) => {
        const next = { ...prev };
        (data ?? []).forEach((display) => {
          if (!next[display.id]) {
            next[display.id] = display.name ?? '';
          }
        });
        return next;
      });
      setThemeDrafts((prev) => {
        const next = { ...prev };
        (data ?? []).forEach((display) => {
          next[display.id] = display.stateJson?.theme ?? 'light';
        });
        return next;
      });
      setLoadBoardDrafts((prev) => {
        const next = { ...prev };
        (data ?? []).forEach((display) => {
          next[display.id] = { ...defaultLoadBoard, ...(display.stateJson?.loadBoard ?? {}) };
        });
        return next;
      });
      setSelectedDisplayId((prev) => {
        if (!data || data.length === 0) return null;
        return data.some((display) => display.id === prev) ? prev : data[0].id;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDisplays();
  }, [fetchDisplays]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    setPairError(null);
    setPairSuccess(null);

    const { success, error } = await deleteDisplay(id);

    if (error || !success) {
      setError('Failed to delete display');
      setDeletingId(null);
      return;
    }

    setSuccess('Display deleted');
    setDeletingId(null);
    await fetchDisplays();
  };

  const handleSaveName = async (id: string) => {
    const name = nameDrafts[id]?.trim();
    if (!name) {
      setError('Display name cannot be empty.');
      return;
    }
    setSavingId(id);
    setError(null);
    setSuccess(null);
    const { data, error } = await updateDisplayName(id, name);
    if (error || !data) {
      setError('Failed to update display name');
      setSavingId(null);
      return;
    }
    setSuccess('Display updated.');
    setSavingId(null);
    await fetchDisplays();
  };

  const handleThemeChange = async (id: string, theme: 'light' | 'dark') => {
    setSavingThemeId(id);
    setError(null);
    setSuccess(null);
    setThemeDrafts((prev) => ({ ...prev, [id]: theme }));

    const display = displays.find((item) => item.id === id);
    const nextState = { ...(display?.stateJson ?? {}), theme };
    const { data, error } = await updateDisplayState(id, nextState);

    if (error || !data) {
      setError('Failed to update display theme');
      setSavingThemeId(null);
      return;
    }

    setSuccess('Display updated.');
    setSavingThemeId(null);
    await fetchDisplays();
  };

  const handleLoadBoardChange = (id: string, updates: Partial<LoadBoardConfig>) => {
    setLoadBoardDrafts((prev) => ({
      ...prev,
      [id]: {
        ...defaultLoadBoard,
        ...(prev[id] ?? {}),
        ...updates,
      },
    }));
  };

  const handleSaveLoadBoard = async (id: string) => {
    setSavingLoadBoardId(id);
    setError(null);
    setSuccess(null);

    const display = displays.find((item) => item.id === id);
    const draft = loadBoardDrafts[id] ?? defaultLoadBoard;
    const nextState = { ...(display?.stateJson ?? {}), loadBoard: draft };
    const { data, error } = await updateDisplayState(id, nextState);

    if (error || !data) {
      setError('Failed to update load board settings');
      setSavingLoadBoardId(null);
      return;
    }

    setSuccess('Display updated.');
    setSavingLoadBoardId(null);
    await fetchDisplays();
  };

  const handlePair = async () => {
    if (pairingCode.length !== 6) {
      setPairError('Enter the 6-digit code shown on the display.');
      return;
    }

    setPairing(true);
    setPairError(null);
    setPairSuccess(null);

    const { data, error } = await pairDisplay(pairingCode);
    if (error || !data) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      const isDuplicate = message.toLowerCase().includes('pairing_code');
      setPairError(isDuplicate
        ? 'Code already in use. Refresh the TV to get a new code.'
        : 'Invalid pairing code or display already paired');
      setPairing(false);
      return;
    }

    setPairSuccess('Display paired.');
    setPairingCode('');
    setPairing(false);
    await fetchDisplays();
  };

  const selectedDisplay = selectedDisplayId
    ? displays.find((display) => display.id === selectedDisplayId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div className="text-sm">
          {error && <span className="text-destructive">{error}</span>}
          {!error && success && <span className="text-primary">{success}</span>}
        </div>
      )}

      {showSetup && (
        <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Monitor className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Setup</h2>
            <p className="text-sm text-muted-foreground">
              Pair a TV to create a new floor display.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">To set up a TV display:</div>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>On the TV, open {`${window.location.origin}/display`}</li>
            <li>The TV will show a 6-digit code — enter it below to pair</li>
          </ol>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Pair a Display</h3>
          <div className="space-y-2">
            <Label>Pairing Code</Label>
            <InputOTP
              value={pairingCode}
              onChange={setPairingCode}
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {pairError && <span className="text-destructive">{pairError}</span>}
              {!pairError && pairSuccess && <span className="text-primary">{pairSuccess}</span>}
            </div>
            <Button onClick={handlePair} disabled={pairing || pairingCode.length !== 6}>
              {pairing ? 'Pairing...' : 'Pair Display'}
            </Button>
          </div>
        </div>
      </Card>
      )}

      {showList && (
        <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Displays</h2>
            <p className="text-sm text-muted-foreground">All paired displays for this location.</p>
          </div>
          <Button variant="outline" size="responsive" onClick={fetchDisplays}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading displays...</div>
        ) : displays.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No displays yet. Pair a TV to claim a display.
          </div>
        ) : (
          <div className="space-y-3">
              {displays.map((display) => {
              const isSelected = display.id === selectedDisplayId;
              return (
                <Card
                  key={display.id}
                  className={`p-4 flex flex-col gap-3 ${showSettings && isSelected ? 'border-primary' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-base font-medium text-foreground">{display.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {display.paired ? (
                          <Badge variant="secondary">Paired</Badge>
                        ) : (
                          <Badge variant="outline">Awaiting pairing</Badge>
                        )}
                        {display.lastHeartbeat && (
                          <span className="ml-2 text-muted-foreground">
                            Last seen: {new Date(display.lastHeartbeat).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {showSettings && (
                        <Button
                          size="responsive"
                          variant={isSelected ? 'secondary' : 'outline'}
                          onClick={() => setSelectedDisplayId(display.id)}
                        >
                          {isSelected ? 'Selected' : 'Manage'}
                        </Button>
                      )}
                      <Button
                        size="responsive"
                        variant="destructive"
                        onClick={() => handleDelete(display.id)}
                        disabled={deletingId === display.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(display.createdAt).toLocaleString()}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
      )}

      {showSettings && (
        <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Display Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure the selected display.
          </p>
        </div>

        {!selectedDisplay ? (
          <div className="text-sm text-muted-foreground">Select a display to edit settings.</div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs">Display</Label>
              <Select value={selectedDisplayId ?? ''} onValueChange={setSelectedDisplayId}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Choose a display" />
                </SelectTrigger>
                <SelectContent>
                  {displays.map((display) => (
                    <SelectItem key={display.id} value={display.id}>
                      {display.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Display Name</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-sm"
                  value={nameDrafts[selectedDisplay.id] ?? selectedDisplay.name}
                  onChange={(e) =>
                    setNameDrafts((prev) => ({ ...prev, [selectedDisplay.id]: e.target.value }))
                  }
                />
                <Button
                  size="responsive"
                  onClick={() => handleSaveName(selectedDisplay.id)}
                  disabled={
                    savingId === selectedDisplay.id ||
                    (nameDrafts[selectedDisplay.id] ?? selectedDisplay.name) === selectedDisplay.name
                  }
                >
                  {savingId === selectedDisplay.id ? 'Saving…' : 'Save Name'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Display Theme</Label>
              <Select
                value={themeDrafts[selectedDisplay.id] ?? 'light'}
                onValueChange={(value) => handleThemeChange(selectedDisplay.id, value as 'light' | 'dark')}
                disabled={savingThemeId === selectedDisplay.id}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs">Load Board</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Loads shown</Label>
                  <Select
                    value={(loadBoardDrafts[selectedDisplay.id] ?? defaultLoadBoard).statusFilter ?? 'both'}
                    onValueChange={(value) =>
                      handleLoadBoardChange(selectedDisplay.id, {
                        statusFilter: value as LoadBoardConfig['statusFilter'],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">All on-floor</SelectItem>
                      <SelectItem value="for-sale">For sale only</SelectItem>
                      <SelectItem value="sold-picked">Sold / picked only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rows per page</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={(loadBoardDrafts[selectedDisplay.id] ?? defaultLoadBoard).pageSize ?? 8}
                    onChange={(e) =>
                      handleLoadBoardChange(selectedDisplay.id, {
                        pageSize: Number.isNaN(Number(e.target.value)) ? 8 : Number(e.target.value || 8),
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`auto-rotate-${selectedDisplay.id}`}
                    checked={(loadBoardDrafts[selectedDisplay.id] ?? defaultLoadBoard).autoRotate ?? false}
                    onCheckedChange={(checked) =>
                      handleLoadBoardChange(selectedDisplay.id, { autoRotate: Boolean(checked) })
                    }
                  />
                  <Label htmlFor={`auto-rotate-${selectedDisplay.id}`} className="text-xs text-muted-foreground">
                    Auto-rotate pages
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rotate interval (sec)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={(loadBoardDrafts[selectedDisplay.id] ?? defaultLoadBoard).rotateIntervalSec ?? 12}
                    onChange={(e) =>
                      handleLoadBoardChange(selectedDisplay.id, {
                        rotateIntervalSec: Number.isNaN(Number(e.target.value)) ? 12 : Number(e.target.value || 12),
                      })
                    }
                    disabled={!(loadBoardDrafts[selectedDisplay.id] ?? defaultLoadBoard).autoRotate}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="responsive"
                  onClick={() => handleSaveLoadBoard(selectedDisplay.id)}
                  disabled={savingLoadBoardId === selectedDisplay.id}
                >
                  {savingLoadBoardId === selectedDisplay.id ? 'Saving…' : 'Save Load Board'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
