interface SyncLogViewerProps {
  logs: string[];
  loading?: boolean;
  maxHeight?: string;
}

export function SyncLogViewer({ logs, loading = false, maxHeight = "max-h-40" }: SyncLogViewerProps) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
      <div className="font-medium text-foreground mb-2">
        {loading ? 'Sync log' : 'Last sync log'}
      </div>
      <div className={`${maxHeight} overflow-y-auto space-y-1`}>
        {logs.map((line, index) => (
          <div key={`log-${index}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}
