-- Create efficient functions to get inventory counts without fetching all rows

-- Function to get total item counts by load and type
CREATE OR REPLACE FUNCTION get_inventory_counts(p_location_id uuid)
RETURNS TABLE (
  key text,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  -- Count items by load (for ASIS, FG, BackHaul)
  SELECT
    'load:' || sub_inventory as key,
    COUNT(*)::bigint as total_count
  FROM inventory_items
  WHERE location_id = p_location_id
    AND sub_inventory IS NOT NULL
    AND inventory_type IN ('ASIS', 'FG', 'BackHaul')
  GROUP BY sub_inventory

  UNION ALL

  -- Count items by type (for items without sub_inventory)
  SELECT
    'type:' || COALESCE(inventory_type, 'unknown') as key,
    COUNT(*)::bigint as total_count
  FROM inventory_items
  WHERE location_id = p_location_id
    AND sub_inventory IS NULL
  GROUP BY inventory_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get scanned item counts
CREATE OR REPLACE FUNCTION get_scanned_counts(p_location_id uuid)
RETURNS TABLE (
  key text,
  scanned_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH scanned_items AS (
    SELECT DISTINCT ON (plh.inventory_item_id)
      plh.inventory_item_id,
      ii.sub_inventory,
      ii.inventory_type
    FROM product_location_history plh
    INNER JOIN inventory_items ii ON ii.id = plh.inventory_item_id
    WHERE plh.location_id = p_location_id
      AND plh.inventory_item_id IS NOT NULL
  )
  -- Count scanned items by load
  SELECT
    'load:' || sub_inventory as key,
    COUNT(*)::bigint as scanned_count
  FROM scanned_items
  WHERE sub_inventory IS NOT NULL
  GROUP BY sub_inventory

  UNION ALL

  -- Count scanned items by type
  SELECT
    'type:' || COALESCE(inventory_type, 'unknown') as key,
    COUNT(*)::bigint as scanned_count
  FROM scanned_items
  WHERE sub_inventory IS NULL
  GROUP BY inventory_type;
END;
$$ LANGUAGE plpgsql STABLE;
