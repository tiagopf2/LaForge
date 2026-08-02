-- Coaches sign in with either their name or their email, so a duplicate name
-- made the lookup ambiguous: findFirst would pick one account arbitrarily and
-- the other coach could never sign in.
--
-- Postgres unique indexes permit repeated NULLs, so accounts without a name are
-- unaffected. This migration fails loudly if two rows already share a name —
-- rename one of them, then re-run.
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
