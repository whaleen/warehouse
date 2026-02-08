import { Card } from "@/components/ui/card";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import type { SyncType, SyncStatus } from "@/hooks/useSyncHandler";
import type { LucideIcon } from "lucide-react";

interface SyncCardPreviewProps {
  type: SyncType;
  title: string;
  description: string;
  icon: LucideIcon;
  lastSyncAt?: string | null;
  status?: SyncStatus;
  onClick: (type: SyncType) => void;
}

export function SyncCardPreview({
  type,
  title,
  description,
  icon: Icon,
  lastSyncAt,
  status,
  onClick,
}: SyncCardPreviewProps) {
  const lastSyncText = formatRelativeTime(lastSyncAt);

  const getStatusIcon = () => {
    if (status?.loading) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (status?.error) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (status?.success) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    return null;
  };

  return (
    <Card
      className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={() => onClick(type)}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{title}</h3>
            {getStatusIcon()}
          </div>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{lastSyncText}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
