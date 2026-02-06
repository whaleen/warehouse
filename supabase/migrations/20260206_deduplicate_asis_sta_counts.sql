-- Fix ASIS/STA duplicate counting issue
-- When an ASIS item is sold/picked, it appears in both ASIS and STA
-- Priority rule: STA wins - exclude ASIS records when serial exists in STA

-- Updated function to get total item counts with deduplication
CREATE OR REPLACE FUNCTION get_inventory_counts(p_location_id uuid)
RETURNS TABLE (
  key text,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  -- Count items by load (for ASIS, FG, BackHaul)
  -- For ASIS: exclude serials that also exist in STA
  SELECT
    'load:' || sub_inventory as key,
    COUNT(*)::bigint as total_count
  FROM inventory_items
  WHERE location_id = p_location_id
    AND sub_inventory IS NOT NULL
    AND inventory_type IN ('ASIS', 'FG', 'BackHaul')
    AND NOT (
      -- Exclude ASIS items that have moved to STA
      inventory_type = 'ASIS'
      AND serial IN (
        SELECT serial
        FROM inventory_items
        WHERE location_id = p_location_id
          AND inventory_type = 'STA'
          AND serial IS NOT NULL
      )
    )
  GROUP BY sub_inventory

  UNION ALL

  -- Count items by type (for items without sub_inventory, primarily STA)
  SELECT
    'type:' || COALESCE(inventory_type, 'unknown') as key,
    COUNT(*)::bigint as total_count
  FROM inventory_items
  WHERE location_id = p_location_id
    AND sub_inventory IS NULL
  GROUP BY inventory_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- Updated function to get scanned item counts with deduplication
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
      ii.inventory_type,
      ii.serial
    FROM product_location_history plh
    INNER JOIN inventory_items ii ON ii.id = plh.inventory_item_id
    WHERE plh.location_id = p_location_id
      AND plh.inventory_item_id IS NOT NULL
  )
  -- Count scanned items by load
  -- For ASIS: exclude serials that also exist in STA
  SELECT
    'load:' || sub_inventory as key,
    COUNT(*)::bigint as scanned_count
  FROM scanned_items si
  WHERE sub_inventory IS NOT NULL
    AND NOT (
      -- Exclude ASIS items that have moved to STA
      inventory_type = 'ASIS'
      AND serial IN (
        SELECT serial
        FROM inventory_items
        WHERE location_id = p_location_id
          AND inventory_type = 'STA'
          AND serial IS NOT NULL
      )
    )
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
