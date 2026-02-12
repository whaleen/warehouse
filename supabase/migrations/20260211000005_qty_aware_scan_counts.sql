-- Make scanning progress qty-aware for non-serialized items

CREATE OR REPLACE FUNCTION update_load_scanning_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_location_id uuid;
  v_sub_inventory text;
  v_total_count integer;
  v_scanned_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT location_id, sub_inventory INTO v_location_id, v_sub_inventory
    FROM inventory_items
    WHERE id = OLD.inventory_item_id;
  ELSE
    SELECT location_id, sub_inventory INTO v_location_id, v_sub_inventory
    FROM inventory_items
    WHERE id = NEW.inventory_item_id;
  END IF;

  IF v_sub_inventory IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(ge_units, 0) INTO v_total_count
  FROM load_metadata
  WHERE location_id = v_location_id
    AND sub_inventory_name = v_sub_inventory;

  SELECT COALESCE(SUM(
    CASE
      WHEN i.serial IS NULL OR i.serial = '' THEN COALESCE(i.qty, 1)
      ELSE 1
    END
  ), 0)
  INTO v_scanned_count
  FROM inventory_items i
  INNER JOIN product_location_history plh ON
    plh.inventory_item_id = i.id AND
    plh.location_id = i.location_id
  WHERE i.location_id = v_location_id
    AND i.sub_inventory = v_sub_inventory;

  UPDATE load_metadata
  SET
    items_scanned_count = v_scanned_count,
    items_total_count = v_total_count,
    scanning_complete = (v_total_count > 0 AND v_scanned_count >= v_total_count),
    updated_at = now()
  WHERE location_id = v_location_id
    AND sub_inventory_name = v_sub_inventory;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_load_scanning_progress_for_load(
  p_location_id uuid,
  p_sub_inventory text
)
RETURNS void AS $$
DECLARE
  v_total_count integer;
  v_scanned_count integer;
BEGIN
  SELECT COALESCE(ge_units, 0) INTO v_total_count
  FROM load_metadata
  WHERE location_id = p_location_id
    AND sub_inventory_name = p_sub_inventory;

  SELECT COALESCE(SUM(
    CASE
      WHEN i.serial IS NULL OR i.serial = '' THEN COALESCE(i.qty, 1)
      ELSE 1
    END
  ), 0)
  INTO v_scanned_count
  FROM inventory_items i
  INNER JOIN product_location_history plh ON
    plh.inventory_item_id = i.id AND
    plh.location_id = i.location_id
  WHERE i.location_id = p_location_id
    AND i.sub_inventory = p_sub_inventory;

  UPDATE load_metadata
  SET
    items_scanned_count = v_scanned_count,
    items_total_count = v_total_count,
    scanning_complete = (v_total_count > 0 AND v_scanned_count >= v_total_count),
    updated_at = now()
  WHERE location_id = p_location_id
    AND sub_inventory_name = p_sub_inventory;
END;
$$ LANGUAGE plpgsql;
