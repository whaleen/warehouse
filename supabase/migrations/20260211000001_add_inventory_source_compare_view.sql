-- Side-by-side source comparison for inventory serials

CREATE OR REPLACE VIEW public.inventory_source_side_by_side AS
SELECT
  company_id,
  location_id,
  serial,
  jsonb_object_agg(
    source_type,
    jsonb_strip_nulls(
      jsonb_build_object(
        'bucket', inventory_bucket,
        'state', inventory_state,
        'model', model,
        'qty', qty,
        'cso', cso,
        'sub_inventory', sub_inventory,
        'ge_availability_status', ge_availability_status,
        'ge_availability_message', ge_availability_message,
        'ge_inv_qty', ge_inv_qty,
        'last_seen_at', last_seen_at
      )
    )
  ) AS sources,
  array_remove(array_agg(DISTINCT inventory_bucket), NULL) AS buckets,
  array_remove(array_agg(DISTINCT inventory_state), NULL) AS states,
  array_remove(array_agg(DISTINCT NULLIF(model, '')), NULL) AS models,
  COUNT(*) AS source_count
FROM public.ge_inventory_source_items
GROUP BY company_id, location_id, serial;

CREATE OR REPLACE VIEW public.inventory_source_conflicts_view AS
SELECT *
FROM public.inventory_source_side_by_side
WHERE
  array_length(models, 1) > 1
  OR array_length(buckets, 1) > 1
  OR array_length(states, 1) > 1;
