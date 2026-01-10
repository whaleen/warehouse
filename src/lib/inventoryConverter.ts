import supabase from './supabase';
import type { InventoryType, InventoryConversion } from '@/types/inventory';

/**
 * Convert one or more inventory items to a different type
 * Logs the conversion to history table
 */
export async function convertInventoryType(
  itemIds: string[],
  toInventoryType: InventoryType,
  toSubInventory?: string,
  notes?: string,
  convertedBy?: string
): Promise<{ success: boolean; error?: any }> {
  if (itemIds.length === 0) {
    return { success: false, error: 'No items provided for conversion' };
  }

  // Fetch current state of items for history
  const { data: items, error: fetchError } = await supabase
    .from('inventory_items')
    .select('id, inventory_type, sub_inventory')
    .in('id', itemIds);

  if (fetchError || !items || items.length === 0) {
    return { success: false, error: fetchError || 'Items not found' };
  }

  // Create conversion history records
  const conversions: Partial<InventoryConversion>[] = items.map(item => ({
    inventory_item_id: item.id,
    from_inventory_type: item.inventory_type,
    to_inventory_type: toInventoryType,
    from_sub_inventory: item.sub_inventory ?? undefined,
    to_sub_inventory: toSubInventory ?? undefined,
    notes,
    converted_by: convertedBy
  }));

  // Insert conversion history
  const { error: historyError } = await supabase
    .from('inventory_conversions')
    .insert(conversions);

  if (historyError) {
    console.error('Failed to log conversion history:', historyError);
    // Continue with conversion even if history logging fails
  }

  // Update inventory items
  const updateData: any = {
    inventory_type: toInventoryType,
    updated_at: new Date().toISOString()
  };

  // Only update sub_inventory if explicitly provided (including null to clear it)
  if (toSubInventory !== undefined) {
    updateData.sub_inventory = toSubInventory || null;
  }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update(updateData)
    .in('id', itemIds);

  return { success: !updateError, error: updateError };
}

/**
 * Get conversion history for a specific item
 */
export async function getItemConversionHistory(
  itemId: string
): Promise<{ data: InventoryConversion[] | null; error: any }> {
  const { data, error } = await supabase
    .from('inventory_conversions')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Get all conversions within a date range
 */
export async function getConversionsByDateRange(
  startDate: string,
  endDate: string
): Promise<{ data: InventoryConversion[] | null; error: any }> {
  const { data, error } = await supabase
    .from('inventory_conversions')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Get conversion statistics
 */
export async function getConversionStats(): Promise<{
  data: { from_type: string; to_type: string; count: number }[] | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('inventory_conversions')
    .select('from_inventory_type, to_inventory_type')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: null, error };
  }

  // Group by conversion type pairs
  const stats = data.reduce((acc, conv) => {
    // const key = `${conv.from_inventory_type}→${conv.to_inventory_type}`;
    const existing = acc.find(s => s.from_type === conv.from_inventory_type && s.to_type === conv.to_inventory_type);

    if (existing) {
      existing.count++;
    } else {
      acc.push({
        from_type: conv.from_inventory_type,
        to_type: conv.to_inventory_type,
        count: 1
      });
    }

    return acc;
  }, [] as { from_type: string; to_type: string; count: number }[]);

  return { data: stats, error: null };
}
