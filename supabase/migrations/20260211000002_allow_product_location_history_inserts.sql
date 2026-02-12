-- Allow app clients to insert/update map scan history

ALTER TABLE public.product_location_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_location_history'
      AND policyname = 'product_location_history_select'
  ) THEN
    CREATE POLICY product_location_history_select
      ON public.product_location_history
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_location_history'
      AND policyname = 'product_location_history_insert'
  ) THEN
    CREATE POLICY product_location_history_insert
      ON public.product_location_history
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_location_history'
      AND policyname = 'product_location_history_update'
  ) THEN
    CREATE POLICY product_location_history_update
      ON public.product_location_history
      FOR UPDATE
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_location_history'
      AND policyname = 'product_location_history_delete'
  ) THEN
    CREATE POLICY product_location_history_delete
      ON public.product_location_history
      FOR DELETE
      USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_location_history TO anon, authenticated;
