-- Analyze STA inventory counts to understand the relationship with ASIS loads

-- 1. Total STA items
SELECT
  'Total STA Items' as metric,
  COUNT(*) as count
FROM inventory_items
WHERE inventory_type = 'STA'
  AND ge_orphaned IS NOT TRUE;

-- 2. STA items with sub_inventory (in ASIS loads)
SELECT
  'STA In Loads' as metric,
  COUNT(*) as count
FROM inventory_items
WHERE inventory_type = 'STA'
  AND sub_inventory IS NOT NULL
  AND ge_orphaned IS NOT TRUE;

-- 3. STA items without sub_inventory (unassigned)
SELECT
  'STA Unassigned' as metric,
  COUNT(*) as count
FROM inventory_items
WHERE inventory_type = 'STA'
  AND sub_inventory IS NULL
  AND ge_orphaned IS NOT TRUE;

-- 4. Which ASIS loads have STA items?
SELECT
  lm.sub_inventory_name,
  lm.friendly_name,
  lm.ge_source_status,
  lm.ge_cso_status,
  lm.category,
  COUNT(ii.id) as sta_item_count
FROM load_metadata lm
LEFT JOIN inventory_items ii ON ii.sub_inventory = lm.sub_inventory_name AND ii.inventory_type = 'STA'
WHERE lm.inventory_type = 'ASIS'
  AND ii.id IS NOT NULL
GROUP BY lm.sub_inventory_name, lm.friendly_name, lm.ge_source_status, lm.ge_cso_status, lm.category
ORDER BY sta_item_count DESC;

-- 5. Are there any STA items pointing to non-existent loads?
SELECT
  'STA items with invalid sub_inventory' as metric,
  COUNT(*) as count
FROM inventory_items ii
WHERE ii.inventory_type = 'STA'
  AND ii.sub_inventory IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM load_metadata lm
    WHERE lm.sub_inventory_name = ii.sub_inventory
  )
  AND ii.ge_orphaned IS NOT TRUE;

-- 6. Total ASIS items still in ASIS loads
SELECT
  'Total ASIS Items' as metric,
  COUNT(*) as count
FROM inventory_items
WHERE inventory_type = 'ASIS'
  AND ge_orphaned IS NOT TRUE;

-- 7. ASIS items in loads vs unassigned
SELECT
  CASE
    WHEN sub_inventory IS NOT NULL THEN 'ASIS In Loads'
    ELSE 'ASIS Unassigned'
  END as category,
  COUNT(*) as count
FROM inventory_items
WHERE inventory_type = 'ASIS'
  AND ge_orphaned IS NOT TRUE
GROUP BY CASE WHEN sub_inventory IS NOT NULL THEN 'ASIS In Loads' ELSE 'ASIS Unassigned' END;
