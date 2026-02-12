import { useMemo } from 'react';
import { useDataQuality } from '@/hooks/queries/useDataQuality';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

export function DataQualityDashboard() {
  const { data: qualityData, isLoading } = useDataQuality();

  const validationScore = useMemo(() => {
    if (!qualityData) return 0;

    // Simple validation: all metrics should be 100% or have 0 issues
    const scores = [
      qualityData.inventoryIntegrity.duplicateSerials === 0 ? 100 : 0, // CRITICAL
      qualityData.inventoryIntegrity.orphanedItems === 0 ? 100 : 50,
      qualityData.productCatalog.coveragePercent,
      qualityData.orderLinkage.coveragePercent,
      qualityData.loadAssignments.orphanedLoadAssignments === 0 ? 100 : 50,
      qualityData.scanCoverage.coveragePercent,
    ];

    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [qualityData]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Valid</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-600">Warning</Badge>;
    if (score >= 50) return <Badge className="bg-orange-600">Issues</Badge>;
    return <Badge className="bg-red-600">Critical</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-muted-foreground">Validating synced data...</p>
        </div>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load validation data</p>
      </div>
    );
  }

  const criticalIssues = [
    qualityData.inventoryIntegrity.duplicateSerials > 0 && 'Duplicate serials detected (data corruption)',
    qualityData.loadAssignments.orphanedLoadAssignments > 0 && 'Items assigned to non-existent loads',
  ].filter(Boolean);

  const warnings = [
    qualityData.inventoryIntegrity.orphanedItems > 0 && `${qualityData.inventoryIntegrity.orphanedItems} items disappeared from GE`,
    qualityData.productCatalog.modelsMissingProduct > 0 && `${qualityData.productCatalog.modelsMissingProduct} models missing from catalog`,
    qualityData.orderLinkage.orphanedCsos > 0 && `${qualityData.orderLinkage.orphanedCsos} CSOs not found in orders table`,
  ].filter(Boolean);

  return (
    <div className="space-y-6 p-6">
      {/* Validation Score */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Data Validation</h2>
            <p className="text-sm text-muted-foreground">Synced data accuracy check</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(validationScore)}`}>
              {validationScore}%
            </div>
            {getScoreBadge(validationScore)}
          </div>
        </div>

        {/* Critical Issues */}
        {criticalIssues.length > 0 && (
          <Alert className="mb-4 border-red-600">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-600">Critical Data Issues</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1">
                {criticalIssues.map((issue, i) => (
                  <li key={i} className="text-sm">• {issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {warnings.length > 0 && criticalIssues.length === 0 && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Data Warnings</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1">
                {warnings.map((warning, i) => (
                  <li key={i} className="text-sm">• {warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* All Clear */}
        {criticalIssues.length === 0 && warnings.length === 0 && (
          <Alert className="mb-4 border-green-600">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Data Valid</AlertTitle>
            <AlertDescription>
              All synced data passed validation checks. UI components can trust the data.
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Validation Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Inventory Integrity */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {qualityData.inventoryIntegrity.duplicateSerials === 0 && qualityData.inventoryIntegrity.orphanedItems === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : qualityData.inventoryIntegrity.duplicateSerials > 0 ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            Inventory Integrity
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Items (deduplicated)</span>
              <span className="font-semibold">{qualityData.inventoryIntegrity.totalItems.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bucket overlaps (expected)</span>
              <span className="font-semibold">{qualityData.inventoryIntegrity.asisStaDuplicates.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={qualityData.inventoryIntegrity.duplicateSerials > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                Duplicate Serials (corruption)
              </span>
              <span className={qualityData.inventoryIntegrity.duplicateSerials > 0 ? 'font-bold text-red-600' : 'font-semibold'}>
                {qualityData.inventoryIntegrity.duplicateSerials.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={qualityData.inventoryIntegrity.orphanedItems > 0 ? 'text-yellow-600' : 'text-muted-foreground'}>
                Orphaned Items
              </span>
              <span className={qualityData.inventoryIntegrity.orphanedItems > 0 ? 'font-semibold text-yellow-600' : 'font-semibold'}>
                {qualityData.inventoryIntegrity.orphanedItems.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Product Catalog */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {qualityData.productCatalog.coveragePercent >= 90 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : qualityData.productCatalog.coveragePercent >= 70 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Product Catalog
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Models</span>
              <span className="font-semibold">{qualityData.productCatalog.totalModels.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Models with Product Info</span>
              <span className="font-semibold">{qualityData.productCatalog.modelsWithProduct.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={qualityData.productCatalog.modelsMissingProduct > 0 ? 'text-yellow-600' : 'text-muted-foreground'}>
                Models Missing Info
              </span>
              <span className={qualityData.productCatalog.modelsMissingProduct > 0 ? 'font-semibold text-yellow-600' : 'font-semibold'}>
                {qualityData.productCatalog.modelsMissingProduct.toLocaleString()}
              </span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-semibold">{qualityData.productCatalog.coveragePercent}%</span>
              </div>
              <Progress value={qualityData.productCatalog.coveragePercent} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Order Linkage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {qualityData.orderLinkage.coveragePercent >= 90 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : qualityData.orderLinkage.coveragePercent >= 70 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Order/CSO Linkage
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items with CSO</span>
              <span className="font-semibold">{qualityData.orderLinkage.itemsWithCso.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CSOs Matched to Orders</span>
              <span className="font-semibold">{qualityData.orderLinkage.csosMatchedToOrders.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={qualityData.orderLinkage.orphanedCsos > 0 ? 'text-yellow-600' : 'text-muted-foreground'}>
                Orphaned CSOs
              </span>
              <span className={qualityData.orderLinkage.orphanedCsos > 0 ? 'font-semibold text-yellow-600' : 'font-semibold'}>
                {qualityData.orderLinkage.orphanedCsos.toLocaleString()}
              </span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Linkage Coverage</span>
                <span className="font-semibold">{qualityData.orderLinkage.coveragePercent}%</span>
              </div>
              <Progress value={qualityData.orderLinkage.coveragePercent} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Load Assignments */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {qualityData.loadAssignments.orphanedLoadAssignments === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Load Assignments
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Loads</span>
              <span className="font-semibold">{qualityData.loadAssignments.totalLoads.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items with Load Assignments</span>
              <span className="font-semibold">{qualityData.loadAssignments.itemsWithLoads.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={qualityData.loadAssignments.orphanedLoadAssignments > 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                Orphaned Assignments
              </span>
              <span className={qualityData.loadAssignments.orphanedLoadAssignments > 0 ? 'font-bold text-red-600' : 'font-semibold'}>
                {qualityData.loadAssignments.orphanedLoadAssignments.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Scan Coverage */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {qualityData.scanCoverage.coveragePercent >= 70 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : qualityData.scanCoverage.coveragePercent >= 40 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Scan Coverage
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items with Scans</span>
              <span className="font-semibold">{qualityData.scanCoverage.itemsWithScans.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scanned Last 30 Days</span>
              <span className="font-semibold">{qualityData.scanCoverage.scannedLast30Days.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Never Scanned</span>
              <span className="font-semibold">{qualityData.scanCoverage.neverScanned.toLocaleString()}</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-semibold">{qualityData.scanCoverage.coveragePercent}%</span>
              </div>
              <Progress value={qualityData.scanCoverage.coveragePercent} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Sync Health */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sync Health
          </h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'ASIS', timestamp: qualityData.syncHealth.lastSyncAsisAt },
              { label: 'STA', timestamp: qualityData.syncHealth.lastSyncStaAt },
              { label: 'FG', timestamp: qualityData.syncHealth.lastSyncFgAt },
              { label: 'Inbound', timestamp: qualityData.syncHealth.lastSyncInboundAt },
              { label: 'Orders', timestamp: qualityData.syncHealth.lastSyncOrdersAt },
            ].map(({ label, timestamp }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">
                  {formatTimeAgo(timestamp)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
