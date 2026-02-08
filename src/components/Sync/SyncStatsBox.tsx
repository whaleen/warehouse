interface SyncStatsBoxProps {
  stats: {
    totalGEItems?: number;
    newItems?: number;
    updatedItems?: number;
    changesLogged?: number;
  };
}

export function SyncStatsBox({ stats }: SyncStatsBoxProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total Items:</span>
        <span className="font-medium">{stats.totalGEItems ?? 0}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">New Items:</span>
        <span className="font-medium text-emerald-600">{stats.newItems ?? 0}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Updated Items:</span>
        <span className="font-medium text-blue-600">{stats.updatedItems ?? 0}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Changes Logged:</span>
        <span className="font-medium">{stats.changesLogged ?? 0}</span>
      </div>
    </div>
  );
}
