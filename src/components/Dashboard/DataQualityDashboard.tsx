import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Package,
  FileWarning,
  TrendingUp,
  Info,
} from 'lucide-react';
import { useDataQuality } from '@/hooks/queries/useDataQuality';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';

interface DataQualityDashboardProps {
  onMenuClick?: () => void;
}

export function DataQualityDashboard({ onMenuClick }: DataQualityDashboardProps) {
  const { data: qualityData, isLoading } = useDataQuality();

  const overallScore = useMemo(() => {
    if (!qualityData) return 0;

    const weights = {
      catalogCoverage: 0.4, // 40% weight - most critical
      geFieldCompleteness: 0.2, // 20% weight
      conflictResolution: 0.2, // 20% weight
      changeProcessing: 0.1, // 10% weight
      loadIntegrity: 0.1, // 10% weight
    };

    const scores = {
      catalogCoverage: qualityData.catalogCoverage.overall,
      geFieldCompleteness: qualityData.geFieldCompleteness.overall,
      conflictResolution: 100 - Math.min((qualityData.conflicts.open / 2000) * 100, 100),
      changeProcessing: 100 - Math.min((qualityData.changes.unprocessed / 120000) * 100, 100),
      loadIntegrity: qualityData.loadIntegrity.orphanedItems === 0 ? 100 : 50,
    };

    const weightedScore = Object.entries(weights).reduce(
      (acc, [key, weight]) => acc + scores[key as keyof typeof scores] * weight,
      0
    );

    return Math.round(weightedScore);
  }, [qualityData]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-600">Good</Badge>;
    if (score >= 40) return <Badge className="bg-orange-600">Fair</Badge>;
    return <Badge className="bg-red-600">Needs Attention</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading data quality metrics...</p>
        </div>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unable to load data quality metrics</AlertTitle>
        <AlertDescription>Please check your connection and try again.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <AppHeader
        title="Data Quality"
        subtitle="Monitor system data integrity and completeness"
        onMenuClick={onMenuClick}
      />
      <PageContainer>
        <div className="space-y-6">
          {/* Overall Score Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Data Quality Score</h2>
            <p className="text-sm text-muted-foreground">Overall system data integrity</p>
          </div>
          {getScoreBadge(overallScore)}
        </div>
        <div className="flex items-center gap-6">
          <div className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
            <span className="text-2xl">/100</span>
          </div>
          <div className="flex-1">
            <Progress value={overallScore} className="h-4" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Catalog</div>
            <div className="font-semibold">{qualityData.catalogCoverage.overall}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">GE Fields</div>
            <div className="font-semibold">{qualityData.geFieldCompleteness.overall}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Conflicts</div>
            <div className="font-semibold">{qualityData.conflicts.open}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Changes</div>
            <div className="font-semibold">
              {(qualityData.changes.unprocessed / 1000).toFixed(1)}k
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Load Integrity</div>
            <div className="font-semibold">
              {qualityData.loadIntegrity.orphanedItems === 0 ? '✓' : '✗'}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="fields">GE Fields</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="loads">Loads</TabsTrigger>
        </TabsList>

        {/* Product Catalog Coverage Tab */}
        <TabsContent value="catalog" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Product Catalog Coverage</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Percentage of inventory items with enriched product data (descriptions, images,
              specs)
            </p>

            <div className="space-y-6">
              {qualityData.catalogCoverage.byType.map((type) => {
                const coveragePercent = type.total > 0
                  ? Math.round((type.withProduct / type.total) * 100)
                  : 0;
                const isGood = coveragePercent >= 80;
                const isFair = coveragePercent >= 50;

                return (
                  <div key={type.inventoryType}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{type.inventoryType}</span>
                        {isGood ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : isFair ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {type.withProduct} / {type.total} models ({coveragePercent}%)
                      </div>
                    </div>
                    <Progress value={coveragePercent} className="h-2" />
                    {!isGood && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {type.withoutProduct} models missing product data
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {qualityData.catalogCoverage.overall < 80 && (
              <Alert className="mt-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  Run the product catalog importer to enrich inventory data:
                  <code className="block mt-2 p-2 bg-muted rounded text-xs">
                    cd services/ge-sync && npm run import:brand-products
                  </code>
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </TabsContent>

        {/* GE Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5" />
              <h3 className="text-lg font-semibold">GE DMS Field Population</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              GE synchronization field completeness across inventory types
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Field</th>
                    {qualityData.geFieldCompleteness.byType.map((type) => (
                      <th key={type.inventoryType} className="text-center py-2 px-4">
                        {type.inventoryType}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'availability', label: 'Availability Status' },
                    { key: 'ordc', label: 'ORDC Code' },
                    { key: 'model', label: 'GE Model' },
                    { key: 'serial', label: 'GE Serial' },
                    { key: 'invQty', label: 'Inventory Qty' },
                  ].map((field) => (
                    <tr key={field.key} className="border-b">
                      <td className="py-2 px-4 font-medium">{field.label}</td>
                      {qualityData.geFieldCompleteness.byType.map((type) => {
                        const fieldData = type.fields.find((f) => f.field === field.key);
                        if (!fieldData) return <td key={type.inventoryType}>-</td>;

                        const percent = type.totalItems > 0
                          ? Math.round((fieldData.populated / type.totalItems) * 100)
                          : 0;
                        const cellClass =
                          percent >= 90
                            ? 'text-green-600'
                            : percent >= 50
                            ? 'text-yellow-600'
                            : 'text-red-600';

                        return (
                          <td key={type.inventoryType} className="text-center py-2 px-4">
                            <span className={cellClass}>{percent}%</span>
                            <div className="text-xs text-muted-foreground">
                              {fieldData.populated}/{type.totalItems}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Field Population Guidelines</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>• ASIS: All GE fields expected (synced from GE DMS ASIS data)</li>
                    <li>• STA: Model, Serial, Availability expected (staging data)</li>
                    <li>• FG: Model, Serial, Inv Qty expected (finished goods)</li>
                    <li>• Parts: GE fields not required (manually managed inventory)</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-semibold">Inventory Conflicts</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Detected data conflicts requiring resolution
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Open Conflicts</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {qualityData.conflicts.open.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Resolved</div>
                <div className="text-3xl font-bold text-green-600">
                  {qualityData.conflicts.resolved.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total Detected</div>
                <div className="text-3xl font-bold">
                  {(qualityData.conflicts.open + qualityData.conflicts.resolved).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Resolution Progress</span>
                  <span className="font-medium">
                    {qualityData.conflicts.open + qualityData.conflicts.resolved > 0
                      ? Math.round(
                          (qualityData.conflicts.resolved /
                            (qualityData.conflicts.open + qualityData.conflicts.resolved)) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    qualityData.conflicts.open + qualityData.conflicts.resolved > 0
                      ? (qualityData.conflicts.resolved /
                          (qualityData.conflicts.open + qualityData.conflicts.resolved)) *
                        100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            </div>

            {qualityData.conflicts.open > 0 && (
              <Alert className="mt-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  {qualityData.conflicts.open.toLocaleString()} conflicts need review. Common
                  conflict types:
                  <ul className="mt-2 text-xs space-y-1 ml-4">
                    <li>• Duplicate serial numbers across loads</li>
                    <li>• Items with conflicting CSO assignments</li>
                    <li>• Load assignment mismatches between GE and local data</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </TabsContent>

        {/* Change Processing Tab */}
        <TabsContent value="changes" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileWarning className="h-5 w-5" />
              <h3 className="text-lg font-semibold">GE Change Tracking</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Change detection and processing status from GE DMS syncs
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Unprocessed Changes</div>
                <div className="text-3xl font-bold text-orange-600">
                  {qualityData.changes.unprocessed.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Pending review</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Processed Changes</div>
                <div className="text-3xl font-bold text-green-600">
                  {qualityData.changes.processed.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Resolved</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3">Change Types Breakdown</h4>
              <div className="space-y-2">
                {qualityData.changes.byType.map((change) => (
                  <div key={change.changeType} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className="text-sm">{change.changeType.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-sm font-medium">{change.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium mb-1">About Change Tracking</p>
                  <p className="text-muted-foreground text-xs">
                    Changes are detected during GE sync operations and logged for audit purposes.
                    Processing changes allows for automated responses to inventory updates, status
                    changes, and load movements.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Load Integrity Tab */}
        <TabsContent value="loads" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Load Metadata Integrity</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Relationship consistency between inventory items and load metadata
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total Loads</div>
                <div className="text-3xl font-bold">{qualityData.loadIntegrity.totalLoads}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Items with Loads</div>
                <div className="text-3xl font-bold text-green-600">
                  {qualityData.loadIntegrity.itemsWithLoads.toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Orphaned Items</div>
                <div className="text-3xl font-bold text-red-600">
                  {qualityData.loadIntegrity.orphanedItems}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Load Assignment Coverage</span>
                  <span className="font-medium">
                    {qualityData.loadIntegrity.itemsWithLoads +
                      qualityData.loadIntegrity.orphanedItems >
                    0
                      ? Math.round(
                          (qualityData.loadIntegrity.itemsWithLoads /
                            (qualityData.loadIntegrity.itemsWithLoads +
                              qualityData.loadIntegrity.orphanedItems)) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    qualityData.loadIntegrity.itemsWithLoads +
                      qualityData.loadIntegrity.orphanedItems >
                    0
                      ? (qualityData.loadIntegrity.itemsWithLoads /
                          (qualityData.loadIntegrity.itemsWithLoads +
                            qualityData.loadIntegrity.orphanedItems)) *
                        100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            </div>

            {qualityData.loadIntegrity.orphanedItems === 0 ? (
              <Alert className="mt-6 border-green-600">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>All Clear!</AlertTitle>
                <AlertDescription>
                  All inventory items are properly associated with load metadata. No orphaned items
                  detected.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mt-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Orphaned Items Detected</AlertTitle>
                <AlertDescription>
                  {qualityData.loadIntegrity.orphanedItems} items have sub_inventory values without
                  matching load_metadata records. These items may be from deleted loads or data
                  import errors.
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </PageContainer>
    </>
  );
}
