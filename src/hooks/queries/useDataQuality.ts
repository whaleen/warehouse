import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { getActiveLocationContext } from '@/lib/tenant';

export interface DataQualityMetrics {
  catalogCoverage: {
    overall: number;
    byType: Array<{
      inventoryType: string;
      total: number;
      withProduct: number;
      withoutProduct: number;
    }>;
  };
  geFieldCompleteness: {
    overall: number;
    byType: Array<{
      inventoryType: string;
      totalItems: number;
      fields: Array<{
        field: string;
        populated: number;
      }>;
    }>;
  };
  conflicts: {
    open: number;
    resolved: number;
  };
  changes: {
    unprocessed: number;
    processed: number;
    byType: Array<{
      changeType: string;
      count: number;
    }>;
  };
  loadIntegrity: {
    totalLoads: number;
    itemsWithLoads: number;
    orphanedItems: number;
  };
}

async function fetchDataQuality(
  companyId: string | null,
  locationId: string | null
): Promise<DataQualityMetrics> {
  if (!companyId || !locationId) {
    throw new Error('Company ID and Location ID are required');
  }

  // 1. Catalog Coverage - Direct query
  const { data: inventoryItems, error: catalogError } = await supabase
    .from('inventory_items')
    .select('inventory_type, model, product_fk')
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  if (catalogError) {
    console.error('Catalog coverage error:', catalogError);
    throw catalogError;
  }

  type CatalogAcc = Record<string, { inventoryType: string; models: Set<string>; withProduct: Set<string> }>;

  const byType = inventoryItems
    ? Object.entries(
        inventoryItems.reduce((acc: CatalogAcc, item) => {
          if (!acc[item.inventory_type]) {
            acc[item.inventory_type] = {
              inventoryType: item.inventory_type,
              models: new Set(),
              withProduct: new Set(),
            };
          }
          acc[item.inventory_type].models.add(item.model);
          if (item.product_fk) {
            acc[item.inventory_type].withProduct.add(item.model);
          }
          return acc;
        }, {})
      ).map(([, value]) => ({
        inventoryType: value.inventoryType,
        total: value.models.size,
        withProduct: value.withProduct.size,
        withoutProduct: value.models.size - value.withProduct.size,
      }))
    : [];

  const catalogData = byType;

  const totalModels = catalogData.reduce((sum, t) => sum + t.total, 0);
  const totalWithProduct = catalogData.reduce((sum, t) => sum + t.withProduct, 0);
  const catalogCoverage = {
    overall: totalModels > 0 ? Math.round((totalWithProduct / totalModels) * 100) : 0,
    byType: catalogData || [],
  };

  // 2. GE Field Completeness - Direct query
  const { data: items, error: geFieldError } = await supabase
    .from('inventory_items')
    .select(
      'inventory_type, ge_availability_status, ge_ordc, ge_model, ge_serial, ge_inv_qty'
    )
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  if (geFieldError) {
    console.error('GE field error:', geFieldError);
    throw geFieldError;
  }

  type GEFieldAcc = Record<string, {
    inventoryType: string;
    totalItems: number;
    availability: number;
    ordc: number;
    model: number;
    serial: number;
    invQty: number;
  }>;

  const geFieldData = items
    ? Object.entries(
        items.reduce((acc: GEFieldAcc, item) => {
          if (!acc[item.inventory_type]) {
            acc[item.inventory_type] = {
              inventoryType: item.inventory_type,
              totalItems: 0,
              availability: 0,
              ordc: 0,
              model: 0,
              serial: 0,
              invQty: 0,
            };
          }
          acc[item.inventory_type].totalItems++;
          if (item.ge_availability_status) acc[item.inventory_type].availability++;
          if (item.ge_ordc) acc[item.inventory_type].ordc++;
          if (item.ge_model) acc[item.inventory_type].model++;
          if (item.ge_serial) acc[item.inventory_type].serial++;
          if (item.ge_inv_qty) acc[item.inventory_type].invQty++;
          return acc;
        }, {})
      ).map(([, value]) => ({
        inventoryType: value.inventoryType,
        totalItems: value.totalItems,
        fields: [
          { field: 'availability', populated: value.availability },
          { field: 'ordc', populated: value.ordc },
          { field: 'model', populated: value.model },
          { field: 'serial', populated: value.serial },
          { field: 'invQty', populated: value.invQty },
        ],
      }))
    : [];

  const totalItems = geFieldData.reduce((sum, t) => sum + t.totalItems, 0);
  const totalFieldsPopulated = geFieldData.reduce(
    (sum, t) =>
      sum + t.fields.reduce((s, f) => s + f.populated, 0),
    0
  );
  const totalFieldSlots = totalItems * 5; // 5 fields tracked
  const geFieldCompleteness = {
    overall:
      totalFieldSlots > 0 ? Math.round((totalFieldsPopulated / totalFieldSlots) * 100) : 0,
    byType: geFieldData || [],
  };

  // 3. Conflicts
  const { data: conflictsData } = await supabase
    .from('inventory_conflicts')
    .select('status')
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  const conflicts = {
    open: conflictsData?.filter((c) => c.status === 'open').length || 0,
    resolved: conflictsData?.filter((c) => c.status === 'resolved').length || 0,
  };

  // 4. Changes
  const { data: changesData } = await supabase
    .from('ge_changes')
    .select('change_type, processed')
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  const changesByType = changesData
    ? Object.entries(
        changesData.reduce((acc: Record<string, number>, change) => {
          acc[change.change_type] = (acc[change.change_type] || 0) + 1;
          return acc;
        }, {})
      )
        .map(([changeType, count]) => ({
          changeType,
          count: count as number,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  const changes = {
    unprocessed: changesData?.filter((c) => !c.processed).length || 0,
    processed: changesData?.filter((c) => c.processed).length || 0,
    byType: changesByType,
  };

  // 5. Load Integrity
  const { data: loadsData } = await supabase
    .from('load_metadata')
    .select('id')
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  const { data: itemsWithLoadsData } = await supabase
    .from('inventory_items')
    .select('id, sub_inventory, inventory_type')
    .eq('company_id', companyId)
    .eq('location_id', locationId)
    .not('sub_inventory', 'is', null);

  const { data: loadMetadataList } = await supabase
    .from('load_metadata')
    .select('sub_inventory_name, inventory_type')
    .eq('company_id', companyId)
    .eq('location_id', locationId);

  const loadMetadataKeys = new Set(
    loadMetadataList?.map((l) => `${l.inventory_type}:${l.sub_inventory_name}`) || []
  );

  const itemsWithLoads = itemsWithLoadsData?.filter((item) =>
    loadMetadataKeys.has(`${item.inventory_type}:${item.sub_inventory}`)
  ).length || 0;

  const orphanedItems = (itemsWithLoadsData?.length || 0) - itemsWithLoads;

  const loadIntegrity = {
    totalLoads: loadsData?.length || 0,
    itemsWithLoads,
    orphanedItems,
  };

  return {
    catalogCoverage,
    geFieldCompleteness,
    conflicts,
    changes,
    loadIntegrity,
  };
}

export function useDataQuality() {
  const { companyId, locationId } = getActiveLocationContext();

  return useQuery({
    queryKey: ['dataQuality', companyId, locationId],
    queryFn: () => fetchDataQuality(companyId, locationId),
    enabled: !!companyId && !!locationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}
