-- Reinwell uses its server-side Prisma connection, never the Supabase Data API.
-- This denies public Data API roles while preserving the database-owner role.
DO $$ DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User','Horse','Trainer','RideLog','WashLog','VetItem','Alert','Settings','EmailVerificationToken','Farm','FarmMember','FarmInvitation','LoginRateLimit']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS reinwell_server_only ON %I', table_name);
    EXECUTE format('CREATE POLICY reinwell_server_only ON %I AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;
