BEGIN;
-- CreateTable
CREATE TABLE "HorsePhoto" (
    "horseId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorsePhoto_pkey" PRIMARY KEY ("horseId")
);

-- AddForeignKey
ALTER TABLE "HorsePhoto" ADD CONSTRAINT "HorsePhoto_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HorsePhoto" ADD CONSTRAINT "HorsePhoto_size_check" CHECK (octet_length("data") <= 262144);
ALTER TABLE "HorsePhoto" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "HorsePhoto" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "HorsePhoto" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "HorsePhoto" FROM authenticated;
  END IF;
END $$;
CREATE POLICY reinwell_server_only ON "HorsePhoto" FOR ALL TO postgres USING (true) WITH CHECK (true);
COMMIT;
