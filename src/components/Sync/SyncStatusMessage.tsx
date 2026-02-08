interface SyncStatusMessageProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

export function SyncStatusMessage({ type, message }: SyncStatusMessageProps) {
  const styles = {
    error: "rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive",
    success: "rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600",
    info: "rounded-lg border border-blue-500/50 bg-blue-500/10 p-3 text-sm text-blue-600",
  };

  return (
    <div className={styles[type]}>
      {message}
    </div>
  );
}
