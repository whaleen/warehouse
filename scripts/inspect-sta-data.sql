-- See what fields are actually populated in STA items
SELECT
  -- Count populated fields
  COUNT(*) as total_items,
  COUNT(CASE WHEN cso IS NOT NULL AND cso != '' THEN 1 END) as has_cso,
  COUNT(CASE WHEN sub_inventory IS NOT NULL AND sub_inventory != '' THEN 1 END) as has_sub_inventory,
  COUNT(CASE WHEN route_id IS NOT NULL AND route_id != '' THEN 1 END) as has_route_id,
  COUNT(CASE WHEN consumer_customer_name IS NOT NULL AND consumer_customer_name != '' THEN 1 END) as has_customer_name,
  COUNT(CASE WHEN date IS NOT NULL THEN 1 END) as has_date,
  COUNT(CASE WHEN stop IS NOT NULL THEN 1 END) as has_stop,
  COUNT(CASE WHEN status IS NOT NULL AND status != '' THEN 1 END) as has_status,
  COUNT(CASE WHEN ge_availability_status IS NOT NULL AND ge_availability_status != '' THEN 1 END) as has_ge_availability_status,
  COUNT(CASE WHEN ge_ordc IS NOT NULL AND ge_ordc != '' THEN 1 END) as has_ge_ordc
FROM inventory_items
WHERE inventory_type = 'STA';

-- Show sample STA item to see what we have
SELECT *
FROM inventory_items
WHERE inventory_type = 'STA'
LIMIT 1;
