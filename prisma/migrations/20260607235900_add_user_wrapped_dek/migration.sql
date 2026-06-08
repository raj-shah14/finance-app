-- Add envelope-encryption key columns to User
ALTER TABLE "User" ADD COLUMN "wrappedDek" BYTEA;
ALTER TABLE "User" ADD COLUMN "kekVersion" INTEGER NOT NULL DEFAULT 1;
