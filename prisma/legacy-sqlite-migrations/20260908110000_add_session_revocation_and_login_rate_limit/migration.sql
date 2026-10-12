-- Session versioning invalidates copied signed cookies after logout.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Failed-login state is retained in the database so it is shared by server instances.
CREATE TABLE "LoginRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" DATETIME NOT NULL,
    "lockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
