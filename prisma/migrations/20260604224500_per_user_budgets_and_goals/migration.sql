-- Privacy fix: budgets and goals are now per-user, not per-household.
-- Backfill nulls to the household owner (oldest owner-role user), then
-- enforce NOT NULL and switch Budget unique key to include userId.

-- 1. Backfill Goal.userId for legacy household-wide goals.
UPDATE "Goal" g
SET "userId" = (
  SELECT u.id FROM "User" u
  WHERE u."householdId" = g."householdId"
    AND u.role = 'owner'
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE g."userId" IS NULL;

-- Fallback: if a household has no owner (shouldn't happen), assign to any member.
UPDATE "Goal" g
SET "userId" = (
  SELECT u.id FROM "User" u
  WHERE u."householdId" = g."householdId"
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE g."userId" IS NULL;

-- 2. Backfill Budget.userId for legacy household-wide budgets.
UPDATE "Budget" b
SET "userId" = (
  SELECT u.id FROM "User" u
  WHERE u."householdId" = b."householdId"
    AND u.role = 'owner'
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE b."userId" IS NULL;

UPDATE "Budget" b
SET "userId" = (
  SELECT u.id FROM "User" u
  WHERE u."householdId" = b."householdId"
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE b."userId" IS NULL;

-- 3. Goal: enforce NOT NULL and re-attach FK as required.
ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "Goal_userId_fkey";
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Goal"
  ADD CONSTRAINT "Goal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Budget: enforce NOT NULL, swap unique key from (cat, household, m, y)
--    to (cat, userId, m, y) so multiple members can budget the same category.
ALTER TABLE "Budget" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_categoryId_householdId_month_year_key";
DROP INDEX IF EXISTS "Budget_categoryId_householdId_month_year_key";
CREATE UNIQUE INDEX "Budget_categoryId_userId_month_year_key"
  ON "Budget"("categoryId", "userId", "month", "year");
