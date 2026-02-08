-- Check if LocalStock items exist and have CSOs
SELECT
  inventory_type,
  COUNT(*) as total_items,
  COUNT(CASE WHEN cso IS NOT NULL AND cso != '' THEN 1 END) as items_with_cso,
  COUNT(DISTINCT cso) as unique_csos
FROM inventory_items
WHERE ge_orphaned IS NOT TRUE
  AND inventory_type IN ('LocalStock', 'STA', 'Staged', 'Inbound')
GROUP BY inventory_type;

-- Show sample LocalStock items
SELECT
  id,
  inventory_type,
  cso,
  sub_inventory,
  model,
  serial
FROM inventory_items
WHERE inventory_type = 'LocalStock'
  AND ge_orphaned IS NOT TRUE
LIMIT 10;

-- Show sample CSOs
SELECT DISTINCT
  cso
FROM inventory_items
WHERE inventory_type IN ('LocalStock', 'STA', 'Staged', 'Inbound')
  AND cso IS NOT NULL
  AND ge_orphaned IS NOT TRUE
ORDER BY cso
LIMIT 20;
