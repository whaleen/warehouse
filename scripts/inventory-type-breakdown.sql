-- Get breakdown of all inventory types to understand what we're working with
SELECT
  inventory_type,
  COUNT(*) as item_count,
  COUNT(CASE WHEN sub_inventory IS NOT NULL THEN 1 END) as in_loads_or_csos,
  COUNT(CASE WHEN sub_inventory IS NULL THEN 1 END) as unassigned,
  COUNT(DISTINCT cso) as unique_csos,
  COUNT(DISTINCT sub_inventory) as unique_sub_inventories
FROM inventory_items
WHERE ge_orphaned IS NOT TRUE
GROUP BY inventory_type
ORDER BY item_count DESC;

-- Show sample items from each type
SELECT
  inventory_type,
  sub_inventory,
  cso,
  model,
  status
FROM inventory_items
WHERE ge_orphaned IS NOT TRUE
ORDER BY inventory_type, sub_inventory
LIMIT 50;
