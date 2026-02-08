import supabase from '@/lib/supabase';
import type { InventoryItem } from '@/types/inventory';

export type InventoryTypeFilter = 'all' | 'ASIS' | 'FG' | 'LocalStock';

export type InventoryFilters = {
  inventoryType: InventoryTypeFilter;
  subInventory: string;
  productCategory: 'all' | 'appliance' | 'accessory';
  brand: string;
  search: string;
};

export type InventorySort = 'model-asc' | 'model-desc' | 'created-desc' | 'created-asc';

export type InventoryItemWithProduct = InventoryItem & {
  products: {
    id: string;
    model: string;
    product_type: string;
    brand?: string;
    description?: string;
    dimensions?: Record<string, unknown>;
    image_url?: string;
    product_url?: string;
    product_category?: string;
  } | null;
};

export type InventoryExportColumn = {
  key: string;
  label: string;
  group: 'Item' | 'Product';
  getValue: (item: InventoryItemWithProduct) => string | number | boolean | null | undefined;
};

export type InventoryExportResult = {
  csv: string;
  filename: string;
  totalRows: number;
};

export type InventorySubInventoryOption = {
  value: string;
  label: string;
  color?: string | null;
  friendlyName?: string | null;
  cso?: string | null;
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const resolveInventoryTypes = (type: InventoryTypeFilter) => {
  if (type === 'FG') {
    return ['FG', 'BackHaul'];
  }
  if (type === 'LocalStock') {
    return ['LocalStock', 'Staged', 'STA', 'Inbound', 'WillCall'];
  }
  if (type === 'ASIS') {
    return ['ASIS'];
  }
  return [];
};

export const buildInventorySelect = (filters: InventoryFilters) => {
  const productJoin =
    filters.brand !== 'all' || filters.productCategory !== 'all'
      ? 'product_fk!inner'
      : 'product_fk';

  return `
    id,
    qty,
    cso,
    serial,
    model,
    product_type,
    inventory_type,
    sub_inventory,
    route_id,
    is_scanned,
    consumer_customer_name,
    created_at,
    ge_model,
    ge_serial,
    ge_inv_qty,
    ge_availability_status,
    ge_availability_message,
    ge_ordc,
    ge_orphaned,
    products:${productJoin} (
      id,
      model,
      product_type,
      brand,
      description,
      image_url,
      product_url,
      product_category
    )
  `;
};

type RawInventoryItem = InventoryItemWithProduct & {
  products?: InventoryItemWithProduct['products'] | InventoryItemWithProduct['products'][] | null;
};

const normalizeInventoryItem = (item: RawInventoryItem): InventoryItemWithProduct => ({
  ...item,
  qty: item.qty ?? 1,
  products: Array.isArray(item.products) ? item.products[0] ?? null : item.products ?? null,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InventoryQuery = any;

const applyInventoryFilters = (query: InventoryQuery, filters: InventoryFilters, types: string[]) => {
  let nextQuery = query;

  if (filters.inventoryType !== 'all') {
    if (types.length === 1) {
      nextQuery = nextQuery.eq('inventory_type', types[0]);
    } else if (types.length > 1) {
      nextQuery = nextQuery.in('inventory_type', types);
    }
  }

  if (filters.subInventory !== 'all') {
    // For ASIS/FG: filter by sub_inventory (load name)
    // For LocalStock/STA/Staged/Inbound: filter by cso (order number)
    const typesWithLoads = ['ASIS', 'FG', 'BackHaul'];
    const hasLoads = types.some(t => typesWithLoads.includes(t));
    const hasOrders = types.some(t => !typesWithLoads.includes(t));

    if (hasLoads && !hasOrders) {
      // Only load-based types selected
      nextQuery = nextQuery.eq('sub_inventory', filters.subInventory);
    } else if (hasOrders && !hasLoads) {
      // Only order-based types selected
      nextQuery = nextQuery.eq('cso', filters.subInventory);
    } else {
      // Mixed types - filter by either sub_inventory OR cso
      nextQuery = nextQuery.or(`sub_inventory.eq.${filters.subInventory},cso.eq.${filters.subInventory}`);
    }
  }

  if (filters.productCategory !== 'all') {
    nextQuery = nextQuery.eq('products.product_category', filters.productCategory);
  }

  if (filters.brand !== 'all') {
    nextQuery = nextQuery.eq('products.brand', filters.brand);
  }

  if (filters.search) {
    const escaped = filters.search.replace(/[%_]/g, '\\$&').replace(/,/g, ' ');
    const like = `%${escaped}%`;
    nextQuery = nextQuery.or(
      `cso.ilike.${like},serial.ilike.${like},model.ilike.${like},product_type.ilike.${like}`
    );
  }

  return nextQuery;
};

const applyInventorySort = (query: InventoryQuery, sort: InventorySort) => {
  switch (sort) {
    case 'model-desc':
      return query.order('model', { ascending: false }).order('created_at', { ascending: false });
    case 'created-asc':
      return query.order('created_at', { ascending: true }).order('model', { ascending: true });
    case 'created-desc':
      return query.order('created_at', { ascending: false }).order('model', { ascending: true });
    case 'model-asc':
    default:
      return query.order('model', { ascending: true }).order('created_at', { ascending: false });
  }
};

const enrichItemsWithProductImages = async (
  items: InventoryItemWithProduct[]
): Promise<InventoryItemWithProduct[]> => {
  const modelSet = new Set<string>();
  for (const item of items) {
    const model = item.products?.model ?? item.model;
    if (!model) continue;
    if (!item.products?.image_url) {
      modelSet.add(model);
    }
  }
  const modelsToFetch = Array.from(modelSet);

  if (modelsToFetch.length === 0) {
    return items;
  }

  const productRows: InventoryItemWithProduct['products'][] = [];
  const chunks = chunkArray(modelsToFetch, 200);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('products')
      .select('id, model, product_type, brand, description, image_url, product_url, product_category')
      .in('model', chunk);

    if (error) throw new Error(error.message);
    if (data) {
      productRows.push(...data);
    }
  }

  if (productRows.length === 0) return items;

  const productByModel = new Map<string, InventoryItemWithProduct['products']>();
  for (const product of productRows) {
    if (product?.model) {
      productByModel.set(product.model, product);
    }
  }

  return items.map((item) => {
    if (item.products?.image_url) return item;
    const model = item.products?.model ?? item.model;
    if (!model) return item;
    const product = productByModel.get(model);
    if (!product) return item;

    if (item.products) {
      return {
        ...item,
        products: {
          ...item.products,
          image_url: item.products.image_url ?? product.image_url,
          brand: item.products.brand ?? product.brand,
          description: item.products.description ?? product.description,
          product_category: item.products.product_category ?? product.product_category,
          product_url: item.products.product_url ?? product.product_url,
        },
      };
    }

    return { ...item, products: product };
  });
};

export async function getInventoryPage(params: {
  locationId: string;
  filters: InventoryFilters;
  sort: InventorySort;
  pageIndex: number;
  pageSize: number;
  withProductImages?: boolean;
}): Promise<{ items: InventoryItemWithProduct[]; count: number | null; pageIndex: number } > {
  const { locationId, filters, sort, pageIndex, pageSize, withProductImages = true } = params;

  let query = supabase
    .from('inventory_items')
    .select(buildInventorySelect(filters), { count: 'exact' })
    .eq('location_id', locationId)
    .range(pageIndex * pageSize, pageIndex * pageSize + pageSize - 1);

  const types = resolveInventoryTypes(filters.inventoryType);
  query = applyInventoryFilters(query, filters, types);
  query = applyInventorySort(query, sort);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const nextItems = ((data ?? []) as unknown as RawInventoryItem[]).map(normalizeInventoryItem);
  const hydratedItems = withProductImages
    ? await enrichItemsWithProductImages(nextItems)
    : nextItems;

  return { items: hydratedItems, count: typeof count === 'number' ? count : null, pageIndex };
}

export async function getInventoryBrands(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('brand')
    .not('brand', 'is', null);

  if (error) throw new Error(error.message);

  const unique = Array.from(new Set((data ?? []).map(item => item.brand).filter(Boolean))).sort();
  return unique;
}

export async function getSubInventoryOptions(params: {
  locationId: string;
  inventoryType: InventoryTypeFilter;
}): Promise<InventorySubInventoryOption[]> {
  const { locationId, inventoryType } = params;

  // ASIS and FG have loads (from load_metadata)
  // LocalStock, STA, Staged, Inbound have CSOs/orders (from inventory_items.cso)
  const typesWithLoads = ['ASIS', 'FG'];
  const typesWithOrders = ['LocalStock', 'STA', 'Staged', 'Inbound'];

  if (typesWithLoads.includes(inventoryType)) {
    // Query load_metadata for ASIS/FG loads
    const types = resolveInventoryTypes(inventoryType);
    const { data, error } = await supabase
      .from('load_metadata')
      .select('sub_inventory_name, friendly_name, primary_color, ge_cso')
      .eq('location_id', locationId)
      .in('inventory_type', types);

    if (error) throw new Error(error.message);

    const optionMap = new Map<string, {
      value: string;
      friendlyName?: string | null;
      color?: string | null;
      cso?: string | null;
    }>();

    (data ?? []).forEach((item) => {
      const value = item.sub_inventory_name?.trim();
      if (!value) return;
      const existing = optionMap.get(value);
      optionMap.set(value, {
        value,
        friendlyName: item.friendly_name?.trim() || existing?.friendlyName || null,
        color: item.primary_color?.trim() || existing?.color || null,
        cso: item.ge_cso?.trim() || existing?.cso || null,
      });
    });

    const isAsis = inventoryType === 'ASIS';
    const options = Array.from(optionMap.values())
      .map(option => {
        if (!isAsis) {
          return {
            ...option,
            label: option.value,
          };
        }
        const friendly = option.friendlyName?.trim() || 'Unnamed';
        const csoOrLoad = option.cso?.trim() || option.value;
        return {
          ...option,
          label: `${friendly} | ${csoOrLoad}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return options;
  }

  else if (typesWithOrders.includes(inventoryType)) {
    // Query inventory_items for distinct CSOs (orders)
    const types = resolveInventoryTypes(inventoryType);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('cso')
      .eq('location_id', locationId)
      .in('inventory_type', types)
      .not('cso', 'is', null)
      .or('ge_orphaned.is.null,ge_orphaned.eq.false');

    if (error) throw new Error(error.message);

    // Get distinct CSOs
    const csoSet = new Set<string>();
    (data ?? []).forEach((item) => {
      const cso = item.cso?.trim();
      if (cso) csoSet.add(cso);
    });

    const options = Array.from(csoSet)
      .map(cso => ({
        value: cso,
        label: `Order ${cso}`,
        friendlyName: null,
        color: null,
        cso: cso,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return options;
  }

  return [];
}

export async function nukeInventoryItems(params: {
  locationId: string;
  inventoryTypes: string[];
}): Promise<{ count: number | null }> {
  const { locationId, inventoryTypes } = params;

  const { error, count } = await supabase
    .from('inventory_items')
    .delete({ count: 'exact' })
    .eq('location_id', locationId)
    .in('inventory_type', inventoryTypes);

  if (error) throw new Error(error.message);

  return { count: typeof count === 'number' ? count : null };
}

export async function getInventoryItemDetail(params: {
  locationId: string;
  itemId: string;
}): Promise<InventoryItem> {
  const { locationId, itemId } = params;

  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      *,
      products:product_fk (
        id,
        model,
        product_type,
        brand,
        description,
        dimensions,
        image_url,
        product_url,
        price,
        msrp,
        color
      )
    `)
    .eq('id', itemId)
    .eq('location_id', locationId)
    .single();

  if (error) throw new Error(error.message);
  return data as InventoryItem;
}

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export async function exportInventoryCsv(params: {
  locationId: string;
  filters: InventoryFilters;
  sort: InventorySort;
  columns: InventoryExportColumn[];
  includeRowNumbers: boolean;
  batchSize: number;
  onProgress?: (count: number) => void;
}): Promise<InventoryExportResult> {
  const { locationId, filters, sort, columns, includeRowNumbers, batchSize, onProgress } = params;

  if (!columns.length) {
    throw new Error('Select at least one column to export.');
  }

  const lines: string[] = [];
  const header = [
    ...(includeRowNumbers ? ['#'] : []),
    ...columns.map(column => column.label),
  ];
  lines.push(header.map(csvEscape).join(','));

  let from = 0;
  let totalExported = 0;
  let rowNumber = 1;

  while (true) {
    let query = supabase
      .from('inventory_items')
      .select(buildInventorySelect(filters))
      .eq('location_id', locationId)
      .range(from, from + batchSize - 1);

    const types = resolveInventoryTypes(filters.inventoryType);
    query = applyInventoryFilters(query, filters, types);
    query = applyInventorySort(query, sort);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const batch = ((data ?? []) as unknown as RawInventoryItem[]).map(normalizeInventoryItem);
    if (batch.length === 0) break;

    for (const item of batch) {
      const rowValues = columns.map(column => {
        const value = column.getValue(item);
        if (column.key === 'is_scanned') {
          return value ? 'true' : 'false';
        }
        return value ?? '';
      });

      const row = includeRowNumbers
        ? [rowNumber, ...rowValues]
        : rowValues;

      lines.push(row.map(csvEscape).join(','));
      rowNumber += 1;
    }

    totalExported += batch.length;
    onProgress?.(totalExported);

    if (batch.length < batchSize) break;
    from += batchSize;
  }

  const filenameParts = ['inventory-export'];
  if (filters.inventoryType !== 'all') {
    filenameParts.push(filters.inventoryType.toLowerCase());
  }
  if (filters.subInventory !== 'all') {
    filenameParts.push(filters.subInventory.replace(/\s+/g, '-').toLowerCase());
  }
  filenameParts.push(new Date().toISOString().slice(0, 10));
  const filename = `${filenameParts.join('-')}.csv`;

  return {
    csv: lines.join('\n'),
    filename,
    totalRows: totalExported,
  };
}
