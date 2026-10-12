# Archived SQLite history

These migrations were written for SQLite and do not contain the full current farm/auth schema. They cannot be deployed to PostgreSQL. They are retained for history; initialize disposable SQLite databases with `prisma db push --schema prisma/schema.local.prisma`.

The active `prisma/migrations` directory now contains a PostgreSQL baseline generated from `prisma/schema.prisma`. Never apply that baseline blindly to an existing database. First compare its schema, back up data, and baseline the existing database only after confirming equivalence. No deployed migration history was changed by this repository update.
